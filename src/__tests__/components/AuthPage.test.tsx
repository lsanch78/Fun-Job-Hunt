/**
 * AuthPage — session-gated redirect.
 *
 * Regression coverage for #67: when AuthContext reports a session,
 * AuthPage must redirect to /cv reactively. The previous bug navigated
 * imperatively from useAuthFlow before the session was committed,
 * which raced AuthContext and bounced users back to /auth.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const useAuthMock = jest.fn()
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

// useAuthFlow pulls in audio, sfx, supabase, google one-tap — none of which
// matter for the redirect contract. Stub it to return a minimal title-screen state.
jest.mock('@/hooks/auth/useAuthFlow', () => ({
  useAuthFlow: () => ({
    screen: 'title',
    setScreen: jest.fn(),
    returningName: null,
    email: '',
    setEmail: jest.fn(),
    stayLoggedIn: true,
    setStayLoggedIn: jest.fn(),
    otp: '',
    setOtp: jest.fn(),
    error: null,
    loading: false,
    globalStats: null,
    soundOn: false,
    toggleSound: jest.fn(),
    proceedFromTitle: jest.fn(),
    handleSendOtp: jest.fn(),
    handleVerifyOtp: jest.fn(),
    handleOAuthRedirect: jest.fn(),
  }),
}))

jest.mock('@/lib/sfx', () => ({
  playAuthBlip: jest.fn(),
}))

jest.mock('@/assets/music/1-intro.mp3', () => 'intro.mp3', { virtual: true })

import AuthPage from '@/pages/AuthPage'

const fakeSession = { user: { id: 'u1' } } as unknown as Session

function renderAt(initialEntry = '/auth') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/cv" element={<div>CV PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthMock.mockReset()
})

describe('AuthPage', () => {
  it('redirects to /cv when a session is present', () => {
    useAuthMock.mockReturnValue({ session: fakeSession, userId: 'u1', username: '', email: null, signOut: jest.fn() })
    renderAt()
    expect(screen.getByText('CV PAGE')).toBeInTheDocument()
  })

  it('renders the auth UI when there is no session', () => {
    useAuthMock.mockReturnValue({ session: null, userId: null, username: '', email: null, signOut: jest.fn() })
    renderAt()
    expect(screen.queryByText('CV PAGE')).not.toBeInTheDocument()
    expect(screen.getByText('FJOBHUNT')).toBeInTheDocument()
  })

  // The undefined state is "auth not yet resolved". Treat it the same as
  // null — don't redirect before we know — so we don't flash /cv during boot.
  it('renders the auth UI while session is still resolving', () => {
    useAuthMock.mockReturnValue({ session: undefined, userId: null, username: '', email: null, signOut: jest.fn() })
    renderAt()
    expect(screen.queryByText('CV PAGE')).not.toBeInTheDocument()
    expect(screen.getByText('FJOBHUNT')).toBeInTheDocument()
  })
})
