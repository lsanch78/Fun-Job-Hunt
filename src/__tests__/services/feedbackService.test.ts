import { submitFeedback } from '@/services/feedbackService'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

import { supabase } from '@/lib/supabase'
const mockFrom = supabase.from as jest.Mock

function makeInsertChain(result: { data: unknown; error: unknown }) {
  const insert = jest.fn().mockResolvedValue(result)
  mockFrom.mockReturnValue({ insert })
  return { insert }
}

beforeEach(() => jest.clearAllMocks())

const basePayload = {
  userId: 'user-123',
  topic: 'Bug' as const,
  contact: '  @handle  ',
  message: '  something broke  ',
}

describe('submitFeedback', () => {
  it('returns ok on success', async () => {
    makeInsertChain({ data: null, error: null })
    const result = await submitFeedback(basePayload)
    expect(result).toBe('ok')
  })

  it('returns rate_limited on RLS violation (42501)', async () => {
    makeInsertChain({ data: null, error: { message: 'new row violates row-level security', code: '42501' } })
    const result = await submitFeedback(basePayload)
    expect(result).toBe('rate_limited')
  })

  it('returns error on other DB errors', async () => {
    makeInsertChain({ data: null, error: { message: 'connection refused', code: '08006' } })
    const result = await submitFeedback(basePayload)
    expect(result).toBe('error')
  })

  it('inserts with user_id from payload', async () => {
    const { insert } = makeInsertChain({ data: null, error: null })
    await submitFeedback(basePayload)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123' })
    )
  })

  it('trims whitespace from message and contact', async () => {
    const { insert } = makeInsertChain({ data: null, error: null })
    await submitFeedback(basePayload)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'something broke', contact: '@handle' })
    )
  })

  it('sets contact to null when empty after trim', async () => {
    const { insert } = makeInsertChain({ data: null, error: null })
    await submitFeedback({ ...basePayload, contact: '   ' })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ contact: null })
    )
  })
})
