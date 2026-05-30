import { insertJob } from '@/services/jobService'
import { insertContact } from '@/services/contactService'
import type { Job, Contact } from '@/types'

// ── Serialisation ─────────────────────────────────────────────────────────────

const escape = (v: string) => `"${v.replace(/"/g, '""')}"`

const JOB_HEADERS     = ['ID', 'Company', 'Title', 'Status', 'Date Applied', 'Salary (K)', 'Rating', 'Posting URL', 'Description', 'Notes']
const CONTACT_HEADERS = ['ID', 'Name', 'Company', 'Email', 'LinkedIn', 'GitHub', 'Twitter', 'Discord', 'Comm XP', 'Last Interaction', 'Last Comm', 'Notes', 'Created At']

function jobsSection(jobs: Job[]): string {
  const rows = jobs.map((j) => [
    j.id, j.company, j.title,
    j.status.replace(/_/g, ' '),
    j.applicationDate,
    j.salary ? `${j.salary}K` : '',
    j.rating > 0 ? String(j.rating) : '',
    j.postingUrl, j.description ?? '', j.notes ?? '',
  ])
  return ['## JOBS', JOB_HEADERS.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\r\n')
}

function contactsSection(contacts: Contact[]): string {
  const rows = contacts.map((c) => [
    c.id, c.name, c.company ?? '', c.email ?? '',
    c.linkedin ?? '', c.github ?? '', c.twitter ?? '', c.discord ?? '',
    String(c.commExp), c.lastInteractionAt ?? '', c.lastCommAt ?? '',
    c.notes ?? '', c.createdAt,
  ])
  return ['## CONTACTS', CONTACT_HEADERS.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\r\n')
}

export function buildCombinedCSV(jobs: Job[], contacts: Contact[]): string {
  return [jobsSection(jobs), '', contactsSection(contacts)].join('\r\n')
}

// ── Parser ────────────────────────────────────────────────────────────────────

export function parseCSVRow(line: string): string[] {
  const fields: string[] = []
  let cur = '', inQuotes = false, i = 0
  while (i < line.length) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 2; continue }
      if (ch === '"') { inQuotes = false; i++; continue }
      cur += ch
    } else {
      if (ch === '"') { inQuotes = true; i++; continue }
      if (ch === ',') { fields.push(cur); cur = ''; i++; continue }
      cur += ch
    }
    i++
  }
  fields.push(cur)
  return fields
}

export interface ImportResult {
  jobsImported: number
  jobsSkipped: number
  contactsImported: number
  contactsSkipped: number
  errors: string[]
}

const VALID_STATUSES = new Set(['APPLIED', 'PHONE_SCREEN', 'INTERVIEW', 'OFFER', 'REJECTED', 'GHOSTED', 'WITHDRAWN'])

export async function parseCombinedCSV(text: string, userId: string): Promise<ImportResult> {
  const result: ImportResult = { jobsImported: 0, jobsSkipped: 0, contactsImported: 0, contactsSkipped: 0, errors: [] }
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  let section: 'jobs' | 'contacts' | null = null
  let headerSeen = false

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line === '## JOBS')     { section = 'jobs';     headerSeen = false; continue }
    if (line === '## CONTACTS') { section = 'contacts'; headerSeen = false; continue }
    if (!headerSeen)            { headerSeen = true; continue }
    if (!section) continue

    const cols = parseCSVRow(line)

    if (section === 'jobs') {
      const [, company, title, statusRaw, dateApplied, salaryRaw, ratingRaw, postingUrl, description, notes] = cols
      if (!company?.trim() || !title?.trim()) { result.jobsSkipped++; continue }
      const statusNorm = statusRaw?.trim().replace(/ /g, '_').toUpperCase()
      const status = VALID_STATUSES.has(statusNorm) ? statusNorm : 'APPLIED'
      const salary = salaryRaw?.replace(/K$/i, '').trim() ?? ''
      const rating = Math.min(5, Math.max(0, parseInt(ratingRaw ?? '0', 10) || 0))
      const date = /^\d{4}-\d{2}-\d{2}$/.test(dateApplied?.trim()) ? dateApplied.trim() : new Date().toISOString().slice(0, 10)
      const job: Job = {
        id: crypto.randomUUID(), company: company.trim(), title: title.trim(),
        status: status as Job['status'], postingUrl: postingUrl?.trim() ?? '',
        applicationDate: date, rating, salary, committed: true,
        description: description?.trim() || undefined, notes: notes?.trim() || undefined,
      }
      const { error } = await insertJob(job, userId)
      if (error) { result.jobsSkipped++; if (result.errors.length < 5) result.errors.push(error) }
      else result.jobsImported++
    }

    if (section === 'contacts') {
      const [, name, company, email, linkedin, github, twitter, discord, , , , notes] = cols
      if (!name?.trim()) { result.contactsSkipped++; continue }
      const { error } = await insertContact({
        userId, name: name.trim(), company: company?.trim() || undefined,
        email: email?.trim() || undefined, linkedin: linkedin?.trim() || undefined,
        github: github?.trim() || undefined, twitter: twitter?.trim() || undefined,
        discord: discord?.trim() || undefined, notes: notes?.trim() || undefined,
        lastInteractionAt: null, commExp: 0, lastCommAt: null,
      }, userId)
      if (error) { result.contactsSkipped++; if (result.errors.length < 5) result.errors.push(error) }
      else result.contactsImported++
    }
  }

  return result
}
