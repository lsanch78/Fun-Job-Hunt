import { useMemo } from 'react'
import { useStats } from '@/hooks/stats/useStats'
import type { ActivityHeartbeat } from '@/types'
import type { Job } from '@/types'
import XpTracker from '@/components/hud/XpTracker'
import { useXp } from '@/hooks/hud/useXp'

const SESSION_GAP_MS        = 30 * 60 * 1000 // gap > 30 min = new session
const HEARTBEAT_DURATION_MS = 15 * 60 * 1000 // each heartbeat counts as 15 min

// ── Session types ─────────────────────────────────────────────────────────────

interface Session {
  start: Date
  end: Date
  durationMs: number
  date: string
}

// ── Session computation ───────────────────────────────────────────────────────

function computeSessions(heartbeats: ActivityHeartbeat[]): Session[] {
  if (heartbeats.length === 0) return []

  const sorted = [...heartbeats].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  )

  const sessions: Session[] = []
  let groupStart = new Date(sorted[0].ts)
  let groupEnd   = new Date(sorted[0].ts)

  for (let i = 1; i < sorted.length; i++) {
    const current  = new Date(sorted[i].ts)
    const previous = new Date(sorted[i - 1].ts)
    if (current.getTime() - previous.getTime() > SESSION_GAP_MS) {
      sessions.push(makeSession(groupStart, groupEnd))
      groupStart = current
    }
    groupEnd = current
  }
  sessions.push(makeSession(groupStart, groupEnd))

  return sessions.reverse() // newest first for display
}

function makeSession(start: Date, end: Date): Session {
  const durationMs = end.getTime() - start.getTime() + HEARTBEAT_DURATION_MS
  const date = [
    start.getFullYear(),
    String(start.getMonth() + 1).padStart(2, '0'),
    String(start.getDate()).padStart(2, '0'),
  ].join('-')
  return { start, end, durationMs, date }
}

function totalHours(sessions: Session[]): number {
  return sessions.reduce((acc, s) => acc + s.durationMs / 3_600_000, 0)
}

function hoursThisWeek(sessions: Session[]): number {
  const now = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - dayOfWeek)
  const cutoff = monday.getTime()
  return sessions
    .filter((s) => s.start.getTime() >= cutoff)
    .reduce((acc, s) => acc + s.durationMs / 3_600_000, 0)
}

function hoursThisMonth(sessions: Session[]): number {
  const now = new Date()
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return sessions
    .filter((s) => s.date.startsWith(prefix))
    .reduce((acc, s) => acc + s.durationMs / 3_600_000, 0)
}

