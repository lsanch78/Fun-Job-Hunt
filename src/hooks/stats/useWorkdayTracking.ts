import { useState, useEffect, useRef, useCallback } from 'react'
import { WORKDAY } from '@/config/game'
import { startWorkday, endWorkday } from '@/services/workdayService'
import { playPunchIn, playPunchOut } from '@/lib/sfx'
import { lsGet, lsSet, lsRemove } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'

// ── Storage helpers (private to this module) ──────────────────────────────────

function savePunchIn(isoString: string) {
  lsSet(SK.workdayPunchIn, isoString)
}

function loadPunchIn(): Date | null {
  const raw = lsGet<string | null>(SK.workdayPunchIn, null)
    ?? lsGet<string | null>('workday_punch_in', null)  // legacy key
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function clearPunchIn() {
  lsRemove(SK.workdayPunchIn)
  lsRemove('workday_punch_in')  // legacy key
}

// ── Hook ──────────────────────────────────────────────────────────────────────

import type { WorkdayTrackingState } from '@/types'

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
  // Initialise from the stored punch-in time, not Date.now() — otherwise a page
  // reload resets the idle clock and stale sessions never auto-close.
  const lastActivityRef = useRef<number>(loadPunchIn()?.getTime() ?? Date.now())

  // ── Punch-out ───────────────────────────────────────────────────────────────

  const doPunchOut = useCallback((at?: Date) => {
    const workdayId = lsGet<string | null>(SK.workdayId, null)
      ?? lsGet<string | null>('workday_id', null)  // legacy key
    lsRemove(SK.workdayId)
    lsRemove('workday_id')  // legacy key
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
      if (!(lsGet<string | null>(SK.workdayId, null) ?? lsGet<string | null>('workday_id', null))) {
        lsSet(SK.workdayId, 'pending')
        startWorkday(userId, t).then((id) => {
          if (id) lsSet(SK.workdayId, id)
          else lsRemove(SK.workdayId)
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
