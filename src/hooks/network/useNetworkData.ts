import { useState, useEffect } from 'react'
import {
  fetchContactsWithJobs, insertContact, updateContact, pingContact,
  linkContactToJob, deleteContact, updateContactExp, FREE_CONTACT_CAP,
} from '@/services/contactService'
import { fetchJobs } from '@/services/jobService'
import { createCheckoutSession } from '@/services/subscriptionService'
import { getCommCooldownHours } from '@/lib/commSettings'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import { useSubscription } from '@/contexts/SubscriptionContext'
import type { Contact, Job, TimeRange } from '@/types'

export function useNetworkData(userId: string | null) {
  const { isSubscribed } = useSubscription()
  const [contacts,      setContacts]      = useState<Contact[]>([])
  const [jobsByContact, setJobsByContact] = useState<Record<string, { id: string; title: string; company: string }[]>>({})
  const [jobs,          setJobs]          = useState<Job[]>([])
  const [loading,       setLoading]       = useState(true)
  const [capError,      setCapError]      = useState<string | null>(null)
  const [timeRange,     setTimeRangeState] = useState<TimeRange>(() => lsGet<string>(SK.networkTimeRange, 'all') as TimeRange)
  const [expOverrides,  setExpOverrides]  = useState<Record<string, number>>({})
  const [cooldownHours, setCooldownHours] = useState(168)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    setCooldownHours(getCommCooldownHours(userId))
    Promise.all([
      fetchContactsWithJobs(userId),
      fetchJobs(userId),
    ]).then(([{ contacts, jobsByContact }, jobs]) => {
      setContacts(contacts)
      setJobsByContact(jobsByContact)
      setJobs(jobs)
      const initial: Record<string, number> = {}
      for (const c of contacts) { if (c.commExp > 0) initial[c.id] = c.commExp }
      setExpOverrides(initial)
      setLoading(false)
    })
  }, [userId])

  const atCap = !isSubscribed && contacts.filter((c) => !c.id.startsWith('new-')).length >= FREE_CONTACT_CAP

  function handleAddContact(): Contact | null {
    if (!userId || atCap) return null
    const blank: Contact = {
      id: `new-${Date.now()}`,
      userId,
      name: '',
      lastInteractionAt: null,
      commExp: 0,
      lastCommAt: null,
      createdAt: new Date().toISOString(),
    }
    setContacts((prev) => [blank, ...prev])
    return blank
  }

  function handleDetailClose(detailContactId: string | null) {
    setContacts((prev) => prev.filter((c) => c.name.trim() !== '' || c.id !== detailContactId))
  }

  async function handleSave(contact: Contact, pendingJobIds: string[] = []): Promise<string | null> {
    if (!userId) return null
    if (contact.id.startsWith('new-')) {
      const { data, error } = await insertContact({
        userId,
        name: contact.name,
        company: contact.company,
        linkedin: contact.linkedin,
        github: contact.github,
        twitter: contact.twitter,
        discord: contact.discord,
        email: contact.email,
        notes: contact.notes,
        lastInteractionAt: contact.lastInteractionAt,
        commExp: 0,
        lastCommAt: null,
      }, userId, isSubscribed)
      if (error === 'contact_cap_reached') {
        setContacts((prev) => prev.filter((c) => c.id !== contact.id))
        setCapError(`Free accounts are limited to ${FREE_CONTACT_CAP} contacts. Upgrade to Pro for unlimited.`)
        return null
      }
      if (error) { console.error('[useNetworkData] insertContact:', error); return null }
      if (data) {
        await Promise.all(pendingJobIds.map((jobId) => linkContactToJob(data.id, jobId)))
        setContacts((prev) => prev.map((c) => c.id === contact.id ? data : c))
        return data.id
      }
    } else {
      await updateContact(contact)
    }
    return contact.id
  }

  async function handlePing(id: string) {
    setContacts((prev) =>
      prev.map((c) => c.id === id ? { ...c, lastInteractionAt: new Date().toISOString() } : c)
    )
    await pingContact(id)
  }

  async function handleDelete(ids: string[]) {
    await Promise.all(ids.map((id) => deleteContact(id)))
    setContacts((prev) => prev.filter((c) => !ids.includes(c.id)))
  }

  async function refreshJobsByContact() {
    if (!userId) return
    const { jobsByContact: updated } = await fetchContactsWithJobs(userId)
    setJobsByContact(updated)
  }

  function handleExpChange(id: string, exp: number) {
    const now = new Date().toISOString()
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, commExp: exp, lastCommAt: now } : c))
    setExpOverrides((prev) => ({ ...prev, [id]: exp }))
    updateContactExp(id, exp)
  }

  function handleTimeRange(r: TimeRange) {
    setTimeRangeState(r)
    lsSet(SK.networkTimeRange, r)
  }

  function handleUpgrade() {
    createCheckoutSession().catch(() => {})
  }

  return {
    contacts, setContacts,
    jobsByContact,
    jobs, setJobs,
    loading,
    capError, setCapError,
    timeRange,
    expOverrides,
    cooldownHours,
    atCap,
    isSubscribed,
    FREE_CONTACT_CAP,
    handleAddContact,
    handleDetailClose,
    handleSave,
    handlePing,
    handleDelete,
    refreshJobsByContact,
    handleExpChange,
    handleTimeRange,
    handleUpgrade,
  }
}
