import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchWorkdays, readWorkdayCache, type WorkdayRow } from '@/services/workdayService'
import { fetchJobs, readCache } from '@/services/jobService'
import type { Job } from '@/types'
import { XP } from '@/config/game'
import XpTracker from '@/components/XpTracker'

// ── Formatters ────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatHours(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (hrs === 0) return `${mins}m`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}m`
}

/** Duration in fractional hours between two ISO strings. Returns 0 if punch_out is null. */
function sessionHours(row: WorkdayRow): number {
  if (!row.punch_out) return 0
  const ms = new Date(row.punch_out).getTime() - new Date(row.punch_in).getTime()
  return Math.max(0, ms / 3_600_000)
}

/** Total hours across all completed workday rows. */
function totalHours(workdays: WorkdayRow[]): number {
  return workdays.reduce((acc, r) => acc + sessionHours(r), 0)
}

/** Returns "YYYY-MM-DD" in local time for a given Date. */
function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** Hours for rows whose `date` field falls in the current ISO week (Mon–Sun). */
function hoursThisWeek(workdays: WorkdayRow[]): number {
  const now = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7 // Mon=0 … Sun=6
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - dayOfWeek)
  const mondayStr = localDateStr(monday)
  return workdays
    .filter((r) => r.date >= mondayStr)
    .reduce((acc, r) => acc + sessionHours(r), 0)
}

/** Hours for rows whose `date` field falls in the current calendar month. */
function hoursThisMonth(workdays: WorkdayRow[]): number {
  const now = new Date()
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return workdays
    .filter((r) => r.date.startsWith(prefix))
    .reduce((acc, r) => acc + sessionHours(r), 0)
}

/**
 * Current streak: consecutive calendar days with at least one completed session,
 * counting backwards from today (or yesterday if today has no session yet).
 */
