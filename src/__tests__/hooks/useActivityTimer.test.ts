import { renderHook, act } from '@testing-library/react'
import { useActivityTimer } from '@/hooks/stats/useActivityTimer'

// ── Service mock ──────────────────────────────────────────────────────────────

jest.mock('@/services/activityTimerService', () => ({
  insertHeartbeat:    jest.fn(async () => 'hb-new'),
  fetchHeartbeats:    jest.fn(async () => []),
  readHeartbeatCache: jest.fn(() => []),
}))

import { insertHeartbeat, readHeartbeatCache } from '@/services/activityTimerService'

const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes
const SESSION_GAP_MS        = 30 * 60 * 1000 // 30 minutes
const USER_ID = 'u1'

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  ;(readHeartbeatCache as jest.Mock).mockReturnValue([])
})

afterEach(() => {
  jest.useRealTimers()
})

// ── initial state ─────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('sessionStart is null when no cached heartbeats', () => {
    const { result } = renderHook(() => useActivityTimer(USER_ID))
    expect(result.current.sessionStart).toBeNull()
  })

  it('isActive is false on mount', () => {
    const { result } = renderHook(() => useActivityTimer(USER_ID))
    expect(result.current.isActive).toBe(false)
  })

  it('sessionStart is set from cache when recent heartbeats exist', () => {
    const recentTs = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 min ago
    ;(readHeartbeatCache as jest.Mock).mockReturnValue([
      { id: 'hb-1', user_id: USER_ID, ts: recentTs },
    ])

    const { result } = renderHook(() => useActivityTimer(USER_ID))
    expect(result.current.sessionStart).toBeInstanceOf(Date)
    expect(result.current.sessionStart!.toISOString()).toBe(recentTs)
  })

  it('sessionStart is null when cached heartbeats are older than SESSION_GAP_MS', () => {
    const oldTs = new Date(Date.now() - SESSION_GAP_MS - 1000).toISOString()
    ;(readHeartbeatCache as jest.Mock).mockReturnValue([
      { id: 'hb-1', user_id: USER_ID, ts: oldTs },
    ])

    const { result } = renderHook(() => useActivityTimer(USER_ID))
    expect(result.current.sessionStart).toBeNull()
  })
})

// ── heartbeat on activity ─────────────────────────────────────────────────────

describe('heartbeat firing', () => {
  it('inserts a heartbeat on first job-input event', async () => {
    renderHook(() => useActivityTimer(USER_ID))

    await act(async () => {
      window.dispatchEvent(new Event('fjobhunt:job-input'))
    })

    expect(insertHeartbeat).toHaveBeenCalledWith(USER_ID)
    expect(insertHeartbeat).toHaveBeenCalledTimes(1)
  })

  it('does not insert a second heartbeat within 15 minutes', async () => {
    renderHook(() => useActivityTimer(USER_ID))

    await act(async () => { window.dispatchEvent(new Event('fjobhunt:job-input')) })
    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000) // 5 min later
      window.dispatchEvent(new Event('fjobhunt:job-input'))
    })

    expect(insertHeartbeat).toHaveBeenCalledTimes(1)
  })

  it('inserts a second heartbeat after 15 minutes of activity', async () => {
    renderHook(() => useActivityTimer(USER_ID))

    await act(async () => { window.dispatchEvent(new Event('fjobhunt:job-input')) })
    await act(async () => {
      jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS)
      window.dispatchEvent(new Event('fjobhunt:job-input'))
    })

    expect(insertHeartbeat).toHaveBeenCalledTimes(2)
  })

  it('does not insert a heartbeat when userId is null', async () => {
    renderHook(() => useActivityTimer(null))

    await act(async () => { window.dispatchEvent(new Event('fjobhunt:job-input')) })

    expect(insertHeartbeat).not.toHaveBeenCalled()
  })

  it('multiple rapid events only insert one heartbeat', async () => {
    renderHook(() => useActivityTimer(USER_ID))

    await act(async () => {
      window.dispatchEvent(new Event('fjobhunt:job-input'))
      window.dispatchEvent(new Event('fjobhunt:job-input'))
      window.dispatchEvent(new Event('fjobhunt:job-input'))
    })

    expect(insertHeartbeat).toHaveBeenCalledTimes(1)
  })
})

// ── isActive ──────────────────────────────────────────────────────────────────

describe('isActive', () => {
  it('becomes true after first activity event', async () => {
    const { result } = renderHook(() => useActivityTimer(USER_ID))

    await act(async () => { window.dispatchEvent(new Event('fjobhunt:job-input')) })

    expect(result.current.isActive).toBe(true)
  })

  it('remains true within SESSION_GAP_MS of last activity', async () => {
    const { result } = renderHook(() => useActivityTimer(USER_ID))

    await act(async () => { window.dispatchEvent(new Event('fjobhunt:job-input')) })
    await act(async () => { jest.advanceTimersByTime(SESSION_GAP_MS - 1000) })

    expect(result.current.isActive).toBe(true)
  })

  it('becomes false after SESSION_GAP_MS with no activity', async () => {
    const { result } = renderHook(() => useActivityTimer(USER_ID))

    await act(async () => { window.dispatchEvent(new Event('fjobhunt:job-input')) })
    await act(async () => { jest.advanceTimersByTime(SESSION_GAP_MS + 60_000) })

    expect(result.current.isActive).toBe(false)
  })
})

// ── sessionStart ──────────────────────────────────────────────────────────────

describe('sessionStart', () => {
  it('is set to the first heartbeat time after activity', async () => {
    const { result } = renderHook(() => useActivityTimer(USER_ID))

    const before = Date.now()
    await act(async () => { window.dispatchEvent(new Event('fjobhunt:job-input')) })
    const after = Date.now()

    expect(result.current.sessionStart).toBeInstanceOf(Date)
    expect(result.current.sessionStart!.getTime()).toBeGreaterThanOrEqual(before)
    expect(result.current.sessionStart!.getTime()).toBeLessThanOrEqual(after)
  })

  it('does not reset sessionStart on subsequent activity within the same session', async () => {
    const { result } = renderHook(() => useActivityTimer(USER_ID))

    await act(async () => { window.dispatchEvent(new Event('fjobhunt:job-input')) })
    const firstStart = result.current.sessionStart

    await act(async () => {
      jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS)
      window.dispatchEvent(new Event('fjobhunt:job-input'))
    })

    expect(result.current.sessionStart).toEqual(firstStart)
  })

  it('resets sessionStart after SESSION_GAP_MS and new activity begins', async () => {
    const { result } = renderHook(() => useActivityTimer(USER_ID))

    await act(async () => { window.dispatchEvent(new Event('fjobhunt:job-input')) })
    const firstStart = result.current.sessionStart

    // Gap longer than SESSION_GAP_MS
    await act(async () => { jest.advanceTimersByTime(SESSION_GAP_MS + 60_000) })

    // New activity starts a new session
    await act(async () => { window.dispatchEvent(new Event('fjobhunt:job-input')) })

    expect(result.current.sessionStart).not.toEqual(firstStart)
    expect(result.current.sessionStart!.getTime()).toBeGreaterThan(firstStart!.getTime())
  })
})
