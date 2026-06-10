/**
 * useAuthCallback — post-OAuth redirect hook.
 *
 * Regression coverage for #67: navigation must fire from inside the
 * onAuthStateChange callback (i.e. after the session is committed),
 * and must land on /cv — not /auth (which would bounce a fresh user
 * back to the login screen).
 */

import { renderHook, act } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'

const navigateMock = jest.fn()
jest.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

let capturedCallback: ((session: Session | null) => void) | null = null
const unsubscribeMock = jest.fn()
jest.mock('@/services/authService', () => ({
  onAuthStateChange: jest.fn((cb: (session: Session | null) => void) => {
    capturedCallback = cb
    return unsubscribeMock
  }),
}))

import { useAuthCallback } from '@/hooks/auth/useAuthCallback'

const fakeSession = { user: { id: 'u1' } } as unknown as Session

beforeEach(() => {
  navigateMock.mockClear()
  unsubscribeMock.mockClear()
  capturedCallback = null
})

describe('useAuthCallback', () => {
  it('subscribes to onAuthStateChange on mount', () => {
    renderHook(() => useAuthCallback())
    expect(capturedCallback).toBeInstanceOf(Function)
  })

  // The race in #67: navigating before the session was committed sent users
  // back to /auth. Driving navigation from the auth-state callback guarantees
  // the session is in place before the redirect fires.
  it('navigates to /cv when a session arrives via auth-state-change', () => {
    renderHook(() => useAuthCallback())
    act(() => { capturedCallback!(fakeSession) })

    expect(navigateMock).toHaveBeenCalledWith('/cv', { replace: true })
  })

  it('does not navigate when the auth-state-change reports a null session', () => {
    renderHook(() => useAuthCallback())
    act(() => { capturedCallback!(null) })

    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useAuthCallback())
    unmount()
    expect(unsubscribeMock).toHaveBeenCalledTimes(1)
  })
})
