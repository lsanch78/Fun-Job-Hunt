import { useState, useEffect, useRef, useCallback } from 'react'
import { WORKDAY } from '@/config/game'
import { supabase } from '@/lib/supabase'
import { startWorkday, endWorkday } from '@/services/workdayService'

// ── Storage helpers ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'workday_punch_in'
const WORKDAY_ID_KEY = 'workday_id'
const BREAK_START_KEY = 'workday_break_start'
const BREAK_LABEL_KEY = 'workday_break_label'

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

function saveBreakStart(isoString: string, label: string) {
  localStorage.setItem(BREAK_START_KEY, isoString)
  localStorage.setItem(BREAK_LABEL_KEY, label)
}

function loadBreakStart(): Date | null {
  const raw = localStorage.getItem(BREAK_START_KEY)
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function loadBreakLabel(): string | null {
  return localStorage.getItem(BREAK_LABEL_KEY)
}

function clearBreakStart() {
  localStorage.removeItem(BREAK_START_KEY)
  localStorage.removeItem(BREAK_LABEL_KEY)
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

// ── Sound: punch-in stamp ─────────────────────────────────────────────────────

function playPunchIn() {
  try {
    const ctx = new AudioContext()
    const sr = ctx.sampleRate
    const now = ctx.currentTime

    // Layer 1: impact thud — short low-frequency sine thump
    const thudOsc = ctx.createOscillator()
    const thudGain = ctx.createGain()
    thudOsc.type = 'sine'
    thudOsc.frequency.setValueAtTime(90, now)
    thudOsc.frequency.exponentialRampToValueAtTime(40, now + 0.08)
    thudGain.gain.setValueAtTime(0.55, now)
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    thudOsc.connect(thudGain)
    thudGain.connect(ctx.destination)
    thudOsc.start(now)
    thudOsc.stop(now + 0.12)

    // Layer 2: stamp crack — filtered noise burst
    const crackBuf = ctx.createBuffer(1, Math.ceil(sr * 0.06), sr)
    const cd = crackBuf.getChannelData(0)
    for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1
    const crackSrc = ctx.createBufferSource()
    crackSrc.buffer = crackBuf
    const crackHpf = ctx.createBiquadFilter()
    crackHpf.type = 'bandpass'
    crackHpf.frequency.value = 2200
    crackHpf.Q.value = 0.8
    const crackGain = ctx.createGain()
    crackGain.gain.setValueAtTime(0.22, now)
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    crackSrc.connect(crackHpf)
    crackHpf.connect(crackGain)
    crackGain.connect(ctx.destination)
    crackSrc.start(now)
    crackSrc.stop(now + 0.06)

    // Layer 3: ink-squeak — short rising chirp after the stamp lands
    const squeakOsc = ctx.createOscillator()
    const squeakGain = ctx.createGain()
    squeakOsc.type = 'sine'
    squeakOsc.frequency.setValueAtTime(700, now + 0.04)
    squeakOsc.frequency.linearRampToValueAtTime(1100, now + 0.10)
    squeakGain.gain.setValueAtTime(0, now + 0.04)
    squeakGain.gain.linearRampToValueAtTime(0.06, now + 0.055)
    squeakGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    squeakOsc.connect(squeakGain)
    squeakGain.connect(ctx.destination)
    squeakOsc.start(now + 0.04)
    squeakOsc.stop(now + 0.12)
  } catch { /* AudioContext blocked */ }
}

// ── Sound: punch-out stamp + paper slide ─────────────────────────────────────

function playPunchOut() {
  try {
    const ctx = new AudioContext()
    const sr = ctx.sampleRate
    const now = ctx.currentTime

    // Layer 1: heavier thud — same stamp feel, slightly lower
    const thudOsc = ctx.createOscillator()
    const thudGain = ctx.createGain()
    thudOsc.type = 'sine'
    thudOsc.frequency.setValueAtTime(75, now)
    thudOsc.frequency.exponentialRampToValueAtTime(32, now + 0.10)
    thudGain.gain.setValueAtTime(0.6, now)
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    thudOsc.connect(thudGain)
    thudGain.connect(ctx.destination)
    thudOsc.start(now)
    thudOsc.stop(now + 0.14)

    // Layer 2: stamp crack
    const crackBuf = ctx.createBuffer(1, Math.ceil(sr * 0.06), sr)
    const cd = crackBuf.getChannelData(0)
    for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1
    const crackSrc = ctx.createBufferSource()
    crackSrc.buffer = crackBuf
    const crackHpf = ctx.createBiquadFilter()
    crackHpf.type = 'bandpass'
    crackHpf.frequency.value = 1800
    crackHpf.Q.value = 0.7
    const crackGain = ctx.createGain()
    crackGain.gain.setValueAtTime(0.25, now)
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    crackSrc.connect(crackHpf)
    crackHpf.connect(crackGain)
    crackGain.connect(ctx.destination)
    crackSrc.start(now)
    crackSrc.stop(now + 0.06)

    // Layer 3: paper slide — low-passed noise that fades in after the stamp
    const slideDur = 0.28
    const slideBuf = ctx.createBuffer(1, Math.ceil(sr * slideDur), sr)
    const sd = slideBuf.getChannelData(0)
    for (let i = 0; i < sd.length; i++) sd[i] = Math.random() * 2 - 1
    const slideSrc = ctx.createBufferSource()
    slideSrc.buffer = slideBuf
    slideSrc.playbackRate.value = 0.6
    const slideLpf = ctx.createBiquadFilter()
    slideLpf.type = 'lowpass'
    slideLpf.frequency.value = 800
    const slideGain = ctx.createGain()
    const slideStart = now + 0.08
    slideGain.gain.setValueAtTime(0, slideStart)
    slideGain.gain.linearRampToValueAtTime(0.09, slideStart + 0.05)
    slideGain.gain.exponentialRampToValueAtTime(0.001, slideStart + slideDur)
    slideSrc.connect(slideLpf)
    slideLpf.connect(slideGain)
    slideGain.connect(ctx.destination)
    slideSrc.start(slideStart)
    slideSrc.stop(slideStart + slideDur)
  } catch { /* AudioContext blocked */ }
}

// ── WorkdayBar ────────────────────────────────────────────────────────────────

export default function WorkdayBar({ inline = false }: { inline?: boolean }) {
  const [now, setNow] = useState(() => new Date())
  const [punchIn, setPunchIn] = useState<Date | null>(() => loadPunchIn())
  const [breakStartedAt, setBreakStartedAt] = useState<Date | null>(() => loadBreakStart())
  const [breakDue, setBreakDue] = useState<string | null>(() => loadBreakLabel())
  const breakActive = breakStartedAt !== null
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

  function handleBreakButton() {
    if (breakActive) {
      clearBreakStart()
      setBreakStartedAt(null)
      setBreakDue(null)
    } else {
      const t = new Date()
      saveBreakStart(t.toISOString(), breakDue ?? '')
      setBreakStartedAt(t)
    }
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
    clearBreakStart()
    setPunchIn(null)
    setBreakStartedAt(null)
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
              className={[
                'font-pixel text-[9px] px-4 py-1.5 border cursor-pointer tracking-widest transition-colors',
                breakActive
                  ? 'border-secondary bg-secondary text-bg'
                  : 'border-secondary text-secondary animate-blink hover:bg-secondary hover:text-bg',
              ].join(' ')}
              onClick={handleBreakButton}
            >
              {breakActive
                ? `■ ON BREAK ${breakStartedAt ? formatElapsed(now.getTime() - breakStartedAt.getTime()) : ''}`
                : `TAKE ${breakDue}`}
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
