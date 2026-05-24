import { useState, useEffect, useRef, useCallback } from 'react'
import { WORKDAY } from '@/config/game'
import { supabase } from '@/lib/supabase'
import { startWorkday, endWorkday } from '@/services/workdayService'

// ── Storage helpers ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'workday_punch_in'
const WORKDAY_ID_KEY = 'workday_id'

function savePunchIn(isoString: string) {
  localStorage.setItem(STORAGE_KEY, isoString)
}

function loadPunchIn(): Date | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function clearPunchIn() {
  localStorage.removeItem(STORAGE_KEY)
}

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

// Standard 8-hour shift schedule: offset from punch-in in minutes
const SHIFT_SCHEDULE = [
  { label: 'BREAK',   offsetMins: 2 * 60,  durationMins: 15 },
  { label: 'LUNCH',   offsetMins: 4 * 60,  durationMins: 30 },
  { label: 'BREAK 2', offsetMins: 6 * 60,  durationMins: 15 },
] as const

interface NextBreak {
  label: string
  at: Date        // wall-clock time the break starts
  inMs: number    // ms until break starts (negative = overdue/now)
}

function getNextBreak(punchIn: Date, now: Date): NextBreak | null {
  const elapsedMs = now.getTime() - punchIn.getTime()
  for (const slot of SHIFT_SCHEDULE) {
    const offsetMs = slot.offsetMins * 60 * 1000
    if (elapsedMs < offsetMs) {
      return {
        label: slot.label,
        at: new Date(punchIn.getTime() + offsetMs),
        inMs: offsetMs - elapsedMs,
      }
    }
  }
  return null // all breaks passed
}


// ── Sound: break chime ───────────────────────────────────────────────────────

function playBreakChime() {
  try {
    const ctx = new AudioContext()
    // Three-note bell: E5 → G5 → E6, soft sine tone
    const notes = [659.25, 783.99, 1318.5]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.22
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.1, t + 0.03)
      gain.gain.setValueAtTime(0.1, t + 0.15)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
      osc.start(t)
      osc.stop(t + 0.7)
    })
  } catch { /* AudioContext blocked */ }
}

// ── Sound: punch-in chime ─────────────────────────────────────────────────────

function playPunchIn() {
  try {
    const ctx = new AudioContext()
    // Two short ascending beeps
    [[440, 0], [660, 0.15]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + delay
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.08, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
      osc.start(t)
      osc.stop(t + 0.12)
    })
  } catch { /* AudioContext blocked */ }
}

function playPunchOut() {
  try {
    const ctx = new AudioContext()
    // Two short descending beeps
    [[660, 0], [440, 0.15]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + delay
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.08, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
      osc.start(t)
      osc.stop(t + 0.12)
    })
  } catch { /* AudioContext blocked */ }
}

// ── WorkdayBar ────────────────────────────────────────────────────────────────

