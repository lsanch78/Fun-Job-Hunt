import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWorkdays, type WorkdayRow } from '@/services/workdayService'
import { fetchJobs } from '@/services/jobService'
import type { Job } from '@/types'

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

/** Hours for rows whose `date` field falls in the current ISO week (Mon–Sun). */
function hoursThisWeek(workdays: WorkdayRow[]): number {
  const now = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7 // Mon=0 … Sun=6
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - dayOfWeek)
  const mondayStr = monday.toISOString().slice(0, 10)
  return workdays
    .filter((r) => r.date >= mondayStr)
    .reduce((acc, r) => acc + sessionHours(r), 0)
}

/** Hours for rows whose `date` field falls in the current calendar month. */
function hoursThisMonth(workdays: WorkdayRow[]): number {
  const prefix = new Date().toISOString().slice(0, 7) // "YYYY-MM"
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
  const todayStr = today.toISOString().slice(0, 10)
  let cursor = new Date(today)
  if (!completedDates.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (true) {
    const dateStr = cursor.toISOString().slice(0, 10)
    if (!completedDates.has(dateStr)) break
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
    const dateStr = d.toISOString().slice(0, 10)
    result.push({ date: dateStr, count: map.get(dateStr) ?? 0 })
  }
  return result
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

function AppsPerDayChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)

  if (data.length === 0) {
    return (
      <p className="text-muted text-xs">NO APPLICATIONS YET.</p>
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
              <div className="bg-surface border border-border px-2 py-1 text-[8px] whitespace-nowrap text-primary">
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
      <span className="text-muted text-[8px] tracking-widest">{label}</span>
      <span className="text-secondary text-xs leading-tight">{value}</span>
      {sub && <span className="text-muted text-[8px] leading-tight">{sub}</span>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [workdays, setWorkdays] = useState<WorkdayRow[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) { setLoading(false); return }
      const [rows, jobRows] = await Promise.all([
        fetchWorkdays(user.id),
        fetchJobs(user.id),
      ])
      if (!cancelled) {
        setWorkdays(rows)
        setJobs(jobRows)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // ── Computed stats ──────────────────────────────────────────────────────────

  const huntStartDate = useMemo(() => {
    if (jobs.length === 0) return null
    // Earliest application date
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg font-pixel text-primary scanlines pb-20">

      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-sm tracking-widest">STATS</h1>
        <p className="text-muted text-xs mt-1">
          {loading ? '...' : `${totalApps} applications · ${workdays.length} sessions`}
        </p>
      </div>

      {/* ── Row 1: Hunt overview ─────────────────────────────────────────────── */}
      <div className="px-6 py-4 flex flex-wrap gap-4 border-b border-border">
        <StatCard
          label="HUNT START"
          value={huntStartDate ?? (loading ? '...' : '—')}
        />
        <StatCard
          label="APPLICATIONS"
          value={loading ? '...' : String(totalApps)}
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
      </div>

      {/* ── Row 2: Time stats ────────────────────────────────────────────────── */}
      <div className="px-6 py-4 flex flex-wrap gap-4 border-b border-border">
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
      </div>

      {/* ── Applications per day chart ───────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-xs tracking-widest text-muted mb-3">
          APPLICATIONS / DAY
          <span className="ml-3 text-[8px]">(last 30 days)</span>
        </h2>
        {loading
          ? <p className="text-muted text-xs">LOADING...</p>
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
        <h2 className="text-xs tracking-widest text-muted mb-3">WORKDAY LOG</h2>

        {loading && (
          <p className="text-muted text-xs">LOADING...</p>
        )}

        {!loading && workdays.length === 0 && (
          <p className="text-muted text-xs">NO SESSIONS YET. PUNCH IN TO START TRACKING.</p>
        )}

        {!loading && workdays.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-left select-none">
                  {['DATE', 'PUNCH IN', 'PUNCH OUT', 'DURATION'].map((h) => (
                    <th key={h} className="px-2 py-2 font-normal text-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workdays.map((row) => {
                  const hrs = sessionHours(row)
                  return (
                    <tr key={row.id} className="border-b border-border hover:bg-surface/50 transition-colors">
                      <td className="px-2 py-1.5 text-primary whitespace-nowrap">{row.date}</td>
                      <td className="px-2 py-1.5 text-secondary tabular-nums whitespace-nowrap">
                        {formatTime(row.punch_in)}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                        {row.punch_out
                          ? <span className="text-primary">{formatTime(row.punch_out)}</span>
                          : <span className="text-secondary animate-blink">ACTIVE</span>
                        }
                      </td>
                      <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
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
