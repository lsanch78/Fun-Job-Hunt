/**
 * Integration: AI usage flow
 *
 * Exercises AiContext together with its consumers (WorkdayBar.AiCredits) to
 * verify:
 *   1. credit count refreshes after a successful AI call
 *   2. provider switch propagates immediately to consumers
 *   3. limit-reached error opens the modal (and is suppressed for Pro users)
 *   4. Pro subscription bypass shows "Unlimited AI Credits" regardless of count
 *
 * External dependencies are mocked at the service boundary.
 */

import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Service mocks ────────────────────────────────────────────────────────────

// supabase module uses import.meta.env (Vite); stub it so Jest can parse the
// transitive imports pulled in by WorkdayBar (useActivityTimer → activityTimerService).
jest.mock('@/lib/supabase', () => ({ supabase: {} }))

let mockProvider: 'proxy' | 'openai' | 'anthropic' = 'proxy'
let mockUsage: { count: number; limit: number; period: string } | null = { count: 5, limit: 30, period: '2026-06' }
let mockStreamBehavior: 'success' | 'limit-error' = 'success'

jest.mock('@/services/aiService', () => ({
  getAiProvider:    jest.fn(() => mockProvider),
  setAiProvider:    jest.fn((p: 'proxy' | 'openai' | 'anthropic') => { mockProvider = p }),
  getAiApiKey:      jest.fn(() => 'fake-key'),
  setAiApiKey:      jest.fn(),
  fetchUsage:       jest.fn(async () => mockUsage),
  fetchModels:      jest.fn(() => ({ connected: true, models: ['claude-sonnet-4-5'] })),
  streamCompletion: jest.fn(async (params: { onDone: () => void; onError: (m: string) => void; onToken?: (t: string) => void }) => {
    if (mockStreamBehavior === 'limit-error') {
      params.onError('Monthly limit reached (30/30). Add your own API key in Settings to continue.')
      return
    }
    params.onToken?.('hello')
    params.onDone()
  }),
  AI_MONTHLY_LIMIT: 30,
}))

let mockIsSubscribed = false

jest.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: jest.fn(() => ({
    isSubscribed: mockIsSubscribed,
    subscription: null,
    loading:      false,
    refresh:      jest.fn(),
  })),
}))

jest.mock('@/services/subscriptionService', () => ({
  createCheckoutSession: jest.fn(async () => {}),
  openPortalSession:     jest.fn(async () => {}),
}))

