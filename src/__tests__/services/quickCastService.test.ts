import {
  fetchLinks,
  createLink,
  updateLink,
  deleteLink,
  reorderLinks,
  type QuickCastLink,
} from '@/services/quickCastService'

// ---------- Supabase mock factory ----------

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['from', 'select', 'insert', 'update', 'upsert', 'delete', 'eq', 'order', 'single']
  methods.forEach((m) => {
    chain[m] = jest.fn(() => chain)
  })
  Object.assign(chain, overrides)
  return chain
}

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

import { supabase } from '@/lib/supabase'
const mockSupabase = supabase as jest.Mocked<typeof supabase>

// Helper to set up a fresh chain for each call
function mockChain(result: unknown) {
  const chain = makeChain()
  // Resolve the chain at any terminal point
  ;['select', 'insert', 'update', 'delete', 'single', 'order', 'eq'].forEach((m) => {
    // Override the last call in a chain to resolve with result
    chain[m] = jest.fn().mockReturnValue(
      new Proxy(chain, {
        get(target, prop: string) {
          if (prop === 'then') {
            return (resolve: (v: unknown) => void) => resolve(result)
          }
          return target[prop] ?? jest.fn().mockReturnThis()
        },
      }),
    )
  })
  ;(mockSupabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

// ---------- Tests ----------

beforeEach(() => jest.clearAllMocks())

describe('fetchLinks', () => {
  it('returns mapped links on success', async () => {
    const rows = [
      { id: '1', user_id: 'u1', label: 'LinkedIn', url: 'https://linkedin.com', icon: 'linkedin', position: 0 },
      { id: '2', user_id: 'u1', label: 'GitHub', url: 'https://github.com', icon: 'github', position: 1 },
    ]
    const chain = makeChain()
    ;(mockSupabase.from as jest.Mock).mockReturnValue(chain)
    chain.select = jest.fn().mockReturnValue(chain)
    chain.eq = jest.fn().mockReturnValue(chain)
    chain.order = jest.fn().mockResolvedValue({ data: rows, error: null })

    const result = await fetchLinks('u1')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ id: '1', label: 'LinkedIn', url: 'https://linkedin.com', icon: 'linkedin', position: 0 })
    expect(result[1]).toEqual({ id: '2', label: 'GitHub', url: 'https://github.com', icon: 'github', position: 1 })
    // user_id stripped from output
    expect(result[0]).not.toHaveProperty('user_id')
  })

  it('returns [] on error', async () => {
    const chain = makeChain()
    ;(mockSupabase.from as jest.Mock).mockReturnValue(chain)
    chain.select = jest.fn().mockReturnValue(chain)
    chain.eq = jest.fn().mockReturnValue(chain)
    chain.order = jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })

    const result = await fetchLinks('u1')

    expect(result).toEqual([])
  })

  it('orders by position ascending', async () => {
    const chain = makeChain()
    ;(mockSupabase.from as jest.Mock).mockReturnValue(chain)
    chain.select = jest.fn().mockReturnValue(chain)
    chain.eq = jest.fn().mockReturnValue(chain)
    chain.order = jest.fn().mockResolvedValue({ data: [], error: null })

    await fetchLinks('u1')

    expect(chain.order).toHaveBeenCalledWith('position', { ascending: true })
  })
})

describe('createLink', () => {
  it('returns id on success', async () => {
    const chain = makeChain()
    ;(mockSupabase.from as jest.Mock).mockReturnValue(chain)
    chain.insert = jest.fn().mockReturnValue(chain)
    chain.select = jest.fn().mockReturnValue(chain)
    chain.single = jest.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null })

    const result = await createLink('u1', { label: 'Test', url: 'http://test.com', icon: 'link', position: 0 })

    expect(result).toBe('new-id')
  })

  it('returns null on error', async () => {
    const chain = makeChain()
    ;(mockSupabase.from as jest.Mock).mockReturnValue(chain)
    chain.insert = jest.fn().mockReturnValue(chain)
    chain.select = jest.fn().mockReturnValue(chain)
    chain.single = jest.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } })

    const result = await createLink('u1', { label: 'Test', url: 'http://test.com', icon: 'link', position: 0 })

    expect(result).toBeNull()
  })
})

describe('updateLink', () => {
  it('calls update with correct fields', async () => {
    const chain = makeChain()
    ;(mockSupabase.from as jest.Mock).mockReturnValue(chain)
    chain.update = jest.fn().mockReturnValue(chain)
    chain.eq = jest.fn().mockResolvedValue({ error: null })

    const link: QuickCastLink = { id: 'link-1', label: 'Updated', url: 'http://updated.com', icon: 'github', position: 2 }
    await updateLink(link)

    expect(chain.update).toHaveBeenCalledWith({
      label: 'Updated',
      url: 'http://updated.com',
      icon: 'github',
      position: 2,
    })
    expect(chain.eq).toHaveBeenCalledWith('id', 'link-1')
  })
})

describe('deleteLink', () => {
  it('calls delete and eq with id', async () => {
    const chain = makeChain()
    ;(mockSupabase.from as jest.Mock).mockReturnValue(chain)
    chain.delete = jest.fn().mockReturnValue(chain)
    chain.eq = jest.fn().mockResolvedValue({ error: null })

    await deleteLink('link-42')

    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'link-42')
  })
})

describe('reorderLinks', () => {
  it('fires one update per link with the new position index', async () => {
    const updateMock = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) })
    ;(mockSupabase.from as jest.Mock).mockReturnValue({ update: updateMock, eq: jest.fn() })

    const links: QuickCastLink[] = [
      { id: 'a', label: 'A', url: 'http://a.com', icon: 'link', position: 3 },
      { id: 'b', label: 'B', url: 'http://b.com', icon: 'link', position: 1 },
      { id: 'c', label: 'C', url: 'http://c.com', icon: 'link', position: 0 },
    ]
    await reorderLinks(links)

    expect(updateMock).toHaveBeenCalledTimes(3)
    expect(updateMock).toHaveBeenNthCalledWith(1, { position: 0 })
    expect(updateMock).toHaveBeenNthCalledWith(2, { position: 1 })
    expect(updateMock).toHaveBeenNthCalledWith(3, { position: 2 })
  })
})
