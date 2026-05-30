// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/supabase', () => ({ supabase: {} }))

const mockInsertJob     = jest.fn()
const mockInsertContact = jest.fn()

jest.mock('@/services/jobService',     () => ({ insertJob:     (...a: unknown[]) => mockInsertJob(...a) }))
jest.mock('@/services/contactService', () => ({ insertContact: (...a: unknown[]) => mockInsertContact(...a) }))

// ── Imports ───────────────────────────────────────────────────────────────────

import { parseCSVRow, buildCombinedCSV, parseCombinedCSV } from '@/lib/csvData'
import type { Job, Contact } from '@/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1', company: 'Aperture Science', title: 'Frontend Engineer',
  status: 'APPLIED', postingUrl: 'https://aperture.com', applicationDate: '2026-01-15',
  rating: 3, salary: '120', committed: true,
  description: 'Build portals', notes: 'Bring a cube',
  ...overrides,
})

const makeContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'c-1', userId: 'user-1', name: 'Ada Lovelace', company: 'Aperture Science',
  email: 'ada@example.com', linkedin: 'https://linkedin.com/in/ada',
  github: '', twitter: '', discord: '',
  commExp: 42, lastInteractionAt: '2026-01-10T00:00:00Z',
  lastCommAt: '2026-01-10T00:00:00Z', createdAt: '2025-12-01T00:00:00Z',
  notes: 'Brilliant',
  ...overrides,
})

// ── parseCSVRow ───────────────────────────────────────────────────────────────

describe('parseCSVRow', () => {
  it('parses a simple row', () => {
    expect(parseCSVRow('"a","b","c"')).toEqual(['a', 'b', 'c'])
  })

  it('handles escaped quotes inside a field', () => {
    expect(parseCSVRow('"say ""hello""","world"')).toEqual(['say "hello"', 'world'])
  })

  it('handles empty fields', () => {
    expect(parseCSVRow('"a","","c"')).toEqual(['a', '', 'c'])
  })

  it('handles fields with commas inside quotes', () => {
    expect(parseCSVRow('"Acme, Inc","Engineer"')).toEqual(['Acme, Inc', 'Engineer'])
  })

  it('returns a single-element array for a single field', () => {
    expect(parseCSVRow('"only"')).toEqual(['only'])
  })
})

// ── buildCombinedCSV ──────────────────────────────────────────────────────────

describe('buildCombinedCSV', () => {
  it('contains ## JOBS and ## CONTACTS section headers', () => {
    const csv = buildCombinedCSV([makeJob()], [makeContact()])
    expect(csv).toContain('## JOBS')
    expect(csv).toContain('## CONTACTS')
  })

  it('includes job company and title in output', () => {
    const csv = buildCombinedCSV([makeJob()], [])
    expect(csv).toContain('Aperture Science')
    expect(csv).toContain('Frontend Engineer')
  })

  it('formats salary with K suffix', () => {
    const csv = buildCombinedCSV([makeJob({ salary: '120' })], [])
    expect(csv).toContain('120K')
  })

  it('leaves salary blank when empty', () => {
    const csv = buildCombinedCSV([makeJob({ salary: '' })], [])
    // Should have an empty quoted field where salary goes — no trailing K
    expect(csv).not.toMatch(/\d+K/)
  })

  it('formats status with spaces (PHONE_SCREEN → PHONE SCREEN)', () => {
    const csv = buildCombinedCSV([makeJob({ status: 'PHONE_SCREEN' })], [])
    expect(csv).toContain('PHONE SCREEN')
  })

  it('includes contact name and email', () => {
    const csv = buildCombinedCSV([], [makeContact()])
    expect(csv).toContain('Ada Lovelace')
    expect(csv).toContain('ada@example.com')
  })

  it('sections are separated by a blank line', () => {
    const csv = buildCombinedCSV([makeJob()], [makeContact()])
    expect(csv).toMatch(/\r\n\r\n/)
  })

  it('round-trips: output can be re-parsed to recover jobs section header', () => {
    const csv = buildCombinedCSV([makeJob()], [makeContact()])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('## JOBS')
  })
})

// ── parseCombinedCSV ──────────────────────────────────────────────────────────