export default function WorkdayBar() {
  const [now, setNow] = useState(() => new Date())
  const [punchIn, setPunchIn] = useState<Date | null>(() => loadPunchIn())
  const [breakDue, setBreakDue] = useState<string | null>(null) // label of the break that just fired
  // tracks which break offsets have already chimed, keyed by punchIn ISO string
  const firedChimesRef = useRef<Set<number>>(new Set())
  // lastActivity tracks last user interaction for auto-punch-out
  const lastActivityRef = useRef<number>(Date.now())

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Track user activity for auto punch-out
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, resetActivity, { passive: true }))
    return () => events.forEach((e) => window.removeEventListener(e, resetActivity))
  }, [resetActivity])

  // Auto punch-out after idle threshold
  useEffect(() => {
    if (!punchIn) return
    const id = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current
      if (idleMs >= WORKDAY.AUTO_PUNCH_OUT_IDLE_MS) {
        // Punch out at last-activity time, not now
        doPunchOut(new Date(lastActivityRef.current))
      }
    }, 30_000) // check every 30s
    return () => clearInterval(id)
  }, [punchIn]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fire break chime when each threshold is crossed
  useEffect(() => {
    if (!punchIn) return
    const elapsedMs = now.getTime() - punchIn.getTime()
    for (const slot of SHIFT_SCHEDULE) {
      const offsetMs = slot.offsetMins * 60 * 1000
      if (elapsedMs >= offsetMs && !firedChimesRef.current.has(offsetMs)) {
        firedChimesRef.current.add(offsetMs)
        playBreakChime()
        setBreakDue(slot.label)
      }
    }
  }, [now, punchIn])

  function dismissBreak() {
    setBreakDue(null)
  }

  function doPunchIn() {
    const t = new Date()
    savePunchIn(t.toISOString())
    setPunchIn(t)
    playPunchIn()
    // Persist to DB fire-and-forget; store returned id for punch-out
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      startWorkday(user.id, t).then((id) => {
        if (id) localStorage.setItem(WORKDAY_ID_KEY, id)
      })
    })
  }

  function doPunchOut(_at?: Date) {
    const workdayId = localStorage.getItem(WORKDAY_ID_KEY)
    localStorage.removeItem(WORKDAY_ID_KEY)
    clearPunchIn()
    setPunchIn(null)
    setBreakDue(null)
    firedChimesRef.current.clear()
    playPunchOut()
    // Persist punch-out time to DB — uses last-activity time per ADR 0001
    if (workdayId) {
      endWorkday(workdayId, _at ?? new Date())
    }
  }

  const isPunchedIn = punchIn !== null
  const elapsedMs = isPunchedIn ? now.getTime() - punchIn.getTime() : 0
  const nextBreak = isPunchedIn ? getNextBreak(punchIn, now) : null

  const btn =
    'font-pixel text-[9px] px-3 py-1.5 border border-border cursor-pointer select-none tracking-widest transition-colors'
  const btnPrimary = `${btn} border-primary text-primary hover:bg-primary hover:text-bg`
  const btnMuted = `${btn} border-muted text-muted cursor-not-allowed opacity-50`
  const btnDanger = `${btn} border-secondary text-secondary hover:bg-secondary hover:text-bg`

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9990] bg-surface border-t border-border font-pixel">
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

        {/* Divider */}
        <div className="h-8 w-px bg-border" />

        {/* Next break / meal */}
        <div className="flex flex-col gap-0.5 min-w-[120px]">
          <span className="text-muted text-[8px] tracking-widest">
            {isPunchedIn && nextBreak ? nextBreak.label : 'NEXT BREAK'}
          </span>
          {!isPunchedIn && (
            <span className="text-muted text-[9px]">---</span>
          )}
          {isPunchedIn && !nextBreak && (
            <span className="text-muted text-[9px]">ALL DONE</span>
          )}
          {isPunchedIn && nextBreak && (
            <span className="text-secondary text-[9px]">
              @ {nextBreak.at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border" />

        {/* Punch in / out buttons */}
        <div className="flex items-center gap-3">
          {isPunchedIn ? (
            <button className={btnMuted} disabled>
              PUNCH IN
            </button>
          ) : (
            <button className={btnPrimary} onClick={doPunchIn}>
              PUNCH IN
            </button>
          )}

          {isPunchedIn ? (
            <button className={btnDanger} onClick={() => doPunchOut()}>
              PUNCH OUT
            </button>
          ) : (
            <button className={btnMuted} disabled>
              PUNCH OUT
            </button>
          )}
        </div>

        {/* Punch-in timestamp */}
        {isPunchedIn && (
          <>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="text-muted text-[8px] tracking-widest">CLOCKED IN</span>
              <span className="text-muted text-[9px] tabular-nums">
                {punchIn.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </>
        )}

        {/* Break due prompt */}
        {breakDue && (
          <>
            <div className="h-8 w-px bg-border" />
            <button
              className="font-pixel text-[9px] px-4 py-1.5 border border-secondary text-secondary animate-blink hover:bg-secondary hover:text-bg cursor-pointer tracking-widest transition-colors"
              onClick={dismissBreak}
            >
              ► TAKE {breakDue} ◄
            </button>
          </>
        )}

        {/* Auto-punch-out warning (show when idle > 50min) */}
        <AutoIdleWarning lastActivityRef={lastActivityRef} isPunchedIn={isPunchedIn} />

      </div>
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

  const WARN_THRESHOLD = WORKDAY.AUTO_PUNCH_OUT_IDLE_MS * 0.85 // warn at 85% (51min)

  if (!isPunchedIn || idleMs < WARN_THRESHOLD) return null

  const remaining = Math.max(0, WORKDAY.AUTO_PUNCH_OUT_IDLE_MS - idleMs)
  const remainingMins = Math.ceil(remaining / 60_000)

  return (
    <div className="flex items-center gap-2 ml-auto text-[9px] text-secondary animate-blink">
      <span>⚠</span>
      <span>AUTO PUNCH-OUT IN {remainingMins}M</span>
    </div>
  )
}
