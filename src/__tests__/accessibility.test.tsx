import { render } from '@testing-library/react'
import { act } from 'react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { MemoryRouter } from 'react-router-dom'

expect.extend(toHaveNoViolations)

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: undefined as undefined,
  }
  // Make the chain itself awaitable (resolves to empty array by default)
  Object.defineProperty(chain, 'then', {
    get() {
      return Promise.resolve({ data: [], error: null }).then.bind(Promise.resolve({ data: [], error: null }))
    },
  })
  return {
    supabase: {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
        onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      },
      from: jest.fn(() => chain),
    },
  }
})

jest.mock('@/lib/SubscriptionContext', () => ({
  useSubscription: jest.fn(() => ({ isSubscribed: false, subscription: null, loading: false, refresh: jest.fn() })),
  SubscriptionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/services/subscriptionService', () => ({
  isSubscribed: jest.fn(() => false),
  fetchSubscription: jest.fn().mockResolvedValue(null),
  createCheckoutSession: jest.fn().mockResolvedValue(undefined),
  openPortalSession: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/services/jobService', () => ({
  fetchJobs: jest.fn().mockResolvedValue([]),
  readCache: jest.fn().mockReturnValue([]),
  writeCache: jest.fn(),
  countJobs: jest.fn().mockResolvedValue(0),
  insertJob: jest.fn().mockResolvedValue({ error: null }),
  updateJob: jest.fn().mockResolvedValue({ error: null }),
  deleteJobs: jest.fn().mockResolvedValue(undefined),
  fetchJobsForExport: jest.fn().mockResolvedValue([]),
  fetchJobDetails: jest.fn().mockResolvedValue(null),
  updateJobDetails: jest.fn().mockResolvedValue({ error: null }),
  deleteAllJobs: jest.fn().mockResolvedValue({ error: null }),
  readAutoGhostSetting: jest.fn().mockReturnValue({ enabled: false, days: 30 }),
  writeAutoGhostSetting: jest.fn(),
  runAutoGhost: jest.fn().mockImplementation((jobs) => Promise.resolve(jobs)),
  JOB_LIMITS: { free: 25, subscribed: 200 },
  JOB_CAP: 1000,
}))

jest.mock('@/services/workdayService', () => ({
  fetchWorkdays: jest.fn().mockResolvedValue([]),
  readWorkdayCache: jest.fn().mockReturnValue([]),
  deleteAllWorkdays: jest.fn().mockResolvedValue(undefined),
  WORKDAY_KEYS: {},
}))

jest.mock('@/services/xpService', () => ({
  calculateXp: jest.fn().mockReturnValue({ xp: 0, rank: 0 }),
  getRankInfo: jest.fn().mockReturnValue({ rank: 0, title: 'Rookie', xpIntoRank: 0, xpForNextRank: 100 }),
}))

jest.mock('@/services/aiService', () => ({
  getAiProvider: jest.fn(() => 'proxy'),
  setAiProvider: jest.fn(),
  getAiApiKey: jest.fn(() => ''),
  setAiApiKey: jest.fn(),
  fetchUsage: jest.fn().mockResolvedValue({ count: 0, limit: 20 }),
  fetchModels: jest.fn().mockResolvedValue([]),
  streamCompletion: jest.fn(),
  AI_MONTHLY_LIMIT: 20,
  AI_MONTHLY_LIMIT_BASE: 20,
  AI_MONTHLY_LIMIT_RANK5: 40,
  AI_MONTHLY_LIMIT_RANK7: 60,
}))

jest.mock('@/services/globalStatsService', () => ({
  startStatsPoll: jest.fn(() => () => {}),
}))

jest.mock('@/lib/sfx', () => ({
  isSfxMuted: jest.fn(() => true),
  playPageFlip: jest.fn(),
  playSpellCast: jest.fn(),
  playAiConsume: jest.fn(),
  playAiDing: jest.fn(),
  playCreditsChime: jest.fn(),
  playLinkBlip: jest.fn(),
  playStoryChime: jest.fn(),
  playFanfare: jest.fn(),
  startTerminalHum: jest.fn(() => () => {}),
  playAuthBlip: jest.fn(),
  playProgressChime: jest.fn(),
  playCelebrationFanfare: jest.fn(),
  playThud: jest.fn(),
  playDeleteBump: jest.fn(),
  playSelectClick: jest.fn(),
  playScratchOpen: jest.fn(),
  playScratchClose: jest.fn(),
  playTrash: jest.fn(),
}))

jest.mock('pixelarticons/react', () => {
  const Stub = () => <svg data-testid="icon" aria-hidden="true" />
  return new Proxy({}, { get: () => Stub })
})

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import AuthPage from '@/pages/AuthPage'
import JobLogPage from '@/pages/JobLogPage'
import StatsPage from '@/pages/StatsPage'
import StoryPage from '@/pages/StoryPage'
import SettingsPage from '@/pages/SettingsPage'
import CreditsPage from '@/pages/CreditsPage'
import { ThemeProvider } from '@/lib/ThemeContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_USER_ID = 'test-user-id'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <ThemeProvider>{children}</ThemeProvider>
    </MemoryRouter>
  )
}

const pages = [
  { name: 'AuthPage',     element: <AuthPage /> },
  { name: 'JobLogPage',   element: <JobLogPage userId={MOCK_USER_ID} userName="Test" /> },
  { name: 'StatsPage',    element: <StatsPage userId={MOCK_USER_ID} /> },
  { name: 'StoryPage',    element: <StoryPage userId={MOCK_USER_ID} /> },
  { name: 'SettingsPage', element: <SettingsPage /> },
  { name: 'CreditsPage',  element: <CreditsPage /> },
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe.each(pages)('$name accessibility', ({ name, element }) => {
  it(`${name} has no axe violations`, async () => {
    let container: HTMLElement
    await act(async () => {
      ;({ container } = render(element, { wrapper: Wrapper }))
    })
    const results = await axe(container!)
    expect(results).toHaveNoViolations()
  })
})