function computeStreak(workdays: WorkdayRow[]): number {
  const completedDates = new Set(
    workdays.filter((r) => r.punch_out).map((r) => r.date)
  )
  if (completedDates.size === 0) return 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Start from today; if today has no session, still count from yesterday
  let cursor = new Date(today)
  if (!completedDates.has(localDateStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (true) {
    if (!completedDates.has(localDateStr(cursor))) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/**
 * Applications per calendar day for the last `days` days (inclusive of today),
 * filling days with zero applications as 0.
 */
function appsPerDay(jobs: Job[], days = 30): { date: string; count: number }[] {
  const map = new Map<string, number>()
  for (const job of jobs) {
    if (!job.applicationDate) continue
    map.set(job.applicationDate, (map.get(job.applicationDate) ?? 0) + 1)
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

/** ISO week string "YYYY-Www" for a YYYY-MM-DD date string. */
function isoWeek(dateStr: string): string {
  const d = new Date(dateStr)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const daysDiff = Math.floor((d.getTime() - startOfWeek1.getTime()) / 86_400_000)
  const week = Math.floor(daysDiff / 7) + 1
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// ── Bar chart ─────────────────────────────────────────────────────────────────

function AppsPerDayChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)

  if (data.length === 0) {
    return (
      <p className="font-terminal text-muted text-xl">NO APPLICATIONS YET.</p>
    )
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
            {/* Bar */}
            <div
              className="w-full bg-secondary transition-all duration-300 min-h-[3px]"
              style={{ height: `${heightPct}%` }}
            />
            {/* Tooltip */}
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

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
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
  const navigate = useNavigate()
  const [workdays, setWorkdays] = useState<WorkdayRow[]>(() =>
    userId ? readWorkdayCache(userId) : []
  )
  const [jobs, setJobs] = useState<Job[]>(() =>
    userId ? readCache(userId) : []
  )
  const [loading, setLoading] = useState(() =>
    userId ? readCache(userId).length === 0 && readWorkdayCache(userId).length === 0 : true
  )

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let cancelled = false
    async function load() {
      const [rows, jobRows] = await Promise.all([
        fetchWorkdays(userId!),
        fetchJobs(userId!),
      ])
      if (!cancelled) {
        setWorkdays(rows)
        setJobs(jobRows)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  // ── Computed stats ──────────────────────────────────────────────────────────

  const huntStartDate = useMemo(() => {
    if (jobs.length === 0) return null
    return jobs
      .map((j) => j.applicationDate)
      .filter(Boolean)
      .sort()[0] ?? null
  }, [jobs])

  const totalApps = jobs.length

  const interviewRatio = useMemo(() => {
    if (totalApps === 0) return null
    const interviewed = jobs.filter((j) =>
      j.status === 'PHONE_SCREEN' ||
      j.status === 'INTERVIEW' ||
      j.status === 'OFFER'
    ).length
    return Math.round((interviewed / totalApps) * 100)
  }, [jobs, totalApps])

  const streak = useMemo(() => computeStreak(workdays), [workdays])
  const weekHrs = useMemo(() => hoursThisWeek(workdays), [workdays])
  const monthHrs = useMemo(() => hoursThisMonth(workdays), [workdays])
  const allHrs = useMemo(() => totalHours(workdays), [workdays])
  const chartData = useMemo(() => appsPerDay(jobs), [jobs])

  // Funnel / outcome
  const offerCount = useMemo(() => jobs.filter((j) => j.status === 'OFFER').length, [jobs])
  const ghostedCount = useMemo(() => jobs.filter((j) => j.status === 'GHOSTED').length, [jobs])
  const rejectedCount = useMemo(() => jobs.filter((j) => j.status === 'REJECTED').length, [jobs])

  const ghostRate = useMemo(() => {
    if (totalApps === 0) return null
    return Math.round((ghostedCount / totalApps) * 100)
  }, [ghostedCount, totalApps])

  const rejectionRate = useMemo(() => {
    if (totalApps === 0) return null
    return Math.round((rejectedCount / totalApps) * 100)
  }, [rejectedCount, totalApps])

  const winRate = useMemo(() => {
    if (totalApps === 0) return null
    return Math.round((offerCount / totalApps) * 100)
  }, [offerCount, totalApps])

  // Activity insights
  const appsPerWorkHour = useMemo(() => {
    if (allHrs === 0 || totalApps === 0) return null
    return (totalApps / allHrs).toFixed(1)
  }, [totalApps, allHrs])

  const busiestDayOfWeek = useMemo(() => {
    const counts = new Array(7).fill(0)
    for (const job of jobs) {
      if (!job.applicationDate) continue
      const dow = new Date(job.applicationDate + 'T12:00:00').getDay()
      counts[dow]++
    }
    const max = Math.max(...counts)
    if (max === 0) return null
    return DAY_NAMES[counts.indexOf(max)]
  }, [jobs])

  const avgSessionLength = useMemo(() => {
    const completed = workdays.filter((r) => r.punch_out)
    if (completed.length === 0) return null
    return totalHours(completed) / completed.length
  }, [workdays])

  const longestSession = useMemo(() => {
    if (workdays.length === 0) return null
    return Math.max(...workdays.map(sessionHours))
  }, [workdays])

  // Job quality
  const avgRating = useMemo(() => {
    const rated = jobs.filter((j) => j.rating > 0)
    if (rated.length === 0) return null
    const sum = rated.reduce((acc, j) => acc + j.rating, 0)
    return (sum / rated.length).toFixed(1)
  }, [jobs])

  const highConvictionCount = useMemo(() =>
    jobs.filter((j) => j.rating >= 4).length
  , [jobs])

  // Momentum
  const bestWeek = useMemo(() => {
    const weekCounts = new Map<string, number>()
    for (const job of jobs) {
      if (!job.applicationDate) continue
      const w = isoWeek(job.applicationDate)
      weekCounts.set(w, (weekCounts.get(w) ?? 0) + 1)
    }
    if (weekCounts.size === 0) return null
    return Math.max(...weekCounts.values())
  }, [jobs])

  const daysSinceLastApp = useMemo(() => {
    const dates = jobs.map((j) => j.applicationDate).filter(Boolean).sort()
    if (dates.length === 0) return null
    const [y, m, d] = dates[dates.length - 1].split('-').map(Number)
    const last = new Date(y, m - 1, d)       // local midnight
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.floor((today.getTime() - last.getTime()) / 86_400_000)
  }, [jobs])

  // ── Rank ────────────────────────────────────────────────────────────────────
  const xp = totalApps * XP.ADD_JOB

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg text-primary scanlines pb-20">

      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
        <div>
          <h1 className="font-pixel text-sm tracking-widest">STATS</h1>
          <p className="text-muted text-xs mt-1">
            {loading ? '...' : `${totalApps} applications · ${workdays.length} sessions`}
          </p>
        </div>

        <button onClick={() => navigate('/story')} className="cursor-pointer hover:opacity-80 transition-opacity">
          <XpTracker xp={xp} />
        </button>
      </div>

      {/* ── Row 1: Hunt overview ─────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0">
        <h2 className="font-pixel text-[10px] tracking-widest text-muted">OVERVIEW</h2>
      </div>
      <div className="px-6 py-4 flex flex-wrap justify-start gap-4 border-b border-border">
        <StatCard
          label="HUNT START"
          value={huntStartDate ?? (loading ? '...' : '—')}
        />
        <StatCard
          label="APPLICATIONS"
          value={loading ? '...' : String(totalApps)}
        />
        <StatCard
          label="OFFERS"
          value={loading ? '...' : String(offerCount)}
          sub={offerCount > 0 ? `${winRate}% WIN RATE` : undefined}
        />
        <StatCard
          label="INTERVIEW RATE"
          value={
            loading
              ? '...'
              : interviewRatio === null
              ? '—'
              : `${interviewRatio}%`
          }
          sub={
            interviewRatio !== null && !loading
              ? `of ${totalApps} apps reached screening`
              : undefined
          }
        />
        <StatCard
          label="DAYS SINCE LAST APP"
          value={
            loading
              ? '...'
              : daysSinceLastApp === null
              ? '—'
              : daysSinceLastApp === 0
              ? 'TODAY'
              : `${daysSinceLastApp}d`
          }
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
        <StatCard
          label="STREAK"
          value={loading ? '...' : streak === 0 ? '0 DAYS' : `${streak} DAY${streak !== 1 ? 'S' : ''}`}
        />
        <StatCard
          label="HRS THIS WEEK"
          value={loading ? '...' : formatHours(weekHrs)}
        />
        <StatCard
          label="HRS THIS MONTH"
          value={loading ? '...' : formatHours(monthHrs)}
        />
        <StatCard
          label="TOTAL HUNT HRS"
          value={loading ? '...' : formatHours(allHrs)}
        />
        <StatCard
          label="AVG SESSION"
          value={loading ? '...' : avgSessionLength === null ? '—' : formatHours(avgSessionLength)}
        />
        <StatCard
          label="LONGEST SESSION"
          value={loading ? '...' : longestSession === null || longestSession === 0 ? '—' : formatHours(longestSession)}
        />
      </div>

      {/* ── Row 4: Activity insights ─────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0">
        <h2 className="font-pixel text-[10px] tracking-widest text-muted">ACTIVITY</h2>
      </div>
      <div className="px-6 py-4 flex flex-wrap justify-start gap-4 border-b border-border">
        <StatCard
          label="APPS / WORK HOUR"
          value={loading ? '...' : appsPerWorkHour === null ? '—' : appsPerWorkHour}
          sub="efficiency ratio"
        />
        <StatCard
          label="BUSIEST DAY"
          value={loading ? '...' : busiestDayOfWeek ?? '—'}
          sub="day of week"
        />
        <StatCard
          label="BEST WEEK"
          value={loading ? '...' : bestWeek === null ? '—' : `${bestWeek} APPS`}
          sub="most in one week"
        />
      </div>

      {/* ── Row 5: Job quality ───────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0">
        <h2 className="font-pixel text-[10px] tracking-widest text-muted">JOB QUALITY</h2>
      </div>
      <div className="px-6 py-4 flex flex-wrap justify-start gap-4 border-b border-border">
        <StatCard
          label="AVG RATING"
          value={loading ? '...' : avgRating === null ? '—' : `${avgRating} / 5`}
          sub="across rated jobs"
        />
        <StatCard
          label="HIGH CONVICTION"
          value={loading ? '...' : String(highConvictionCount)}
          sub="jobs rated 4+"
        />
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
        {/* X-axis: first and last date labels */}
        {!loading && chartData.length > 1 && (
          <div className="flex justify-between mt-1">
            <span className="text-muted text-[8px]">{chartData[0].date.slice(5)}</span>
            <span className="text-muted text-[8px]">{chartData[chartData.length - 1].date.slice(5)}</span>
          </div>
        )}
      </div>

      {/* ── Workday log ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-4">
        <h2 className="font-pixel text-xs tracking-widest text-muted mb-3">WORKDAY LOG</h2>

        {loading && (
          <p className="text-muted text-xs">LOADING...</p>
        )}

        {!loading && workdays.length === 0 && (
          <p className="font-terminal text-muted text-xl">NO SESSIONS YET. PUNCH IN TO START TRACKING.</p>
        )}

        {!loading && workdays.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-terminal text-xl">
              <thead>
                <tr className="border-b border-border text-left select-none">
                  {['DATE', 'PUNCH IN', 'PUNCH OUT', 'DURATION'].map((h) => (
                    <th key={h} className="px-2 py-2 font-normal text-muted whitespace-nowrap tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workdays.map((row) => {
                  const hrs = sessionHours(row)
                  return (
                    <tr key={row.id} className="border-b border-border hover:bg-surface/50 transition-colors">
                      <td className="px-2 py-1 text-primary whitespace-nowrap">{row.date}</td>
                      <td className="px-2 py-1 text-secondary tabular-nums whitespace-nowrap">
                        {formatTime(row.punch_in)}
                      </td>
                      <td className="px-2 py-1 tabular-nums whitespace-nowrap">
                        {row.punch_out
                          ? <span className="text-primary">{formatTime(row.punch_out)}</span>
                          : <span className="text-secondary animate-blink">ACTIVE</span>
                        }
                      </td>
                      <td className="px-2 py-1 tabular-nums whitespace-nowrap">
                        {row.punch_out
                          ? <span className="text-muted">{formatHours(hrs)}</span>
                          : <span className="text-secondary animate-blink">—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
