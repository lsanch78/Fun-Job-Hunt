import {
  fetchContacts,
  fetchContactsWithJobs,
  fetchContactsForJob,
  insertContact,
  updateContact,
  deleteContact,
  deleteAllContacts,
  linkContactToJob,
  unlinkContactFromJob,
  updateContactExp,
  pingContact,
} from '@/services/contactService'
import type { Contact } from '@/types'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

import { supabase } from '@/lib/supabase'
const mockFrom = supabase.from as jest.Mock

// Fluent chain builder — each method returns the chain unless overridden at the end
function makeChain(terminal: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order', 'single', 'maybeSingle']
  methods.forEach((m) => { chain[m] = jest.fn(() => chain) })
  Object.assign(chain, terminal)
  mockFrom.mockReturnValue(chain)
  return chain
}

const dbRow = {
  id: 'c1',
  user_id: 'u1',
  name: 'Alice',
  company: 'Acme',
  linkedin: null,
  github: null,
  twitter: null,
  discord: null,
  email: 'alice@acme.com',
  notes: null,
  last_interaction_at: null,
  comm_exp: 0,
  last_comm_at: null,
  created_at: '2025-01-01T00:00:00Z',
}

const contact: Contact = {
  id: 'c1',
  userId: 'u1',
  name: 'Alice',
  company: 'Acme',
  email: 'alice@acme.com',
  lastInteractionAt: null,
  commExp: 0,
  lastCommAt: null,
  createdAt: '2025-01-01T00:00:00Z',
}

beforeEach(() => jest.clearAllMocks())

// ── fetchContacts ─────────────────────────────────────────────────────────────

describe('fetchContacts', () => {
  it('maps db rows to Contact objects', async () => {
    const chain = makeChain()
    chain.order = jest.fn().mockResolvedValue({ data: [dbRow], error: null })

    const result = await fetchContacts('u1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'c1', name: 'Alice', userId: 'u1' })
  })

  it('returns [] on error', async () => {
    const chain = makeChain()
    chain.order = jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } })

    expect(await fetchContacts('u1')).toEqual([])
  })

  it('filters by user_id', async () => {
    const chain = makeChain()
    chain.order = jest.fn().mockResolvedValue({ data: [], error: null })

    await fetchContacts('u1')

    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1')
  })

  it('orders by name ascending', async () => {
    const chain = makeChain()
    chain.order = jest.fn().mockResolvedValue({ data: [], error: null })

    await fetchContacts('u1')

    expect(chain.order).toHaveBeenCalledWith('name', { ascending: true })
  })

  it('strips null optional fields to undefined', async () => {
    const chain = makeChain()
    chain.order = jest.fn().mockResolvedValue({ data: [dbRow], error: null })

    const [result] = await fetchContacts('u1')

    expect(result.linkedin).toBeUndefined()
    expect(result.notes).toBeUndefined()
  })
})

// ── fetchContactsWithJobs ─────────────────────────────────────────────────────

describe('fetchContactsWithJobs', () => {
  it('returns contacts and jobsByContact map', async () => {
    const rowWithJobs = {
      ...dbRow,
      job_contacts: [{ jobs: { id: 'j1', title: 'Engineer', company: 'Acme' } }],
    }
    const chain = makeChain()
    chain.order = jest.fn().mockResolvedValue({ data: [rowWithJobs], error: null })

    const { contacts, jobsByContact } = await fetchContactsWithJobs('u1')

    expect(contacts).toHaveLength(1)
    expect(jobsByContact['c1']).toEqual([{ id: 'j1', title: 'Engineer', company: 'Acme' }])
  })

  it('omits contact from jobsByContact when it has no linked jobs', async () => {
    const rowNoJobs = { ...dbRow, job_contacts: [] }
    const chain = makeChain()
    chain.order = jest.fn().mockResolvedValue({ data: [rowNoJobs], error: null })

    const { jobsByContact } = await fetchContactsWithJobs('u1')

    expect(jobsByContact['c1']).toBeUndefined()
  })

  it('returns empty on error', async () => {
    const chain = makeChain()
    chain.order = jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } })

    const result = await fetchContactsWithJobs('u1')

    expect(result).toEqual({ contacts: [], jobsByContact: {} })
  })
})

// ── fetchContactsForJob ───────────────────────────────────────────────────────

describe('fetchContactsForJob', () => {
  it('returns contacts linked to a job', async () => {
    const chain = makeChain()
    chain.eq = jest.fn().mockResolvedValue({ data: [{ contacts: dbRow }], error: null })

    const result = await fetchContactsForJob('j1')

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alice')
  })

  it('returns [] on error', async () => {
    const chain = makeChain()
    chain.eq = jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } })

    expect(await fetchContactsForJob('j1')).toEqual([])
  })
})

// ── insertContact ─────────────────────────────────────────────────────────────

