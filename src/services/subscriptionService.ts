import { supabase } from '@/lib/supabase'

const CHECKOUT_URL = `${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/create-checkout-session`

export interface Subscription {
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: 'free' | 'active' | 'canceled'
  current_period_end: string | null
  updated_at: string
}

export function isSubscribed(sub: Subscription | null): boolean {
  if (!sub) return false
  if (sub.status !== 'active') return false
  if (!sub.current_period_end) return false
  return new Date(sub.current_period_end) > new Date()
}

export async function fetchSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as Subscription
}

export async function createCheckoutSession(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const returnUrl = window.location.origin
  const res = await fetch(CHECKOUT_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ return_url: returnUrl }),
  })

  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(json.error ?? `Checkout failed: HTTP ${res.status}`)
  }

  const { url } = await res.json() as { url: string }
  if (url) window.location.href = url
}