jest.mock('@/lib/sfx', () => ({
  playAiConsume: jest.fn(),
  playAiDing:    jest.fn(),
  playPageFlip:  jest.fn(),
  playCloseBlip: jest.fn(),
  playSpellCast: jest.fn(),
  isSfxMuted:    jest.fn(() => true),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { AiProvider, useAI } from '@/contexts/AiContext'
import { AiCredits } from '@/components/hud/WorkdayBar'
import { fetchUsage, streamCompletion } from '@/services/aiService'

// ── Test harness ─────────────────────────────────────────────────────────────

/**
 * Tiny consumer that exposes `run` and `setProvider` via buttons so tests can
 * trigger them through real user-event clicks (no direct context access).
 */
function TestHarness() {
  const { run, setProvider, aiProvider, usage } = useAI()

  return (
    <div>
      <AiCredits />
      <div data-testid="provider">{aiProvider}</div>
      <div data-testid="usage-count">{usage?.count ?? 'null'}</div>
      <button onClick={() => run({ system: 'sys', prompt: 'p', onComplete: () => {} })}>
        run-ai
      </button>
      <button onClick={() => setProvider('openai')}>switch-to-openai</button>
      <button onClick={() => setProvider('proxy')}>switch-to-proxy</button>
    </div>
  )
}

function renderApp() {
  return render(
    <AiProvider>
      <TestHarness />
    </AiProvider>,
  )
}

beforeEach(() => {
  mockProvider        = 'proxy'
  mockUsage           = { count: 5, limit: 30, period: '2026-06' }
  mockStreamBehavior  = 'success'
  mockIsSubscribed    = false
  jest.clearAllMocks()
})

// ── 1. Live credit refresh ───────────────────────────────────────────────────

describe('Live credit refresh', () => {
  it('decrements the displayed credits after a successful AI call without remount', async () => {
    const user = userEvent.setup()
    renderApp()

    // Initial usage fetched on mount: 5/30 → 25 remaining
    await waitFor(() => expect(screen.getByText('25 AI Credits Remaining')).toBeInTheDocument())

    // After the call, the backend reports 6 used
    mockUsage = { count: 6, limit: 30, period: '2026-06' }
    await user.click(screen.getByRole('button', { name: 'run-ai' }))

    await waitFor(() => expect(screen.getByText('24 AI Credits Remaining')).toBeInTheDocument())
    expect(streamCompletion).toHaveBeenCalledTimes(1)
    // fetchUsage called once on mount + once after the successful call
    expect(fetchUsage).toHaveBeenCalledTimes(2)
  })

  it('does not refresh usage when the AI call errors with a non-limit error', async () => {
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(screen.getByText('25 AI Credits Remaining')).toBeInTheDocument())

    // Force a generic stream error (not a limit error)
    ;(streamCompletion as jest.Mock).mockImplementationOnce(async (params: { onError: (m: string) => void }) => {
      params.onError('Network error')
    })

    await user.click(screen.getByRole('button', { name: 'run-ai' }))

    // Still showing original count; no refresh fired
    await waitFor(() => expect(fetchUsage).toHaveBeenCalledTimes(1))
    expect(screen.getByText('25 AI Credits Remaining')).toBeInTheDocument()
  })
})

// ── 2. Provider switch propagation ───────────────────────────────────────────

describe('Provider switch propagation', () => {
  it('hides AiCredits immediately when provider switches away from proxy', async () => {
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(screen.getByText('25 AI Credits Remaining')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'switch-to-openai' }))

    expect(screen.getByTestId('provider').textContent).toBe('openai')
    expect(screen.queryByText(/AI Credits Remaining/)).not.toBeInTheDocument()
  })

  it('refetches usage when provider switches back to proxy', async () => {
    const user = userEvent.setup()
    renderApp()
    await waitFor(() => expect(fetchUsage).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'switch-to-openai' }))
    // Backend updates while user is on byo
    mockUsage = { count: 12, limit: 30, period: '2026-06' }

    await user.click(screen.getByRole('button', { name: 'switch-to-proxy' }))

    await waitFor(() => expect(screen.getByText('18 AI Credits Remaining')).toBeInTheDocument())
    expect(fetchUsage).toHaveBeenCalledTimes(2)
  })
})

// ── 3. Limit-reached flow ────────────────────────────────────────────────────

describe('Limit-reached flow', () => {
  it('opens the limit modal when a free user hits the monthly limit', async () => {
    const user = userEvent.setup()
    mockUsage          = { count: 30, limit: 30, period: '2026-06' }
    mockStreamBehavior = 'limit-error'
    renderApp()

    await waitFor(() => expect(screen.getByText(/No AI Credits Remaining/)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'run-ai' }))

    await waitFor(() => expect(screen.getByText('AI LIMIT REACHED')).toBeInTheDocument())
  })

  it('does not open the limit modal for Pro users even when the call errors with a limit message', async () => {
    const user = userEvent.setup()
    mockIsSubscribed   = true
    mockStreamBehavior = 'limit-error'
    renderApp()

    await user.click(screen.getByRole('button', { name: 'run-ai' }))

    // Give the modal a chance to appear; it should not
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(screen.queryByText('AI LIMIT REACHED')).not.toBeInTheDocument()
  })
})

// ── 4 & 5. Subscription bypass display ───────────────────────────────────────

describe('Pro subscription bypass display', () => {
  it.each([
    ['0 / 30',  { count: 0,  limit: 30, period: '2026-06' }],
    ['15 / 30', { count: 15, limit: 30, period: '2026-06' }],
    ['30 / 30', { count: 30, limit: 30, period: '2026-06' }],
    ['drifted 42 / 30', { count: 42, limit: 30, period: '2026-06' }],
  ])('shows "Unlimited AI Credits" for Pro user with usage %s', async (_label, usage) => {
    mockIsSubscribed = true
    mockUsage        = usage
    renderApp()

    await waitFor(() => expect(screen.getByText('Unlimited AI Credits')).toBeInTheDocument())
    expect(screen.queryByText(/Credits Remaining/)).not.toBeInTheDocument()
  })
})

// ── Silence "act" noise on the initial mount-effect refresh ──────────────────
// AiContext's mount effect kicks off an async fetchUsage; without an explicit
// settle the tests still pass but log act() warnings.
afterEach(async () => {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
})
