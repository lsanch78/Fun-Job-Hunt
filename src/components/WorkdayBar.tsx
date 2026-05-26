import { useState, useEffect, useRef, useCallback } from 'react'
import { WORKDAY } from '@/config/game'
import { supabase } from '@/lib/supabase'
import { startWorkday, endWorkday } from '@/services/workdayService'
import { isSfxMuted } from '@/lib/sfx'

// ── Storage helpers ───────────────────────────────────────────────────────────

const STORAGE_KEY    = 'workday_punch_in'
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

// ── Sound: clock tick-tock punch-in ──────────────────────────────────────────

function playPunchIn() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const sr = ctx.sampleRate

    function makeTick(t: number, highPitch: boolean) {
      const bufLen = Math.ceil(sr * 0.012)
      const buf = ctx.createBuffer(1, bufLen, sr)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
      const src = ctx.createBufferSource()
      src.buffer = buf

      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = highPitch ? 3200 : 2000
      bp.Q.value = 3.5

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.28, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.012)

      src.connect(bp)
      bp.connect(gain)
      gain.connect(ctx.destination)
      src.start(t)
      src.stop(t + 0.015)
    }

    makeTick(ctx.currentTime,        false)
    makeTick(ctx.currentTime + 0.18, true)
  } catch { /* AudioContext blocked */ }
}

// ── Sound: punch-out stamp + paper slide ─────────────────────────────────────

function playPunchOut() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const sr = ctx.sampleRate
    const now = ctx.currentTime

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
  const [now, setNow]       = useState(() => new Date())
  const [punchIn, setPunchIn] = useState<Date | null>(() => loadPunchIn())
  const lastActivityRef     = useRef<number>(Date.now())

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Track user activity — auto punch-in on first interaction
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    setPunchIn((current) => {
      if (current !== null) return current
      const t = new Date()
      savePunchIn(t.toISOString())
      playPunchIn()
      if (!localStorage.getItem(WORKDAY_ID_KEY)) {
        localStorage.setItem(WORKDAY_ID_KEY, 'pending')
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) { localStorage.removeItem(WORKDAY_ID_KEY); return }
          startWorkday(user.id, t).then((id) => {
            if (id) localStorage.setItem(WORKDAY_ID_KEY, id)
            else localStorage.removeItem(WORKDAY_ID_KEY)
          })
        })
      }
      return t
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => resetActivity()
    window.addEventListener('fjobhunt:job-input', handler)
    return () => window.removeEventListener('fjobhunt:job-input', handler)
  }, [resetActivity])

  // Auto punch-out after idle threshold
  useEffect(() => {
    if (!punchIn) return
    const id = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current
      if (idleMs >= WORKDAY.AUTO_PUNCH_OUT_IDLE_MS) {
        doPunchOut(new Date(lastActivityRef.current))
      }
    }, 30_000)
    return () => clearInterval(id)
  }, [punchIn]) // eslint-disable-line react-hooks/exhaustive-deps

  function doPunchOut(_at?: Date) {
    const workdayId = localStorage.getItem(WORKDAY_ID_KEY)
    localStorage.removeItem(WORKDAY_ID_KEY)
    clearPunchIn()
    setPunchIn(null)
    playPunchOut()
    if (workdayId) {
      endWorkday(workdayId, _at ?? new Date())
    }
  }

  const isPunchedIn = punchIn !== null
  const elapsedMs   = isPunchedIn ? now.getTime() - punchIn.getTime() : 0

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
