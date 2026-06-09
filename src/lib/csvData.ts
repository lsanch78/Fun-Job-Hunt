import type { Job, Contact } from '@/types'

// ── Serialisation ─────────────────────────────────────────────────────────────

const escape = (v: string) => `"${v.replace(/"/g, '""')}"`

const JOB_HEADERS     = ['ID', 'Company', 'Title', 'Status', 'Location', 'Date Applied', 'Salary (K)', 'Rating', 'Posting URL', 'Description', 'Notes']
const CONTACT_HEADERS = ['ID', 'Name', 'Company', 'Email', 'LinkedIn', 'GitHub', 'Twitter', 'Discord', 'Comm XP', 'Last Interaction', 'Last Comm', 'Notes', 'Created At']

function jobsSection(jobs: Job[]): string {
  const rows = jobs.map((j) => [
    j.id, j.company, j.title,
    j.status.replace(/_/g, ' '),
    j.location ?? '',
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

