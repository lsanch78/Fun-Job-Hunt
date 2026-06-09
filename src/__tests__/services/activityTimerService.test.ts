import {
  readHeartbeatCache,
  insertHeartbeat,
  fetchHeartbeats,
  deleteAllHeartbeats,
} from '@/services/activityTimerService'
import type { ActivityHeartbeat } from '@/types'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

import { supabase } from '@/lib/supabase'
const mockFrom = supabase.from as jest.Mock

function makeChain(terminal: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['select', 'insert', 'delete', 'eq', 'order', 'single']
  methods.forEach((m) => { chain[m] = jest.fn(() => chain) })
  Object.assign(chain, terminal)
  mockFrom.mockReturnValue(chain)
  return chain
}

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
})

const USER_ID = 'u1'

function makeHeartbeat(overrides: Partial<ActivityHeartbeat> = {}): ActivityHeartbeat {
  return {
    id: 'hb-1',
    user_id: USER_ID,
    ts: '2025-06-01T09:00:00.000Z',
    ...overrides,
  }
}

// ── readHeartbeatCache ────────────────────────────────────────────────────────

describe('readHeartbeatCache', () => {
  it('returns [] when localStorage has no entry', () => {
    expect(readHeartbeatCache(USER_ID)).toEqual([])
  })

  it('returns stored rows after fetchHeartbeats populates the cache', async () => {
    const hb = makeHeartbeat()
    makeChain({
      order: jest.fn().mockResolvedValue({ data: [hb], error: null }),
    })
    await fetchHeartbeats(USER_ID)
    expect(readHeartbeatCache(USER_ID)).toEqual([hb])
  })

  it('returns [] when stored value is not an array', () => {
    localStorage.setItem(`fjobhunt:activity-heartbeats:${USER_ID}`, JSON.stringify('oops'))
    expect(readHeartbeatCache(USER_ID)).toEqual([])
  })
})

// ── insertHeartbeat ───────────────────────────────────────────────────────────

describe('insertHeartbeat', () => {
  it('inserts a row with the correct user_id', async () => {
    const chain = makeChain({ single: jest.fn().mockResolvedValue({ data: { id: 'hb-99' }, error: null }) })

    await insertHeartbeat(USER_ID)

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID })
    )
  })

  it('returns the new heartbeat id on success', async () => {
    makeChain({ single: jest.fn().mockResolvedValue({ data: { id: 'hb-99' }, error: null }) })

    const id = await insertHeartbeat(USER_ID)
    expect(id).toBe('hb-99')
  })

  it('returns null on DB error', async () => {
    makeChain({ single: jest.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } }) })

    const id = await insertHeartbeat(USER_ID)
    expect(id).toBeNull()
  })

  it('does not throw on DB error', async () => {
    makeChain({ single: jest.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } }) })

    await expect(insertHeartbeat(USER_ID)).resolves.toBeNull()
  })
})

// ── fetchHeartbeats ───────────────────────────────────────────────────────────

describe('fetchHeartbeats', () => {
  it('returns rows and writes them to cache', async () => {
    const hb = makeHeartbeat()
    makeChain({ order: jest.fn().mockResolvedValue({ data: [hb], error: null }) })

    const rows = await fetchHeartbeats(USER_ID)
    expect(rows).toEqual([hb])
    expect(readHeartbeatCache(USER_ID)).toEqual([hb])
  })

  it('returns [] on DB error without writing cache', async () => {
    makeChain({ order: jest.fn().mockResolvedValue({ data: null, error: { message: 'fetch failed' } }) })

    const rows = await fetchHeartbeats(USER_ID)
    expect(rows).toEqual([])
    expect(readHeartbeatCache(USER_ID)).toEqual([])
  })
})

// ── deleteAllHeartbeats ───────────────────────────────────────────────────────

describe('deleteAllHeartbeats', () => {
  it('returns { error: null } on success', async () => {
    makeChain({ eq: jest.fn().mockResolvedValue({ error: null }) })

    const { error } = await deleteAllHeartbeats(USER_ID)
    expect(error).toBeNull()
  })

  it('returns error string on failure', async () => {
    makeChain({ eq: jest.fn().mockResolvedValue({ error: { message: 'permission denied' } }) })

    const { error } = await deleteAllHeartbeats(USER_ID)
    expect(error).toBe('permission denied')
  })
})
