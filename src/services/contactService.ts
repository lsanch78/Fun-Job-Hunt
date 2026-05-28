import { supabase } from '@/lib/supabase'
import type { Contact } from '@/types'

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
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

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
  return (data as { contacts: DbContact }[]).map((row) => dbToContact(row.contacts))
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function insertContact(
  fields: Omit<Contact, 'id' | 'createdAt'>,
  userId: string
): Promise<{ data: Contact | null; error: string | null }> {
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

export async function pingContact(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('contacts')
    .update({ last_interaction_at: new Date().toISOString() })
    .eq('id', id)

  if (error) console.error('[contactService] pingContact:', error.message)
  return { error: error?.message ?? null }
}
