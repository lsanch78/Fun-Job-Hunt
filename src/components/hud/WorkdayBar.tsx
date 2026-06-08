import { useState, useEffect } from 'react'
import { WORKDAY } from '@/config/game'
import { useWorkdayTracking } from '@/hooks/stats/useWorkdayTracking'

// ── Time formatting helpers ───────────────────────────────────────────────────

function formatClock(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── WorkdayBar ────────────────────────────────────────────────────────────────

export default function WorkdayBar({
  userId,
  inline = false,
}: {
  userId: string | null
  inline?: boolean
}) {
  const [now, setNow] = useState(() => new Date())
  const { punchIn, isPunchedIn, lastActivityRef } = useWorkdayTracking(userId)

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsedMs = isPunchedIn ? now.getTime() - punchIn!.getTime() : 0

  return (
    <div data-tutorial="workday-bar" className={inline ? "bg-surface border-b border-border font-pixel" : "fixed bottom-0 left-0 right-0 z-[9990] bg-surface border-t border-border font-pixel"}>
      <div className="flex items-center gap-6 px-6 py-2 text-xs">

        {/* Live clock */}
        <div className="flex flex-col gap-0.5 min-w-[96px]">
          <span className="text-muted text-[8px] tracking-widest">TIME</span>
          <span className="text-primary tabular-nums text-[11px]">{formatClock(now)}</span>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border" />

        {/* Elapsed */}
        <div className="flex flex-col gap-0.5 min-w-[100px]">
          <span className="text-muted text-[8px] tracking-widest">SHIFT</span>
          <span className={`tabular-nums text-[11px] ${isPunchedIn ? 'text-primary' : 'text-muted'}`}>
            {isPunchedIn ? formatElapsed(elapsedMs) : '--:--:--'}
          </span>
        </div>

        {/* Activity status */}
        {isPunchedIn && (
          <>
            <div className="h-8 w-px bg-border" />
            <ActivityStatus lastActivityRef={lastActivityRef} />
          </>
        )}

        {/* Auto-punch-out warning */}
        <AutoIdleWarning lastActivityRef={lastActivityRef} isPunchedIn={isPunchedIn} />

      </div>
    </div>
  )
}

// ── Activity status label ─────────────────────────────────────────────────────

const IDLE_LABEL_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutes

function ActivityStatus({ lastActivityRef }: { lastActivityRef: React.RefObject<number> }) {
  const [idleMs, setIdleMs] = useState(0)
  const [dots, setDots]     = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIdleMs(Date.now() - lastActivityRef.current)
    }, 5_000)
    return () => clearInterval(id)
  }, [lastActivityRef])

  const isIdle = idleMs >= IDLE_LABEL_THRESHOLD_MS

  useEffect(() => {
    if (isIdle) return
    const id = setInterval(() => setDots((d) => (d + 1) % 4), 500)
    return () => clearInterval(id)
  }, [isIdle])

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted text-[8px] tracking-widest">STATUS</span>
      <span className={`text-[9px] inline-block w-[92px] ${isIdle ? 'text-warning' : 'text-primary'}`}>
        {isIdle ? 'IDLE' : `TRACKING${'.'.repeat(dots)}`}
      </span>
    </div>
  )
}

// ── Idle warning ──────────────────────────────────────────────────────────────

function AutoIdleWarning({
  lastActivityRef,
  isPunchedIn,
}: {
  lastActivityRef: React.RefObject<number>
  isPunchedIn: boolean
}) {
  const [idleMs, setIdleMs] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIdleMs(Date.now() - lastActivityRef.current)
    }, 5_000)
    return () => clearInterval(id)
  }, [lastActivityRef])

  const WARN_THRESHOLD = WORKDAY.AUTO_PUNCH_OUT_IDLE_MS * 0.85

  if (!isPunchedIn || idleMs < WARN_THRESHOLD) return null

  const remaining     = Math.max(0, WORKDAY.AUTO_PUNCH_OUT_IDLE_MS - idleMs)
  const remainingMins = Math.ceil(remaining / 60_000)

  return (
    <div className="flex items-center gap-2 ml-auto text-[9px] text-secondary animate-blink">
      <span>⚠</span>
      <span>AUTO PUNCH-OUT IN {remainingMins}M</span>
    </div>
  )
}
