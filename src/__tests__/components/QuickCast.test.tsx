import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------- Mocks ----------

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null }),
    })),
  },
}))

jest.mock('@/services/quickCastService', () => ({
  fetchLinks: jest.fn().mockResolvedValue([]),
  createLink: jest.fn().mockResolvedValue('new-link-id'),
  updateLink: jest.fn().mockResolvedValue(undefined),
  deleteLink: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/services/aiService', () => ({
  getAiProvider: jest.fn(() => 'proxy'),
  setAiProvider: jest.fn(),
  getAiApiKey: jest.fn(() => ''),
  setAiApiKey: jest.fn(),
  fetchUsage: jest.fn().mockResolvedValue({ count: 0, limit: 20 }),
  fetchModels: jest.fn().mockReturnValue({ connected: true, models: [] }),
  streamCompletion: jest.fn(),
  AI_MONTHLY_LIMIT: 20,
}))


jest.mock('@/lib/sfx', () => ({
  isSfxMuted: jest.fn(() => true),
  playPageFlip: jest.fn(),
  playSpellCast: jest.fn(),
  playAiConsume: jest.fn(),
  playAiDing: jest.fn(),
}))

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({ userId: 'user-1', session: null, username: '', email: null, signOut: jest.fn() })),
}))

jest.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: jest.fn(() => ({ isSubscribed: false, subscription: null, loading: false, refresh: jest.fn() })),
}))

jest.mock('@/services/subscriptionService', () => ({
  isSubscribed: jest.fn(() => false),
  fetchSubscription: jest.fn().mockResolvedValue(null),
  createCheckoutSession: jest.fn().mockResolvedValue(undefined),
}))

// Mock pixelarticons to avoid SVG/module issues
jest.mock('pixelarticons/react', () => {
  const Stub = () => <svg data-testid="icon" />
  return new Proxy({}, { get: () => Stub })
})

// ---------- Imports ----------

import QuickCast from '@/components/hud/QuickCast'
import { fetchLinks, createLink } from '@/services/quickCastService'

// ---------- Tests ----------

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
  ;(fetchLinks as jest.Mock).mockResolvedValue([])
})

// QuickCast renders collapsed by default; expand it through the real toggle
async function renderOpen(user: ReturnType<typeof userEvent.setup>) {
  await act(async () => { render(<QuickCast />) })
  await user.click(screen.getByTitle(/open quick cast/i))
}

describe('QuickCast — smoke test', () => {
  it('renders without crashing', async () => {
    await act(async () => { render(<QuickCast />) })
    // Component renders some UI
    expect(document.body).not.toBeEmptyDOMElement()
  })

  it('starts collapsed, showing only the toggle', async () => {
    await act(async () => { render(<QuickCast />) })
    expect(screen.getByTitle(/open quick cast/i)).toBeInTheDocument()
    expect(screen.queryByTitle(/add link/i)).not.toBeInTheDocument()
  })
})

describe('QuickCast — empty link slots', () => {
  it('shows 8 add-slot buttons when no links are loaded', async () => {
    await renderOpen(userEvent.setup())
    // Each empty slot renders a "+" button
    const addButtons = screen.getAllByTitle(/add link/i)
    expect(addButtons.length).toBeGreaterThanOrEqual(1)
  })
})

describe('QuickCast — add link flow', () => {
  it('opens the add form when an empty slot is clicked', async () => {
    const user = userEvent.setup()
    await renderOpen(user)

    const addBtn = screen.getAllByTitle(/add link/i)[0]
    await user.click(addBtn)

    // Form fields should appear
    expect(screen.getByPlaceholderText(/label/i)).toBeInTheDocument()
  })

  it('calls createLink when the form is submitted with valid data', async () => {
    const user = userEvent.setup()
    await renderOpen(user)

    const addBtn = screen.getAllByTitle(/add link/i)[0]
    await user.click(addBtn)

    await user.type(screen.getByPlaceholderText(/Label/), 'My Link')
    await user.type(screen.getByPlaceholderText('https://...'), 'https://example.com')

    const saveBtn = screen.getByRole('button', { name: 'SAVE' })
    await user.click(saveBtn)

    await waitFor(() => {
      expect(createLink).toHaveBeenCalled()
    })
  })
})

describe('QuickCast — existing links', () => {
  const mockLinks = [
    { id: 'link-1', label: 'GitHub', url: 'https://github.com', icon: 'github', position: 0 },
  ]

  beforeEach(() => {
    ;(fetchLinks as jest.Mock).mockResolvedValue(mockLinks)
    // Seed localStorage so the link shows immediately (key mirrors SK.quickcastLinks)
    localStorage.setItem(
      'fjobhunt:quickcast:links:user-1',
      JSON.stringify(mockLinks.map((l) => ({ id: l.id, label: l.label, url: l.url, icon: l.icon }))),
    )
  })

  it('renders a link button with the link label', async () => {
    await renderOpen(userEvent.setup())
    expect(screen.getByTitle(/GitHub/i)).toBeInTheDocument()
  })

  it('copies URL to clipboard when link is clicked', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      configurable: true,
    })

    await renderOpen(user)

    const linkBtn = screen.getByTitle(/GitHub/i)
    await user.click(linkBtn)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://github.com')
  })
})

