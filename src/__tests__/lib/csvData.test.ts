// ── Imports ───────────────────────────────────────────────────────────────────

import { buildCombinedCSV } from '@/lib/csvData'
import type { Job, Contact } from '@/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1', company: 'Aperture Science', title: 'Frontend Engineer',
  status: 'APPLIED', postingUrl: 'https://aperture.com', applicationDate: '2026-01-15T14:30:00.000Z',
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
