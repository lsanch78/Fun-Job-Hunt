import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEV_EMAIL = 'luis.sanchez01994@gmail.com'

// Pricing as of mid-2025 ($/million tokens)
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-sonnet-4-5': { input: 3.00,  output: 15.00, cacheRead: 0.30,  cacheWrite: 3.75  },
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00, cacheRead: 0.30,  cacheWrite: 3.75  },
  'claude-haiku-4-5':  { input: 0.80,  output: 4.00,  cacheRead: 0.08,  cacheWrite: 1.00  },
  'claude-opus-4-5':   { input: 15.00, output: 75.00, cacheRead: 1.50,  cacheWrite: 18.75 },
  'claude-opus-4-7':   { input: 15.00, output: 75.00, cacheRead: 1.50,  cacheWrite: 18.75 },
}
const FALLBACK_PRICING = { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 }

// Pro plan is billed weekly at $8/wk. Monthly-income estimates annualize: weekly × 52 / 12.
const PRO_PRICE_WEEKLY = 8
const WEEKS_PER_YEAR = 52
const MONTHS_PER_YEAR = 12

function computeCost(costRows: { model: string; input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }[]) {
  let totalInputTokens = 0, totalOutputTokens = 0, totalCacheReadTokens = 0, totalCacheWriteTokens = 0, totalCost = 0
  for (const row of costRows) {
    const p = PRICING[row.model] ?? FALLBACK_PRICING
    totalInputTokens        += row.input_tokens
    totalOutputTokens       += row.output_tokens
    totalCacheReadTokens    += row.cache_read_input_tokens
    totalCacheWriteTokens   += row.cache_creation_input_tokens
    totalCost += (
      row.input_tokens               * p.input +
      row.output_tokens              * p.output +
      row.cache_read_input_tokens    * p.cacheRead +
      row.cache_creation_input_tokens * p.cacheWrite
    ) / 1_000_000
  }
  return { totalInputTokens, totalOutputTokens, totalCacheReadTokens, totalCacheWriteTokens, totalCost }
}

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

    // ── subscriptions: active subscriber user IDs + count ────────────────
    const now = new Date().toISOString()
    const { data: activeSubs, count: activeSubCount } = await supabase
      .from('subscriptions')
      .select('user_id', { count: 'exact' })
      .eq('status', 'active')
      .gt('current_period_end', now)
    const activeSubUserIds: string[] = (activeSubs ?? []).map((r: { user_id: string }) => r.user_id)

    // ── ai_cost_log: token usage this month ───────────────────────────────
    const { data: costRows } = await supabase
      .from('ai_cost_log')
      .select('model, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens')
      .eq('period', currentPeriod)

    // ── Compute snapshot fields ───────────────────────────────────────────
    const rows = usageRows ?? []
    const subSet = new Set(activeSubUserIds)
    const paidRows = rows.filter((r: { user_id: string }) => subSet.has(r.user_id))
    const freeRows = rows.filter((r: { user_id: string }) => !subSet.has(r.user_id))
    const paidUserCount = paidRows.length
    const freeUserCount = freeRows.length
    const totalCalls = rows.reduce((s: number, r: { count: number }) => s + r.count, 0)
    const avgCallsPaid = paidUserCount > 0 ? paidRows.reduce((s: number, r: { count: number }) => s + r.count, 0) / paidUserCount : 0
    const avgCallsFree = freeUserCount > 0 ? freeRows.reduce((s: number, r: { count: number }) => s + r.count, 0) / freeUserCount : 0
    const { totalInputTokens, totalOutputTokens, totalCacheReadTokens, totalCacheWriteTokens, totalCost } = computeCost(costRows ?? [])
    const estimatedIncome = (activeSubCount ?? 0) * PRO_PRICE_WEEKLY * (WEEKS_PER_YEAR / MONTHS_PER_YEAR)

    // ── Upsert current month's snapshot ──────────────────────────────────
    await supabase.from('monthly_cost_snapshots').upsert({
      period:                     currentPeriod,
      active_sub_count:           activeSubCount ?? 0,
      estimated_monthly_income:   estimatedIncome,
      total_calls:                totalCalls,
      unique_users:               rows.length,
      paid_user_count:            paidUserCount,
      free_user_count:            freeUserCount,
      avg_calls_paid_user:        avgCallsPaid,
      avg_calls_free_user:        avgCallsFree,
      total_input_tokens:         totalInputTokens,
      total_output_tokens:        totalOutputTokens,
      total_cache_read_tokens:    totalCacheReadTokens,
      total_cache_write_tokens:   totalCacheWriteTokens,
      total_anthropic_cost_usd:   totalCost,
      avg_cost_per_call:          totalCalls > 0 ? totalCost / totalCalls : 0,
      updated_at:                 new Date().toISOString(),
    }, { onConflict: 'period' })

    // ── Fetch all historical snapshots ────────────────────────────────────
    const { data: snapshots } = await supabase
      .from('monthly_cost_snapshots')
      .select('*')
      .order('period', { ascending: false })

    return new Response(
      JSON.stringify({
        usageRows:        rows,
        activeSubCount:   activeSubCount ?? 0,
        activeSubUserIds,
        costRows:         costRows     ?? [],
        snapshots:        snapshots    ?? [],
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