describe('parseCombinedCSV', () => {
  const USER_ID = 'user-1'

  beforeEach(() => {
    jest.clearAllMocks()
    mockInsertJob.mockResolvedValue({ error: null })
    mockInsertContact.mockResolvedValue({ data: {}, error: null })
  })

  it('imports one job from a minimal CSV', async () => {
    const csv = buildCombinedCSV([makeJob()], [])
    const result = await parseCombinedCSV(csv, USER_ID)
    expect(result.jobsImported).toBe(1)
    expect(result.jobsSkipped).toBe(0)
    expect(mockInsertJob).toHaveBeenCalledTimes(1)
  })

  it('imports one contact from a minimal CSV', async () => {
    const csv = buildCombinedCSV([], [makeContact()])
    const result = await parseCombinedCSV(csv, USER_ID)
    expect(result.contactsImported).toBe(1)
    expect(result.contactsSkipped).toBe(0)
    expect(mockInsertContact).toHaveBeenCalledTimes(1)
  })

  it('imports both jobs and contacts together', async () => {
    const csv = buildCombinedCSV([makeJob()], [makeContact()])
    const result = await parseCombinedCSV(csv, USER_ID)
    expect(result.jobsImported).toBe(1)
    expect(result.contactsImported).toBe(1)
  })

  it('skips a job row missing company and title', async () => {
    const csv = '## JOBS\r\n"ID","Company","Title","Status","Date Applied","Salary (K)","Rating","Posting URL","Description","Notes"\r\n"","",""\r\n'
    const result = await parseCombinedCSV(csv, USER_ID)
    expect(result.jobsSkipped).toBe(1)
    expect(result.jobsImported).toBe(0)
    expect(mockInsertJob).not.toHaveBeenCalled()
  })

  it('skips a contact row missing name', async () => {
    const csv = '## CONTACTS\r\n"ID","Name","Company"\r\n"","","Aperture"\r\n'
    const result = await parseCombinedCSV(csv, USER_ID)
    expect(result.contactsSkipped).toBe(1)
    expect(result.contactsImported).toBe(0)
    expect(mockInsertContact).not.toHaveBeenCalled()
  })

  it('defaults invalid status to APPLIED', async () => {
    const badCsv ='## JOBS\r\n"ID","Company","Title","Status","Date Applied","Salary (K)","Rating","Posting URL","Description","Notes"\r\n"id-1","Acme","Dev","NONSENSE","2026-01-01","","","","",""\r\n'
    await parseCombinedCSV(badCsv, USER_ID)
    const call = mockInsertJob.mock.calls[0][0] as Job
    expect(call.status).toBe('APPLIED')
  })

  it('defaults bad date to today', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const badCsv = '## JOBS\r\n"ID","Company","Title","Status","Date Applied","Salary (K)","Rating","Posting URL","Description","Notes"\r\n"id-1","Acme","Dev","APPLIED","not-a-date","","","","",""\r\n'
    await parseCombinedCSV(badCsv, USER_ID)
    const call = mockInsertJob.mock.calls[0][0] as Job
    expect(call.applicationDate).toBe(today)
  })

  it('strips K suffix from salary', async () => {
    const csv = buildCombinedCSV([makeJob({ salary: '120' })], [])
    await parseCombinedCSV(csv, USER_ID)
    const call = mockInsertJob.mock.calls[0][0] as Job
    expect(call.salary).toBe('120')
  })

  it('clamps rating to 0–5', async () => {
    const badCsv = '## JOBS\r\n"ID","Company","Title","Status","Date Applied","Salary (K)","Rating","Posting URL","Description","Notes"\r\n"id-1","Acme","Dev","APPLIED","2026-01-01","","99","","",""\r\n'
    await parseCombinedCSV(badCsv, USER_ID)
    const call = mockInsertJob.mock.calls[0][0] as Job
    expect(call.rating).toBe(5)
  })

  it('records DB errors and counts skipped', async () => {
    mockInsertJob.mockResolvedValue({ error: 'job_cap_reached' })
    const csv = buildCombinedCSV([makeJob()], [])
    const result = await parseCombinedCSV(csv, USER_ID)
    expect(result.jobsSkipped).toBe(1)
    expect(result.jobsImported).toBe(0)
    expect(result.errors).toContain('job_cap_reached')
  })

  it('handles CRLF and LF line endings equally', async () => {
    const crlf = buildCombinedCSV([makeJob()], [])
    const lf   = crlf.replace(/\r\n/g, '\n')
    const [r1, r2] = await Promise.all([
      parseCombinedCSV(crlf, USER_ID),
      parseCombinedCSV(lf,   USER_ID),
    ])
    expect(r1.jobsImported).toBe(r2.jobsImported)
  })

  it('does not import XP — insertJob is called without an XP field', async () => {
    const csv = buildCombinedCSV([makeJob()], [])
    await parseCombinedCSV(csv, USER_ID)
    const call = mockInsertJob.mock.calls[0][0] as Job
    expect(call).not.toHaveProperty('xp')
  })

  it('returns zero counts for an empty string', async () => {
    const result = await parseCombinedCSV('', USER_ID)
    expect(result).toEqual({ jobsImported: 0, jobsSkipped: 0, contactsImported: 0, contactsSkipped: 0, errors: [] })
  })
})
