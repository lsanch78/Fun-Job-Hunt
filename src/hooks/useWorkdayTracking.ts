import { useState, useEffect, useRef, useCallback } from 'react'
import { WORKDAY } from '@/config/game'
import { startWorkday, endWorkday } from '@/services/workdayService'
import { playPunchIn, playPunchOut } from '@/lib/sfx'
import { WORKDAY_KEYS } from '@/lib/workdayKeys'

// ── Storage helpers (private to this module) ──────────────────────────────────

function savePunchIn(isoString: string) {
  localStorage.setItem(WORKDAY_KEYS.punchIn, isoString)
}

function loadPunchIn(): Date | null {
  const raw = localStorage.getItem(WORKDAY_KEYS.punchIn)
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function clearPunchIn() {
  localStorage.removeItem(WORKDAY_KEYS.punchIn)
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface WorkdayTrackingState {
  punchIn: Date | null
  isPunchedIn: boolean
  lastActivityRef: React.RefObject<number>
  resetActivity: () => void
  doPunchOut: (at?: Date) => void
}

/**
 * Owns all workday tracking logic: punch-in/out, auto punch-out on idle,
 * activity reset, and DB sync via workdayService.
 *
 * Requires userId from the caller — no internal auth calls.
 * Pass null when the session is not yet resolved; the hook no-ops until
 * a non-null userId is provided.
 */
export function useWorkdayTracking(userId: string | null): WorkdayTrackingState {
  const [punchIn, setPunchIn] = useState<Date | null>(() => loadPunchIn())
  const lastActivityRef = useRef<number>(Date.now())

  // ── Punch-out ───────────────────────────────────────────────────────────────

  const doPunchOut = useCallback((at?: Date) => {
    const workdayId = localStorage.getItem(WORKDAY_KEYS.workdayId)
    localStorage.removeItem(WORKDAY_KEYS.workdayId)
    clearPunchIn()
    setPunchIn(null)
    playPunchOut()
    if (workdayId) {
      endWorkday(workdayId, at ?? new Date())
    }
  }, [])

  // ── Activity reset + auto punch-in ─────────────────────────────────────────

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    if (!userId) return

    setPunchIn((current) => {
      if (current !== null) return current
      const t = new Date()
      savePunchIn(t.toISOString())
      playPunchIn()
      if (!localStorage.getItem(WORKDAY_KEYS.workdayId)) {
        localStorage.setItem(WORKDAY_KEYS.workdayId, 'pending')
        startWorkday(userId, t).then((id) => {
          if (id) localStorage.setItem(WORKDAY_KEYS.workdayId, id)
          else localStorage.removeItem(WORKDAY_KEYS.workdayId)
        })
      }
      return t
    })
  }, [userId])

  // ── Listen for job-input activity events ───────────────────────────────────

  useEffect(() => {
    const handler = () => resetActivity()
    window.addEventListener('fjobhunt:job-input', handler)
    return () => window.removeEventListener('fjobhunt:job-input', handler)
  }, [resetActivity])

  // ── Auto punch-out on idle ──────────────────────────────────────────────────

  useEffect(() => {
    if (!punchIn) return
    const id = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current
      if (idleMs >= WORKDAY.AUTO_PUNCH_OUT_IDLE_MS) {
        doPunchOut(new Date(lastActivityRef.current))
      }
    }, 30_000)
    return () => clearInterval(id)
  }, [punchIn, doPunchOut])

  return {
    punchIn,
    isPunchedIn: punchIn !== null,
    lastActivityRef,
    resetActivity,
    doPunchOut,
  }
}