describe('insertContact', () => {
  it('returns mapped Contact on success', async () => {
    const chain = makeChain()
    chain.single = jest.fn().mockResolvedValue({ data: dbRow, error: null })

    const fields: Omit<Contact, 'id' | 'createdAt'> = {
      userId: 'u1', name: 'Alice', company: 'Acme', email: 'alice@acme.com',
      lastInteractionAt: null, commExp: 0, lastCommAt: null,
    }
    const { data, error } = await insertContact(fields, 'u1')

    expect(error).toBeNull()
    expect(data).toMatchObject({ id: 'c1', name: 'Alice' })
  })

  it('returns error string on failure', async () => {
    const chain = makeChain()
    chain.single = jest.fn().mockResolvedValue({ data: null, error: { message: 'unique violation' } })

    const fields: Omit<Contact, 'id' | 'createdAt'> = {
      userId: 'u1', name: 'Alice', lastInteractionAt: null, commExp: 0, lastCommAt: null,
    }
    const { data, error } = await insertContact(fields, 'u1')

    expect(data).toBeNull()
    expect(error).toBe('unique violation')
  })

  it('inserts with correct user_id', async () => {
    const chain = makeChain()
    chain.single = jest.fn().mockResolvedValue({ data: dbRow, error: null })

    const fields: Omit<Contact, 'id' | 'createdAt'> = {
      userId: 'u1', name: 'Alice', lastInteractionAt: null, commExp: 0, lastCommAt: null,
    }
    await insertContact(fields, 'u1')

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1' }))
  })
})

// ── updateContact ─────────────────────────────────────────────────────────────

describe('updateContact', () => {
  it('returns null error on success', async () => {
    const chain = makeChain()
    chain.eq = jest.fn().mockResolvedValue({ error: null })

    const { error } = await updateContact(contact)

    expect(error).toBeNull()
  })

  it('returns error message on failure', async () => {
    const chain = makeChain()
    chain.eq = jest.fn().mockResolvedValue({ error: { message: 'not found' } })

    const { error } = await updateContact(contact)

    expect(error).toBe('not found')
  })

  it('filters update by contact id', async () => {
    const chain = makeChain()
    chain.eq = jest.fn().mockResolvedValue({ error: null })

    await updateContact(contact)

    expect(chain.eq).toHaveBeenCalledWith('id', 'c1')
  })
})

// ── deleteContact ─────────────────────────────────────────────────────────────

describe('deleteContact', () => {
  it('returns null error on success', async () => {
    const chain = makeChain()
    chain.eq = jest.fn().mockResolvedValue({ error: null })

    expect((await deleteContact('c1')).error).toBeNull()
  })

  it('deletes by id', async () => {
    const chain = makeChain()
    chain.eq = jest.fn().mockResolvedValue({ error: null })

    await deleteContact('c1')

    expect(chain.eq).toHaveBeenCalledWith('id', 'c1')
  })
})

// ── deleteAllContacts ─────────────────────────────────────────────────────────

describe('deleteAllContacts', () => {
  it('deletes by user_id', async () => {
    const chain = makeChain()
    chain.eq = jest.fn().mockResolvedValue({ error: null })

    await deleteAllContacts('u1')

    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1')
  })
})

// ── linkContactToJob ──────────────────────────────────────────────────────────

describe('linkContactToJob', () => {
  it('inserts the correct junction row', async () => {
    const chain = makeChain()
    chain.insert = jest.fn().mockResolvedValue({ error: null })

    await linkContactToJob('c1', 'j1')

    expect(chain.insert).toHaveBeenCalledWith({ job_id: 'j1', contact_id: 'c1' })
  })

  it('returns error on failure', async () => {
    const chain = makeChain()
    chain.insert = jest.fn().mockResolvedValue({ error: { message: 'fk violation' } })

    const { error } = await linkContactToJob('c1', 'j1')

    expect(error).toBe('fk violation')
  })
})

// ── unlinkContactFromJob ──────────────────────────────────────────────────────

describe('unlinkContactFromJob', () => {
  it('filters by both job_id and contact_id', async () => {
    const eqMock = jest.fn().mockResolvedValue({ error: null })
    const chain = makeChain()
    chain.eq = eqMock.mockReturnValueOnce(chain).mockResolvedValueOnce({ error: null })

    await unlinkContactFromJob('c1', 'j1')

    expect(eqMock).toHaveBeenCalledWith('job_id', 'j1')
    expect(eqMock).toHaveBeenCalledWith('contact_id', 'c1')
  })
})

// ── updateContactExp ──────────────────────────────────────────────────────────

describe('updateContactExp', () => {
  it('clamps exp to 0–100', async () => {
    const chain = makeChain()
    chain.eq = jest.fn().mockResolvedValue({ error: null })

    await updateContactExp('c1', 150)
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ comm_exp: 100 }))

    jest.clearAllMocks()
    makeChain()
    const chain2 = makeChain()
    chain2.eq = jest.fn().mockResolvedValue({ error: null })

    await updateContactExp('c1', -50)
    expect(chain2.update).toHaveBeenCalledWith(expect.objectContaining({ comm_exp: 0 }))
  })

  it('sets last_comm_at', async () => {
    const chain = makeChain()
    chain.eq = jest.fn().mockResolvedValue({ error: null })

    await updateContactExp('c1', 50)

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_comm_at: expect.any(String) })
    )
  })
})

// ── pingContact ───────────────────────────────────────────────────────────────

describe('pingContact', () => {
  it('updates last_interaction_at', async () => {
    const chain = makeChain()
    chain.eq = jest.fn().mockResolvedValue({ error: null })

    await pingContact('c1')

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_interaction_at: expect.any(String) })
    )
  })

  it('filters by id', async () => {
    const chain = makeChain()
    chain.eq = jest.fn().mockResolvedValue({ error: null })

    await pingContact('c1')

    expect(chain.eq).toHaveBeenCalledWith('id', 'c1')
  })
})
