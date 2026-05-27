import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    // deno-lint-ignore no-explicit-any
    apiVersion: '2024-06-20' as any,
  })

  // ── Verify Stripe signature ───────────────────────────────────────────────
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook signature verification failed'
    console.error('stripe-webhook: signature verification failed:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Handle subscription events ──────────────────────────────────────────
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.supabase_user_id
      if (!userId) {
        console.error('stripe-webhook: no supabase_user_id in metadata for', subscription.id)
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Map Stripe statuses to our DB statuses
      const stripeStatus = subscription.status
      let status: 'free' | 'active' | 'canceled'
      if (stripeStatus === 'active' || stripeStatus === 'trialing') {
        status = 'active'
      } else if (stripeStatus === 'canceled' || stripeStatus === 'unpaid') {
        status = 'canceled'
      } else {
        // incomplete, incomplete_expired, past_due — keep as free until resolved
        status = 'free'
      }

      // In newer Stripe API versions current_period_end moved to items.data[0]
      const subAny = subscription as unknown as Record<string, unknown>
      const periodEnd: number =
        (subAny['current_period_end'] as number) ??
        ((subAny['items'] as { data: { current_period_end: number }[] })?.data?.[0]?.current_period_end)
      const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

      console.log(`stripe-webhook: upserting user ${userId} status=${status} (stripe: ${stripeStatus})`)

      const { error } = await supabase.from('subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        status,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      if (error) console.error('stripe-webhook: upsert error:', error)
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.supabase_user_id
      if (userId) {
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          status: 'canceled',
          current_period_end: (() => { const s = subscription as unknown as Record<string, unknown>; const t = (s['current_period_end'] as number) ?? ((s['items'] as { data: { current_period_end: number }[] })?.data?.[0]?.current_period_end); return t ? new Date(t * 1000).toISOString() : null })(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      }
    }
  } catch (err) {
    console.error('stripe-webhook: unhandled error:', err)
    // Return 200 so Stripe doesn't keep retrying — log and investigate separately
    return new Response(JSON.stringify({ received: true, error: err instanceof Error ? err.message : 'unknown' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
