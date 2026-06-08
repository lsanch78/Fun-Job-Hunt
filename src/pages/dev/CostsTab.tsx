import { useCosts } from '@/hooks/dev/useCosts'
import { SUBSCRIPTION_PRICE_USD } from '@/services/dev/costService'
import type { MonthlySnapshot } from '@/types'
import type { StatCardProps, SliderRowProps } from '@/types'

function fmt(n: number, decimals = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${fmt(n / 1_000_000, 2)}M`
  if (n >= 1_000)     return `${fmt(n / 1_000, 1)}K`
  return String(n)
}

function StatCard({ label, value, sub, accent = 'muted' }: StatCardProps) {
  const colors: Record<string, string> = {
    green:  'text-green-400',
    red:    'text-red-400',
    blue:   'text-blue-400',
    yellow: 'text-yellow-400',
    muted:  'text-primary',
  }
  return (
    <div className="border border-border bg-surface p-4 flex flex-col gap-1 min-w-0">
      <span className="font-pixel text-[7px] tracking-widest text-muted uppercase">{label}</span>
      <span className={`font-pixel text-[13px] tracking-wide ${colors[accent]}`}>{value}</span>
      {sub && <span className="font-pixel text-[7px] text-muted">{sub}</span>}
    </div>
  )
}

function SliderRow({ label, value, min, max, onChange }: SliderRowProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="font-pixel text-[8px] text-muted w-28 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-primary h-1"
      />
      <span className="font-pixel text-[10px] text-primary w-12 text-right">{value}</span>
    </div>
  )
}

export default function CostsTab() {
  const {
    data, loading, error,
    simTotalUsers, simConversionPct, simSubPrice, simFreeCallsPerUser, simPaidCallsPerUser, simDirty,
    setSimTotalUsers, setSimConversionPct,
    setSimSubPrice, setSimFreeCallsPerUser, setSimPaidCallsPerUser,
    simPaidUsers, simFreeUsers, simTotalCalls, simIncome, simClaudeCost, simProfit,
    resetSim,
  } = useCosts()

  if (loading) return <p className="font-pixel text-[9px] text-muted tracking-wider p-6">LOADING...</p>
  if (error || !data) return <p className="font-pixel text-[9px] text-red-400 tracking-wider p-6">{error ?? 'No data'}</p>

  const supabaseCost = 0
  const profit = data.estimatedMonthlyIncome - data.totalAnthropicCostUsd - supabaseCost
  const hasTokenData = data.models.length > 0

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6">

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <span className="font-pixel text-[8px] tracking-widest text-muted">
          OVERVIEW — {new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' }).toUpperCase()}
        </span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Income (est.)"    value={`$${fmt(data.estimatedMonthlyIncome)}`} sub={`${data.activeSubCount} active subs × $${SUBSCRIPTION_PRICE_USD}`} accent="green" />
          <StatCard label="Claude Cost"      value={hasTokenData ? `$${fmt(data.totalAnthropicCostUsd)}` : '—'} sub={hasTokenData ? 'from token logs' : 'no calls logged yet'} accent={hasTokenData ? 'red' : 'muted'} />
          <StatCard label="Supabase Cost"    value="$0.00" sub="free tier" accent="muted" />
          <StatCard label="Net Profit (est.)" value={hasTokenData ? `$${fmt(profit)}` : '—'} sub="income − claude − supabase" accent={hasTokenData ? (profit >= 0 ? 'green' : 'red') : 'muted'} />
        </div>
      </section>

      {/* ── Call Counts ───────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <span className="font-pixel text-[8px] tracking-widest text-muted">CALL COUNTS</span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Calls"        value={String(data.totalCallsThisMonth)}  sub="this month, all users"         accent="blue"   />
          <StatCard label="Active Subscribers" value={String(data.activeSubCount)}        sub="paid — unlimited calls"        accent="yellow" />
          <StatCard label="Avg Cost / Call"    value={data.avgCostPerCall > 0 ? `$${fmt(data.avgCostPerCall, 4)}` : '—'} sub="claude cost ÷ total calls" accent="muted" />
          <StatCard label="Unique Users"       value={String(data.usageRows.length)}      sub="with ≥1 call this month"       accent="muted"  />
        </div>
      </section>

      {/* ── User Breakdown ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <span className="font-pixel text-[8px] tracking-widest text-muted">USER BREAKDOWN (active callers this month)</span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Paid Users"          value={String(data.paidUserCount)}                                                   sub="active sub + ≥1 call"        accent="yellow" />
          <StatCard label="Free Users"          value={String(data.freeUserCount)}                                                   sub="no sub + ≥1 call"            accent="muted"  />
          <StatCard label="Avg Calls / Paid"    value={data.avgCallsPaidUser > 0 ? fmt(data.avgCallsPaidUser, 1) : '—'}              sub="this month"                   accent="yellow" />
          <StatCard label="Avg Calls / Free"    value={data.avgCallsFreeUser > 0 ? fmt(data.avgCallsFreeUser, 1) : '—'}              sub="this month"                   accent="muted"  />
        </div>
      </section>

      {/* ── Token Usage ───────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <span className="font-pixel text-[8px] tracking-widest text-muted">TOKEN USAGE (logged calls only)</span>
        {!hasTokenData ? (
          <p className="font-pixel text-[8px] text-muted">No token data yet — will populate after the next AI call.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Input Tokens"       value={fmtTokens(data.totalInputTokens)}      accent="muted" />
              <StatCard label="Output Tokens"      value={fmtTokens(data.totalOutputTokens)}     accent="muted" />
              <StatCard label="Cache Read"         value={fmtTokens(data.totalCacheReadTokens)}  accent="blue"  />
              <StatCard label="Cache Write"        value={fmtTokens(data.totalCacheWriteTokens)} accent="blue"  />
            </div>

            {data.models.length > 0 && (
              <div className="border border-border bg-surface mt-1">
                <div className="grid grid-cols-6 gap-2 px-3 py-2 border-b border-border">
                  {['MODEL', 'INPUT', 'OUTPUT', 'CACHE READ', 'CACHE WRITE', 'COST'].map((h) => (
                    <span key={h} className="font-pixel text-[7px] text-muted tracking-widest">{h}</span>
                  ))}
                </div>
                {data.models.map((m) => (
                  <div key={m.model} className="grid grid-cols-6 gap-2 px-3 py-2 border-b border-border last:border-b-0">
                    <span className="font-pixel text-[8px] text-secondary truncate">{m.model}</span>
                    <span className="font-pixel text-[8px] text-text">{fmtTokens(m.input_tokens)}</span>
                    <span className="font-pixel text-[8px] text-text">{fmtTokens(m.output_tokens)}</span>
                    <span className="font-pixel text-[8px] text-blue-400">{fmtTokens(m.cache_read_input_tokens)}</span>
                    <span className="font-pixel text-[8px] text-blue-400">{fmtTokens(m.cache_creation_input_tokens)}</span>
                    <span className="font-pixel text-[8px] text-red-400">${fmt(m.estimated_cost_usd, 4)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Scaling Simulator ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="font-pixel text-[8px] tracking-widest text-muted">SCALING SIMULATOR</span>
          {simDirty && (
            <button
              onClick={resetSim}
              className="font-pixel text-[7px] border border-border text-muted px-2 py-0.5 hover:border-primary hover:text-primary transition-none"
            >
              RESET TO ACTUAL
            </button>
          )}
        </div>
        <div className="border border-border bg-surface px-4 py-4 flex flex-col gap-3">
          <SliderRow label="TOTAL USERS"    value={simTotalUsers}    min={0} max={50000} onChange={setSimTotalUsers}    />
          <SliderRow label="CONVERSION %"   value={simConversionPct} min={0} max={100}  onChange={setSimConversionPct} />
          <div className="flex items-center gap-4">
            <span className="font-pixel text-[8px] text-muted w-28 shrink-0">SUB PRICE $</span>
            <input
              type="number"
              min={1}
              max={999}
              step={1}
              value={simSubPrice}
              onChange={(e) => setSimSubPrice(Number(e.target.value))}
              className="w-20 bg-bg border border-border text-primary font-pixel text-[10px] px-2 py-1 text-right focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="font-pixel text-[8px] text-muted w-28 shrink-0">CALLS / FREE USER</span>
            <input
              type="number"
              min={0}
              max={999}
              step={1}
              value={simFreeCallsPerUser}
              onChange={(e) => setSimFreeCallsPerUser(Number(e.target.value))}
              className="w-20 bg-bg border border-border text-primary font-pixel text-[10px] px-2 py-1 text-right focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="font-pixel text-[8px] text-muted w-28 shrink-0">CALLS / PAID USER</span>
            <input
              type="number"
              min={0}
              max={999}
              step={1}
              value={simPaidCallsPerUser}
              onChange={(e) => setSimPaidCallsPerUser(Number(e.target.value))}
              className="w-20 bg-bg border border-border text-primary font-pixel text-[10px] px-2 py-1 text-right focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-4">
            <span className="font-pixel text-[7px] text-muted">FREE: {simFreeUsers.toLocaleString()}</span>
            <span className="font-pixel text-[7px] text-yellow-400">PAID: {simPaidUsers.toLocaleString()}</span>
          </div>
          <div className="border-t border-border pt-3 mt-1">
            <p className="font-pixel text-[7px] text-muted mb-3">
              ASSUMES {simFreeCallsPerUser} CALLS/FREE USER · {simPaidCallsPerUser} CALLS/PAID USER · AVG COST/CALL FROM LOGGED DATA
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Proj. Income"      value={`$${fmt(simIncome)}`}     sub={`${simPaidUsers.toLocaleString()} paid × $${simSubPrice}`} accent="green" />
              <StatCard label="Proj. Claude Cost" value={`$${fmt(simClaudeCost)}`} sub={`${simTotalCalls.toLocaleString()} calls`}    accent="red"   />
              <StatCard label="Proj. Supabase"    value="$0.00"                     sub="free tier"                                    accent="muted" />
              <StatCard label="Proj. Profit"      value={`$${fmt(simProfit)}`}      sub="income − claude − supabase"                   accent={simProfit >= 0 ? 'green' : 'red'} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Monthly History ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <span className="font-pixel text-[8px] tracking-widest text-muted">MONTHLY HISTORY</span>
        {data.snapshots.length === 0 ? (
          <p className="font-pixel text-[8px] text-muted">No snapshots yet — will save on next load.</p>
        ) : (
          <div className="border border-border bg-surface overflow-x-auto">
            <div className="grid grid-cols-8 gap-2 px-3 py-2 border-b border-border min-w-[640px]">
              {['PERIOD', 'INCOME', 'CLAUDE COST', 'PROFIT', 'CALLS', 'SUBS', 'USERS', 'AVG $/CALL'].map((h) => (
                <span key={h} className="font-pixel text-[7px] text-muted tracking-widest">{h}</span>
              ))}
            </div>
            {data.snapshots.map((s: MonthlySnapshot) => {
              const rowProfit = s.estimated_monthly_income - s.total_anthropic_cost_usd
              return (
                <div key={s.period} className="grid grid-cols-8 gap-2 px-3 py-2 border-b border-border last:border-b-0 min-w-[640px]">
                  <span className="font-pixel text-[8px] text-secondary">{s.period}</span>
                  <span className="font-pixel text-[8px] text-green-400">${fmt(s.estimated_monthly_income)}</span>
                  <span className="font-pixel text-[8px] text-red-400">${fmt(s.total_anthropic_cost_usd)}</span>
                  <span className={`font-pixel text-[8px] ${rowProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>${fmt(rowProfit)}</span>
                  <span className="font-pixel text-[8px] text-text">{s.total_calls.toLocaleString()}</span>
                  <span className="font-pixel text-[8px] text-yellow-400">{s.active_sub_count}</span>
                  <span className="font-pixel text-[8px] text-text">{s.unique_users}</span>
                  <span className="font-pixel text-[8px] text-muted">{s.avg_cost_per_call > 0 ? `$${fmt(s.avg_cost_per_call, 4)}` : '—'}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Per-user call table ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <span className="font-pixel text-[8px] tracking-widest text-muted">PER-USER USAGE ({data.usageRows.length} users)</span>
        {data.usageRows.length === 0 ? (
          <p className="font-pixel text-[8px] text-muted">No usage this month.</p>
        ) : (
          <div className="border border-border bg-surface">
            <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b border-border">
              {['USER ID', 'PERIOD', 'CALLS'].map((h) => (
                <span key={h} className="font-pixel text-[7px] text-muted tracking-widest">{h}</span>
              ))}
            </div>
            {[...data.usageRows]
              .sort((a, b) => b.count - a.count)
              .map((row) => (
                <div key={row.user_id} className="grid grid-cols-3 gap-2 px-3 py-2 border-b border-border last:border-b-0">
                  <span className="font-pixel text-[8px] text-muted truncate">{row.user_id.slice(0, 8)}…</span>
                  <span className="font-pixel text-[8px] text-text">{row.period}</span>
                  <span className="font-pixel text-[8px] text-primary">{row.count}</span>
                </div>
              ))}
          </div>
        )}
      </section>

    </div>
  )
}
