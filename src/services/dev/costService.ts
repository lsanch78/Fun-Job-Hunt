import { supabase } from '@/lib/supabase'
import { PRO_PRICE_WEEKLY } from '@/config/pricing'
import { weeklyToMonthlyIncome } from '@/lib/pricing'
import type { UsageRow, CostRow, ModelSummary, MonthlySnapshot, CostData } from '@/types'

const DEV_COSTS_URL = `${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/dev-costs`

// Pricing as of mid-2025 ($/million tokens)
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-sonnet-4-5': { input: 3.00,  output: 15.00, cacheRead: 0.30,  cacheWrite: 3.75  },
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00, cacheRead: 0.30,  cacheWrite: 3.75  },
  'claude-haiku-4-5':  { input: 0.80,  output: 4.00,  cacheRead: 0.08,  cacheWrite: 1.00  },
  'claude-opus-4-5':   { input: 15.00, output: 75.00, cacheRead: 1.50,  cacheWrite: 18.75 },
  'claude-opus-4-7':   { input: 15.00, output: 75.00, cacheRead: 1.50,  cacheWrite: 18.75 },
}
const FALLBACK_PRICING = { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 }

export const SUBSCRIPTION_PRICE_USD_WEEKLY = PRO_PRICE_WEEKLY

export async function fetchCostData(): Promise<CostData> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch(DEV_COSTS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(json.error ?? `dev-costs: HTTP ${res.status}`)
  }

  const raw = await res.json() as {
    usageRows: UsageRow[]
    activeSubCount: number
    activeSubUserIds: string[]
    costRows: CostRow[]
    snapshots: MonthlySnapshot[]
  }

  const { usageRows, activeSubCount, activeSubUserIds, costRows, snapshots } = raw
  const subSet = new Set(activeSubUserIds)

  const paidRows = usageRows.filter((r) => subSet.has(r.user_id))
  const freeRows = usageRows.filter((r) => !subSet.has(r.user_id))
  const paidUserCount = paidRows.length
  const freeUserCount = freeRows.length
  const avgCallsPaidUser = paidUserCount > 0
    ? paidRows.reduce((s, r) => s + r.count, 0) / paidUserCount
    : 0
  const avgCallsFreeUser = freeUserCount > 0
    ? freeRows.reduce((s, r) => s + r.count, 0) / freeUserCount
    : 0

  const totalCallsThisMonth = usageRows.reduce((s, r) => s + r.count, 0)
  const estimatedMonthlyIncome = weeklyToMonthlyIncome(activeSubCount, SUBSCRIPTION_PRICE_USD_WEEKLY)

  // Aggregate cost rows by model
  const byModel = new Map<string, ModelSummary>()
  for (const row of costRows) {
    const existing = byModel.get(row.model)
    if (existing) {
      existing.input_tokens               += row.input_tokens
      existing.output_tokens              += row.output_tokens
      existing.cache_read_input_tokens    += row.cache_read_input_tokens
      existing.cache_creation_input_tokens += row.cache_creation_input_tokens
    } else {
      byModel.set(row.model, { ...row, estimated_cost_usd: 0 })
    }
  }

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCacheReadTokens = 0
  let totalCacheWriteTokens = 0
  let totalAnthropicCostUsd = 0

  const models: ModelSummary[] = Array.from(byModel.values()).map((m) => {
    const p = PRICING[m.model] ?? FALLBACK_PRICING
    const cost = (
      m.input_tokens               * p.input +
      m.output_tokens              * p.output +
      m.cache_read_input_tokens    * p.cacheRead +
      m.cache_creation_input_tokens * p.cacheWrite
    ) / 1_000_000

    totalInputTokens        += m.input_tokens
    totalOutputTokens       += m.output_tokens
    totalCacheReadTokens    += m.cache_read_input_tokens
    totalCacheWriteTokens   += m.cache_creation_input_tokens
    totalAnthropicCostUsd   += cost

    return { ...m, estimated_cost_usd: cost }
  })

  const avgCostPerCall = totalCallsThisMonth > 0
    ? totalAnthropicCostUsd / totalCallsThisMonth
    : 0

  return {
    usageRows,
    totalCallsThisMonth,
    activeSubCount,
    estimatedMonthlyIncome,
    paidUserCount,
    freeUserCount,
    avgCallsPaidUser,
    avgCallsFreeUser,
    models,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadTokens,
    totalCacheWriteTokens,
    totalAnthropicCostUsd,
    avgCostPerCall,
    snapshots: snapshots ?? [],
  }
}