function computeStreak(sessions: Session[]): number {
  const activeDates = new Set(sessions.map((s) => s.date))
  if (activeDates.size === 0) return 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function localDateStr(d: Date): string {
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-')
  }

  let cursor = new Date(today)
  if (!activeDates.has(localDateStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (activeDates.has(localDateStr(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatHours(h: number): string {
  const hrs  = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (hrs === 0) return `${mins}m`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}m`
}

function appsPerDay(jobs: Job[], days = 30): { date: string; count: number }[] {
  const map = new Map<string, number>()
  for (const job of jobs) {
    if (!job.applicationDate) continue
    const key = job.applicationDate.slice(0, 10)
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  const result: { date: string; count: number }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-')
    result.push({ date: dateStr, count: map.get(dateStr) ?? 0 })
  }
  return result
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

function AppsPerDayChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)

  if (data.length === 0) {
    return <p className="font-terminal text-muted text-xl">NO APPLICATIONS YET.</p>
  }

  return (
    <div className="flex items-end gap-[3px] h-20 w-full overflow-visible">
      {data.map(({ date, count }) => {
        const heightPct = Math.max((count / max) * 100, 8)
        return (
          <div
            key={date}
            className="group relative flex-1 min-w-[4px] flex flex-col items-center justify-end h-full"
          >
            <div
              className="w-full bg-secondary transition-all duration-300 min-h-[3px]"
              style={{ height: `${heightPct}%` }}
            />
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
              <div className="font-terminal bg-surface border border-border px-2 py-1 text-base whitespace-nowrap text-primary">
                {date.slice(5)}<br />{count} APP{count !== 1 ? 'S' : ''}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-border px-4 py-3 bg-surface flex flex-col gap-1 min-w-[120px]">
      <span className="font-pixel text-muted text-[8px] tracking-widest">{label}</span>
      <span className="font-terminal text-secondary text-2xl leading-tight">{value}</span>
      {sub && <span className="font-terminal text-muted text-base leading-tight">{sub}</span>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StatsPage({ userId }: { userId: string | null }) {
  const {
    loading,
    heartbeats,
    jobs,
    huntStartDate,
    totalApps,
    interviewRatio,
    offerCount,
    ghostedCount,
    rejectedCount,
    ghostRate,
    rejectionRate,
    winRate,
    avgRating,
    highConvictionCount,
    daysSinceLastApp,
    bestWeek,
    busiestDayOfWeek,
    totalContacts,
    champCount,
    allyCount,
    avgCommExp,
    mostActiveContact,
    contactsCommThisWeek,
  } = useStats(userId)

  const { xp } = useXp(userId)

  const sessions         = useMemo(() => computeSessions(heartbeats), [heartbeats])
  const streak           = useMemo(() => computeStreak(sessions), [sessions])
  const weekHrs          = useMemo(() => hoursThisWeek(sessions), [sessions])
  const monthHrs         = useMemo(() => hoursThisMonth(sessions), [sessions])
  const allHrs           = useMemo(() => totalHours(sessions), [sessions])
  const chartData        = useMemo(() => appsPerDay(jobs), [jobs])
  const appsPerWorkHour  = useMemo(() => {
    if (allHrs === 0 || totalApps === 0) return null
    return (totalApps / allHrs).toFixed(1)
  }, [totalApps, allHrs])
  const avgSessionLength = useMemo(() => {
    if (sessions.length === 0) return null
    return allHrs / sessions.length
  }, [sessions, allHrs])
  const longestSession   = useMemo(() => {
    if (sessions.length === 0) return null
    return Math.max(...sessions.map((s) => s.durationMs / 3_600_000))
  }, [sessions])

  return (
    <div className="h-full overflow-y-auto bg-bg text-primary scanlines pb-20">

      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 min-h-[100px]">
        <div>
          <h1 className="font-pixel text-sm tracking-widest">STATS</h1>
          <p className="text-muted text-xs mt-1">
            {loading ? '...' : `${totalApps} applications · ${sessions.length} sessions`}
          </p>
        </div>
        <XpTracker xp={xp} />
      </div>

      {/* ── Row 1: Hunt overview ─────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0">
        <h2 className="font-pixel text-[10px] tracking-widest text-muted">OVERVIEW</h2>
      </div>
      <div className="px-6 py-4 flex flex-wrap justify-start gap-4 border-b border-border">
        <StatCard label="HUNT START"   value={huntStartDate ?? (loading ? '...' : '—')} />
        <StatCard label="APPLICATIONS" value={loading ? '...' : String(totalApps)} />
        <StatCard
          label="OFFERS"
          value={loading ? '...' : String(offerCount)}
          sub={offerCount > 0 ? `${winRate}% WIN RATE` : undefined}
        />
        <StatCard
          label="INTERVIEW RATE"
          value={loading ? '...' : interviewRatio === null ? '—' : `${interviewRatio}%`}
          sub={interviewRatio !== null && !loading ? `of ${totalApps} apps reached screening` : undefined}
        />
        <StatCard
          label="DAYS SINCE LAST APP"
          value={loading ? '...' : daysSinceLastApp === null ? '—' : daysSinceLastApp === 0 ? 'TODAY' : `${daysSinceLastApp}d`}
        />
      </div>

      {/* ── Row 2: Outcomes ───────────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0">
        <h2 className="font-pixel text-[10px] tracking-widest text-muted">OUTCOMES</h2>
      </div>
      <div className="px-6 py-4 flex flex-wrap justify-start gap-4 border-b border-border">
        <StatCard
          label="GHOST RATE"
          value={loading ? '...' : ghostRate === null ? '—' : `${ghostRate}%`}
          sub={loading || ghostedCount === 0 ? undefined : `${ghostedCount} ghosted`}
        />
        <StatCard
          label="REJECTION RATE"
          value={loading ? '...' : rejectionRate === null ? '—' : `${rejectionRate}%`}
          sub={loading || rejectedCount === 0 ? undefined : `${rejectedCount} rejected`}
        />
        <StatCard
          label="WIN RATE"
          value={loading ? '...' : winRate === null ? '—' : `${winRate}%`}
          sub={loading || offerCount === 0 ? undefined : `${offerCount} offer${offerCount !== 1 ? 'S' : ''}`}
        />
      </div>

      {/* ── Row 3: Time stats ────────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0">
        <h2 className="font-pixel text-[10px] tracking-widest text-muted">TIME</h2>
      </div>
      <div className="px-6 py-4 flex flex-wrap justify-start gap-4 border-b border-border">
        <StatCard label="STREAK"          value={loading ? '...' : streak === 0 ? '0 DAYS' : `${streak} DAY${streak !== 1 ? 'S' : ''}`} />
        <StatCard label="HRS THIS WEEK"   value={loading ? '...' : formatHours(weekHrs)} />
        <StatCard label="HRS THIS MONTH"  value={loading ? '...' : formatHours(monthHrs)} />
        <StatCard label="TOTAL HUNT HRS"  value={loading ? '...' : formatHours(allHrs)} />
        <StatCard label="AVG SESSION"     value={loading ? '...' : avgSessionLength === null ? '—' : formatHours(avgSessionLength)} />
        <StatCard label="LONGEST SESSION" value={loading ? '...' : longestSession === null || longestSession === 0 ? '—' : formatHours(longestSession)} />
      </div>

      {/* ── Row 4: Activity insights ─────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0">
        <h2 className="font-pixel text-[10px] tracking-widest text-muted">ACTIVITY</h2>
      </div>
      <div className="px-6 py-4 flex flex-wrap justify-start gap-4 border-b border-border">
        <StatCard label="APPS / WORK HOUR" value={loading ? '...' : appsPerWorkHour === null ? '—' : appsPerWorkHour} sub="efficiency ratio" />
        <StatCard label="BUSIEST DAY"      value={loading ? '...' : busiestDayOfWeek ?? '—'} sub="day of week" />
        <StatCard label="BEST WEEK"        value={loading ? '...' : bestWeek === null ? '—' : `${bestWeek} APPS`} sub="most in one week" />
      </div>

      {/* ── Row 5: Job quality ───────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0">
        <h2 className="font-pixel text-[10px] tracking-widest text-muted">JOB QUALITY</h2>
      </div>
      <div className="px-6 py-4 flex flex-wrap justify-start gap-4 border-b border-border">
        <StatCard label="AVG RATING"      value={loading ? '...' : avgRating === null ? '—' : `${avgRating} / 5`} sub="across rated jobs" />
        <StatCard label="HIGH CONVICTION" value={loading ? '...' : String(highConvictionCount)} sub="jobs rated 4+" />
      </div>

      {/* ── Row 6: Network ──────────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0">
        <h2 className="font-pixel text-[10px] tracking-widest text-muted">NETWORK</h2>
      </div>
      <div className="px-6 py-4 flex flex-wrap justify-start gap-4 border-b border-border">
        <StatCard label="CONTACTS"        value={loading ? '...' : String(totalContacts)} sub="in your network" />
        <StatCard label="COMMS THIS WEEK" value={loading ? '...' : String(contactsCommThisWeek)} sub="contacts reached" />
        <StatCard label="AVG EXP"         value={loading ? '...' : avgCommExp === null ? '—' : String(avgCommExp)} sub="across all contacts" />
        <StatCard label="CHAMPIONS"       value={loading ? '...' : String(champCount)} sub="80+ exp" />
        <StatCard label="ALLIES"          value={loading ? '...' : String(allyCount)} sub="60–79 exp" />
        {mostActiveContact && (
          <StatCard label="TOP CONTACT" value={loading ? '...' : mostActiveContact.name} sub={`${mostActiveContact.commExp} exp`} />
        )}
      </div>

      {/* ── Applications per day chart ───────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-pixel text-xs tracking-widest text-muted mb-3">
          APPLICATIONS / DAY
          <span className="ml-3 text-[8px]">(last 30 days)</span>
        </h2>
        {loading
          ? <p className="font-terminal text-muted text-xl">LOADING...</p>
          : <AppsPerDayChart data={chartData} />
        }
        {!loading && chartData.length > 1 && (
          <div className="flex justify-between mt-1">
            <span className="text-muted text-[8px]">{chartData[0].date.slice(5)}</span>
            <span className="text-muted text-[8px]">{chartData[chartData.length - 1].date.slice(5)}</span>
          </div>
        )}
      </div>

      {/* ── Session log ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-4">
        <h2 className="font-pixel text-xs tracking-widest text-muted mb-3">SESSION LOG</h2>

        {loading && <p className="text-muted text-xs">LOADING...</p>}

        {!loading && sessions.length === 0 && (
          <p className="font-terminal text-muted text-xl">NO SESSIONS YET. START LOGGING JOBS TO TRACK TIME.</p>
        )}

        {!loading && sessions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-terminal text-xl">
              <thead>
                <tr className="border-b border-border text-left select-none">
                  {['DATE', 'START', 'END', 'DURATION'].map((h) => (
                    <th key={h} className="px-2 py-2 font-normal text-muted whitespace-nowrap tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((session, i) => (
                  <tr key={i} className="border-b border-border hover:bg-surface/50 transition-colors">
                    <td className="px-2 py-1 text-primary whitespace-nowrap">{session.date}</td>
                    <td className="px-2 py-1 text-secondary tabular-nums whitespace-nowrap">{formatTime(session.start)}</td>
                    <td className="px-2 py-1 text-primary tabular-nums whitespace-nowrap">{formatTime(session.end)}</td>
                    <td className="px-2 py-1 text-muted tabular-nums whitespace-nowrap">{formatHours(session.durationMs / 3_600_000)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
