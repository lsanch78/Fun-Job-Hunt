import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEV_EMAIL = 'luis.sanchez01994@gmail.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // ── Auth — dev-only endpoint ──────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7))
  if (authError || !user || user.email !== DEV_EMAIL) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const currentPeriod = new Date().toISOString().slice(0, 7) // YYYY-MM

    // ── ai_usage: call counts per user ────────────────────────────────────
    const { data: usageRows } = await supabase
      .from('ai_usage')
      .select('user_id, count, period')

    // ── subscriptions: active subscriber count ────────────────────────────
    const now = new Date().toISOString()
    const { count: activeSubCount } = await supabase
      .from('subscriptions')
      .select('user_id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gt('current_period_end', now)

    // ── ai_cost_log: token usage this month ───────────────────────────────
    const { data: costRows } = await supabase
      .from('ai_cost_log')
      .select('model, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens')
      .eq('period', currentPeriod)

    return new Response(
      JSON.stringify({
        usageRows:    usageRows    ?? [],
        activeSubCount: activeSubCount ?? 0,
        costRows:     costRows     ?? [],
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('dev-costs error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
