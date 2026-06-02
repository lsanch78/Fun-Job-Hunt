import { supabase } from '@/lib/supabase'
import type { Contact } from '@/types'

export const FREE_CONTACT_CAP = 8

export async function countContacts(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) {
    console.error('[contactService] countContacts:', error.message)
    return 0
  }
  return count ?? 0
}

export const CONTACT_LIMITS = {
  name:     100,
  company:  100,
  linkedin: 200,
  github:   100,
  twitter:  100,
  discord:  100,
  email:    200,
  notes:    1000,
} as const

// ── Mappers ───────────────────────────────────────────────────────────────────

interface DbContact {
  id: string
  user_id: string
  name: string
  company: string | null
  linkedin: string | null
  github: string | null
  twitter: string | null
  discord: string | null
  email: string | null
  notes: string | null
  last_interaction_at: string | null
  comm_exp: number
  last_comm_at: string | null
  created_at: string
}

function dbToContact(row: DbContact): Contact {
  return {
    id:                 row.id,
    userId:             row.user_id,
    name:               row.name,
    company:            row.company     ?? undefined,
    linkedin:           row.linkedin    ?? undefined,
    github:             row.github      ?? undefined,
    twitter:            row.twitter     ?? undefined,
    discord:            row.discord     ?? undefined,
    email:              row.email       ?? undefined,
    notes:              row.notes       ?? undefined,
    lastInteractionAt:  row.last_interaction_at,
    commExp:            row.comm_exp,
    lastCommAt:         row.last_comm_at,
    createdAt:          row.created_at,
  }
}

function contactToDbInsert(contact: Omit<Contact, 'id' | 'createdAt'>, userId: string): Omit<DbContact, 'id' | 'created_at'> {
  return {
    user_id:             userId,
    name:                contact.name,
    company:             contact.company     ?? null,
    linkedin:            contact.linkedin    ?? null,
    github:              contact.github      ?? null,
    twitter:             contact.twitter     ?? null,
    discord:             contact.discord     ?? null,
    email:               contact.email       ?? null,
    notes:               contact.notes       ?? null,
    last_interaction_at: contact.lastInteractionAt,
    comm_exp:            contact.commExp ?? 0,
    last_comm_at:        contact.lastCommAt ?? null,
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export interface ContactJobLink { id: string; title: string; company: string }

/** Returns all contacts for a user plus a map of contactId → linked job info. */
export async function fetchContactsWithJobs(userId: string): Promise<{
  contacts: Contact[]
  jobsByContact: Record<string, ContactJobLink[]>
}> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*, job_contacts(jobs(id, company, title))')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) {
    console.error('[contactService] fetchContactsWithJobs:', error.message)
    return { contacts: [], jobsByContact: {} }
  }

  const contacts: Contact[] = []
  const jobsByContact: Record<string, ContactJobLink[]> = {}

  for (const row of data as (DbContact & { job_contacts: { jobs: { id: string; company: string; title: string } | null }[] })[]) {
    contacts.push(dbToContact(row))
    const links = (row.job_contacts ?? [])
      .filter((jc) => jc.jobs != null)
      .map((jc) => ({ id: jc.jobs!.id, title: jc.jobs!.title, company: jc.jobs!.company }))
    if (links.length) jobsByContact[row.id] = links
  }

  return { contacts, jobsByContact }
}

export async function fetchContacts(userId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) {
    console.error('[contactService] fetchContacts:', error.message)
    return []
  }
  return (data as DbContact[]).map(dbToContact)
}

export async function fetchContactsForJob(jobId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('job_contacts')
    .select('contacts(*)')
    .eq('job_id', jobId)

  if (error) {
    console.error('[contactService] fetchContactsForJob:', error.message)
    return []
  }
  return (data as unknown as { contacts: DbContact }[]).map((row) => dbToContact(row.contacts))
}

export async function fetchJobsForContact(contactId: string): Promise<{ id: string; title: string; company: string }[]> {
  const { data, error } = await supabase
    .from('job_contacts')
    .select('jobs(id, title, company)')
    .eq('contact_id', contactId)

  if (error) {
    console.error('[contactService] fetchJobsForContact:', error.message)
    return []
  }
  return (data as unknown as { jobs: { id: string; title: string; company: string } | null }[])
    .filter((row) => row.jobs != null)
    .map((row) => row.jobs!)
}

export async function fetchAllJobsForUser(userId: string): Promise<{ id: string; title: string; company: string }[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, company')
    .eq('user_id', userId)
    .order('company', { ascending: true })

  if (error) {
    console.error('[contactService] fetchAllJobsForUser:', error.message)
    return []
  }
  return data as { id: string; title: string; company: string }[]
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function insertContact(
  fields: Omit<Contact, 'id' | 'createdAt'>,
  userId: string,
  isSubscribed = true
): Promise<{ data: Contact | null; error: string | null }> {
  if (!isSubscribed) {
    const currentCount = await countContacts(userId)
    if (currentCount >= FREE_CONTACT_CAP) return { data: null, error: 'contact_cap_reached' }
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert(contactToDbInsert(fields, userId))
    .select()
    .single()

  if (error) {
    console.error('[contactService] insertContact:', error.message)
    return { data: null, error: error.message }
  }
  return { data: dbToContact(data as DbContact), error: null }
}

export async function updateContact(contact: Contact): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('contacts')
    .update({
      name:                contact.name,
      company:             contact.company     ?? null,
      linkedin:            contact.linkedin    ?? null,
      github:              contact.github      ?? null,
      twitter:             contact.twitter     ?? null,
      discord:             contact.discord     ?? null,
      email:               contact.email       ?? null,
      notes:               contact.notes       ?? null,
      last_interaction_at: contact.lastInteractionAt,
    })
    .eq('id', contact.id)

  if (error) console.error('[contactService] updateContact:', error.message)
  return { error: error?.message ?? null }
}

export async function deleteContact(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) console.error('[contactService] deleteContact:', error.message)
  return { error: error?.message ?? null }
}

export async function deleteAllContacts(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('contacts').delete().eq('user_id', userId)
  if (error) console.error('[contactService] deleteAllContacts:', error.message)
  return { error: error?.message ?? null }
}

// ── Junction table ────────────────────────────────────────────────────────────

export async function linkContactToJob(contactId: string, jobId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('job_contacts')
    .insert({ job_id: jobId, contact_id: contactId })

  if (error) console.error('[contactService] linkContactToJob:', error.message)
  return { error: error?.message ?? null }
}

export async function unlinkContactFromJob(contactId: string, jobId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('job_contacts')
    .delete()
    .eq('job_id', jobId)
    .eq('contact_id', contactId)

  if (error) console.error('[contactService] unlinkContactFromJob:', error.message)
  return { error: error?.message ?? null }
}

export async function updateContactExp(id: string, exp: number): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('contacts')
    .update({ comm_exp: Math.min(100, Math.max(0, exp)), last_comm_at: new Date().toISOString() })
    .eq('id', id)

  if (error) console.error('[contactService] updateContactExp:', error.message)
  return { error: error?.message ?? null }
}

export async function pingContact(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('contacts')
    .update({ last_interaction_at: new Date().toISOString() })
    .eq('id', id)

  if (error) console.error('[contactService] pingContact:', error.message)
  return { error: error?.message ?? null }
}
