export interface UsageRow {
  user_id: string
  count: number
  period: string
}

export interface CostRow {
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export interface ModelSummary {
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  estimated_cost_usd: number
}

export interface MonthlySnapshot {
  period: string
  active_sub_count: number
  estimated_monthly_income: number
  total_calls: number
  unique_users: number
  paid_user_count: number
  free_user_count: number
  avg_calls_paid_user: number
  avg_calls_free_user: number
  total_input_tokens: number
  total_output_tokens: number
  total_cache_read_tokens: number
  total_cache_write_tokens: number
  total_anthropic_cost_usd: number
  avg_cost_per_call: number
  updated_at: string
}

export interface CostData {
  usageRows: UsageRow[]
  totalCallsThisMonth: number
  activeSubCount: number
  estimatedMonthlyIncome: number
  paidUserCount: number
  freeUserCount: number
  avgCallsPaidUser: number
  avgCallsFreeUser: number
  models: ModelSummary[]
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  totalAnthropicCostUsd: number
  avgCostPerCall: number
  snapshots: MonthlySnapshot[]
}

export interface StatCardProps {
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'red' | 'blue' | 'yellow' | 'muted'
}

export interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}

export type Tab = 'FEEDBACK' | 'COSTS'
