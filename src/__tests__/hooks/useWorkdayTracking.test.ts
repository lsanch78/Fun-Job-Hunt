import { renderHook, act } from '@testing-library/react'
import { useWorkdayTracking } from '@/hooks/stats/useWorkdayTracking'
import { WORKDAY } from '@/config/game'

// ── Service mocks ─────────────────────────────────────────────────────────────

jest.mock('@/services/workdayService', () => ({
  startWorkday: jest.fn(async () => 'wd-new'),
  endWorkday:   jest.fn(async () => {}),
}))

// sfx must be mocked — it tries to use the Web Audio API which isn't in jsdom
jest.mock('@/lib/sfx', () => ({
  playPunchIn:  jest.fn(),
  playPunchOut: jest.fn(),
}))

import { startWorkday, endWorkday } from '@/services/workdayService'
import { playPunchIn, playPunchOut } from '@/lib/sfx'

const IDLE_MS = WORKDAY.AUTO_PUNCH_OUT_IDLE_MS // 15 minutes
const USER_ID = 'u1'

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// ── resetActivity — punch-in ──────────────────────────────────────────────────

describe('resetActivity — punch-in', () => {
  // First job-input activity auto-starts a workday session — no manual punch-in needed.
  it('punches in on first call and starts a workday in the DB', async () => {
    const { result } = renderHook(() => useWorkdayTracking(USER_ID))

    expect(result.current.isPunchedIn).toBe(false)

    await act(async () => { result.current.resetActivity() })

    expect(result.current.isPunchedIn).toBe(true)
    expect(result.current.punchIn).toBeInstanceOf(Date)
    expect(startWorkday).toHaveBeenCalledWith(USER_ID, expect.any(Date))
    expect(playPunchIn).toHaveBeenCalled()
  })

  // Submitting multiple jobs must not open duplicate sessions.
  it('does not punch in again when already punched in', async () => {
    const { result } = renderHook(() => useWorkdayTracking(USER_ID))

    await act(async () => { result.current.resetActivity() })
    await act(async () => { result.current.resetActivity() })

    expect(startWorkday).toHaveBeenCalledTimes(1)
  })

  // No userId means auth hasn't resolved — must not write to the DB.
  it('does not punch in when userId is null', async () => {
    const { result } = renderHook(() => useWorkdayTracking(null))

    await act(async () => { result.current.resetActivity() })

    expect(result.current.isPunchedIn).toBe(false)
    expect(startWorkday).not.toHaveBeenCalled()
  })

  // lastActivityRef must always update, even when already punched in —
  // it's the reference point for the idle timer.
  it('updates lastActivityRef on every call', async () => {
    const { result } = renderHook(() => useWorkdayTracking(USER_ID))

    const before = result.current.lastActivityRef.current
    jest.advanceTimersByTime(5000)

    act(() => { result.current.resetActivity() })

    expect(result.current.lastActivityRef.current).toBeGreaterThan(before)
  })
})

// ── auto punch-out — abandoned session ───────────────────────────────────────

describe('auto punch-out after 15 minutes of inactivity', () => {
  // Core invariant: session is closed automatically if the user stops submitting jobs.
  it('punches out after IDLE_MS with no activity', async () => {
    const { result } = renderHook(() => useWorkdayTracking(USER_ID))

    await act(async () => { result.current.resetActivity() })
    expect(result.current.isPunchedIn).toBe(true)

    // Advance past the idle threshold — the 30s interval fires and detects idle
    await act(async () => { jest.advanceTimersByTime(IDLE_MS + 30_000) })

    expect(result.current.isPunchedIn).toBe(false)
    expect(endWorkday).toHaveBeenCalled()
    expect(playPunchOut).toHaveBeenCalled()
  })

  // Punch-out timestamp must be the last activity time, not the moment the timer fired —
  // so the workday record reflects actual work time, not idle time.
  it('punches out with the last-activity timestamp, not the current time', async () => {
    const { result } = renderHook(() => useWorkdayTracking(USER_ID))

    await act(async () => { result.current.resetActivity() })
    const lastActivity = result.current.lastActivityRef.current

    await act(async () => { jest.advanceTimersByTime(IDLE_MS + 30_000) })

    const punchOutArg = (endWorkday as jest.Mock).mock.calls[0][1] as Date
    expect(punchOutArg.getTime()).toBe(lastActivity)
  })

  // Activity within the window must reset the clock and keep the session alive.
  it('does not punch out when activity happens within the idle window', async () => {
    const { result } = renderHook(() => useWorkdayTracking(USER_ID))

    await act(async () => { result.current.resetActivity() })

    // Simulate job activity at 10 minutes — under the 15-minute threshold
    await act(async () => { jest.advanceTimersByTime(10 * 60 * 1000) })
    act(() => { result.current.resetActivity() })

    // Advance another 10 minutes (20 min total, but only 10 since last activity)
    await act(async () => { jest.advanceTimersByTime(10 * 60 * 1000) })

    expect(result.current.isPunchedIn).toBe(true)
    expect(endWorkday).not.toHaveBeenCalled()
  })

  // The idle interval must not run while not punched in — avoids unnecessary polling.
  it('does not auto punch-out when not punched in', async () => {
    renderHook(() => useWorkdayTracking(USER_ID))

    await act(async () => { jest.advanceTimersByTime(IDLE_MS + 30_000) })

    expect(endWorkday).not.toHaveBeenCalled()
  })
})

// ── doPunchOut ────────────────────────────────────────────────────────────────

describe('doPunchOut', () => {
  // Manual punch-out clears all state and persists the close time.
  it('clears punchIn state, calls endWorkday, and plays sound', async () => {
    const { result } = renderHook(() => useWorkdayTracking(USER_ID))

    await act(async () => { result.current.resetActivity() })
    // Wait for startWorkday to resolve and store the id
    await act(async () => {})

    act(() => { result.current.doPunchOut() })

    expect(result.current.isPunchedIn).toBe(false)
    expect(result.current.punchIn).toBeNull()
    expect(endWorkday).toHaveBeenCalled()
    expect(playPunchOut).toHaveBeenCalled()
  })

  // If startWorkday failed and no id was stored, punch-out must still clean up state.
  it('clears state cleanly even when no workdayId is stored', async () => {
    ;(startWorkday as jest.Mock).mockResolvedValueOnce(null)
    const { result } = renderHook(() => useWorkdayTracking(USER_ID))

    await act(async () => { result.current.resetActivity() })
    await act(async () => {})

    act(() => { result.current.doPunchOut() })

    expect(result.current.isPunchedIn).toBe(false)
    // endWorkday is only called when a workdayId exists — no id means no DB call
    expect(endWorkday).not.toHaveBeenCalled()
  })
})

// ── fjobhunt:job-input event ──────────────────────────────────────────────────

describe('fjobhunt:job-input window event', () => {
  // The hook wires up a global event listener so any component can trigger activity
  // without being directly coupled to the hook.
  it('calls resetActivity when the event fires', async () => {
    const { result } = renderHook(() => useWorkdayTracking(USER_ID))

    await act(async () => {
      window.dispatchEvent(new Event('fjobhunt:job-input'))
    })

    expect(result.current.isPunchedIn).toBe(true)
    expect(startWorkday).toHaveBeenCalled()
  })
})
