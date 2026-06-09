import {
  readWorkdayCache,
  startWorkday,
  endWorkday,
  fetchWorkdays,
  deleteAllWorkdays,
} from '@/services/workdayService'
import type { WorkdayRow } from '@/types'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

import { supabase } from '@/lib/supabase'
const mockFrom = supabase.from as jest.Mock

function makeChain(terminal: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single']
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

function makeRow(overrides: Partial<WorkdayRow> = {}): WorkdayRow {
  return {
    id: 'wd-1',
    user_id: USER_ID,
    punch_in: '2025-06-01T09:00:00.000Z',
    punch_out: null,
    date: '2025-06-01',
    ...overrides,
  }
}

// ── readWorkdayCache ──────────────────────────────────────────────────────────

describe('readWorkdayCache', () => {
  // Nothing stored yet — must not throw and must return a stable empty array.
  it('returns [] when localStorage has no entry', () => {
    expect(readWorkdayCache(USER_ID)).toEqual([])
  })

  // Rows written by fetchWorkdays must survive a JSON round-trip.
  it('returns stored rows', async () => {
    const row = makeRow()
    // Trigger a fetchWorkdays to populate the cache via the service's own writer.
    makeChain({
      order: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: [row], error: null }),
      }),
    })
    await fetchWorkdays(USER_ID)
    expect(readWorkdayCache(USER_ID)).toEqual([row])
  })

  // Corrupt storage must not throw — callers always expect an array.
  it('returns [] when stored value is not an array', () => {
    localStorage.setItem(`fjobhunt:workdays:${USER_ID}`, JSON.stringify('oops'))
    expect(readWorkdayCache(USER_ID)).toEqual([])
  })
})

// ── startWorkday ──────────────────────────────────────────────────────────────

describe('startWorkday', () => {
  // Happy path: the new row's id is returned so the caller can close the session on punch-out.
  it('returns the new row id on success', async () => {
    makeChain({ single: jest.fn().mockResolvedValue({ data: { id: 'wd-99' }, error: null }) })

    const id = await startWorkday(USER_ID, new Date('2025-06-01T09:00:00.000Z'))
    expect(id).toBe('wd-99')
  })

  // DB failure must return null — the hook uses this to detect a failed punch-in.
  it('returns null on DB error', async () => {
    makeChain({ single: jest.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } }) })

    const id = await startWorkday(USER_ID, new Date('2025-06-01T09:00:00.000Z'))
    expect(id).toBeNull()
  })

  // The date column is derived by slicing the UTC ISO string — not local time.
  // This pins the UTC slicing behaviour so a timezone change doesn't silently break grouping.
  it('derives the date field from UTC, not local time', async () => {
    let capturedInsert: Record<string, unknown> | null = null
    const chain: Record<string, jest.Mock> = {}
    chain['insert'] = jest.fn((payload) => { capturedInsert = payload; return chain })
    chain['select'] = jest.fn(() => chain)
    chain['single'] = jest.fn().mockResolvedValue({ data: { id: 'wd-1' }, error: null })
    mockFrom.mockReturnValue(chain)

    await startWorkday(USER_ID, new Date('2025-06-08T23:30:00.000Z'))

    expect(capturedInsert).toMatchObject({ date: '2025-06-08' })
  })
})

// ── endWorkday ────────────────────────────────────────────────────────────────

describe('endWorkday', () => {
  // Punch-out persists the ISO timestamp to close the open session.
  it('updates punch_out with the correct ISO string', async () => {
    const chain = makeChain({ eq: jest.fn().mockResolvedValue({ error: null }) })

    const punchOut = new Date('2025-06-01T17:30:00.000Z')
    await endWorkday('wd-1', punchOut)

    expect(chain.update).toHaveBeenCalledWith({ punch_out: punchOut.toISOString() })
  })

  // DB errors are logged but swallowed — endWorkday is fire-and-forget (void return).
  it('does not throw on DB error', async () => {
    makeChain({ eq: jest.fn().mockResolvedValue({ error: { message: 'update failed' } }) })

    await expect(endWorkday('wd-1', new Date())).resolves.toBeUndefined()
  })
})

// ── fetchWorkdays ─────────────────────────────────────────────────────────────

describe('fetchWorkdays', () => {
  // Happy path: rows are returned and written to cache in one call.
  it('returns rows and writes them to cache', async () => {
    const row = makeRow()
    makeChain({
      order: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: [row], error: null }),
      }),
    })

    const rows = await fetchWorkdays(USER_ID)
    expect(rows).toEqual([row])
    expect(readWorkdayCache(USER_ID)).toEqual([row])
  })

  // DB failure must return [] and must not corrupt the cache with a null write.
  it('returns [] on DB error without writing cache', async () => {
    makeChain({
      order: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'fetch failed' } }),
      }),
    })

    const rows = await fetchWorkdays(USER_ID)
    expect(rows).toEqual([])
    expect(readWorkdayCache(USER_ID)).toEqual([])
  })
})

// ── deleteAllWorkdays ─────────────────────────────────────────────────────────

describe('deleteAllWorkdays', () => {
  // Success case: caller receives a clean { error: null } signal.
  it('returns { error: null } on success', async () => {
    makeChain({ eq: jest.fn().mockResolvedValue({ error: null }) })

    const { error } = await deleteAllWorkdays(USER_ID)
    expect(error).toBeNull()
  })

  // DB failure surfaces as an error string so the caller can show a message.
  it('returns error string on failure', async () => {
    makeChain({ eq: jest.fn().mockResolvedValue({ error: { message: 'permission denied' } }) })

    const { error } = await deleteAllWorkdays(USER_ID)
    expect(error).toBe('permission denied')
  })
})
