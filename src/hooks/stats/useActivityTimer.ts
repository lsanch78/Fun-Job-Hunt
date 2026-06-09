import { useState, useEffect, useRef } from 'react'
import { insertHeartbeat, readHeartbeatCache } from '@/services/activityTimerService'
import type { ActivityTimerState } from '@/types'

const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000 // insert at most once per 15 min
const SESSION_GAP_MS        = 30 * 60 * 1000 // gap > 30 min = new session

function resolveSessionStart(userId: string): Date | null {
  const cached = readHeartbeatCache(userId)
  if (cached.length === 0) return null
  const latest = new Date(cached[0].ts) // cache is newest-first
  if (Date.now() - latest.getTime() > SESSION_GAP_MS) return null
  // Walk back to find the earliest heartbeat in the current contiguous session
  const sorted = [...cached].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
  let sessionStart = latest
  for (let i = sorted.length - 1; i > 0; i--) {
    const gap = new Date(sorted[i].ts).getTime() - new Date(sorted[i - 1].ts).getTime()
    if (gap > SESSION_GAP_MS) {
      sessionStart = new Date(sorted[i].ts)
      break
    }
    sessionStart = new Date(sorted[i - 1].ts)
  }
  return sessionStart
}

export function useActivityTimer(userId: string | null): ActivityTimerState {
  const [sessionStart, setSessionStart] = useState<Date | null>(() =>
    userId ? resolveSessionStart(userId) : null
  )
  const [isActive, setIsActive] = useState(false)

  const lastHeartbeatRef = useRef<number>(
    // Initialise from cache so a page reload doesn't reset the rate-limit clock
    userId && readHeartbeatCache(userId)[0]
      ? new Date(readHeartbeatCache(userId)[0].ts).getTime()
      : 0
  )
  const lastActivityRef = useRef<number>(0)
  const idleTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userId) return
    const uid = userId

    function handleActivity() {
      const now = Date.now()
      lastActivityRef.current = now

      // Mark active and (re)start the idle-detection timer
      setIsActive(true)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        setIsActive(false)
        setSessionStart(null)
      }, SESSION_GAP_MS)

      // Start a new session if we were idle
      setSessionStart((current) => {
        if (current !== null) return current
        return new Date(now)
      })

      // Rate-limit heartbeat inserts to once per HEARTBEAT_INTERVAL_MS
      if (now - lastHeartbeatRef.current < HEARTBEAT_INTERVAL_MS) return
      lastHeartbeatRef.current = now
      insertHeartbeat(uid)
    }

    window.addEventListener('fjobhunt:job-input', handleActivity)
    return () => {
      window.removeEventListener('fjobhunt:job-input', handleActivity)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [userId])

  return { sessionStart, isActive }
}
