import { useState, useEffect } from 'react'
import ContactList, { type SortBy } from '@/components/contacts/ContactList'
import ContactDetailModal from '@/components/contacts/ContactDetailModal'
import JobDetailModal from '@/components/joblog/JobDetailModal'
import SearchBar from '@/components/shell/SearchBar'
import type { Contact, Job } from '@/types'
import {
  fetchContactsWithJobs, insertContact, updateContact, pingContact, linkContactToJob,
} from '@/services/contactService'
import { fetchJobs } from '@/services/jobService'

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MobileNetworkPage({ userId }: { userId: string | null }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [jobsByContact, setJobsByContact] = useState<Record<string, { id: string; title: string; company: string }[]>>({})
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [search, setSearch] = useState('')
  const [detailContactId, setDetailContactId] = useState<string | null>(null)
  const [detailJobId, setDetailJobId] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    Promise.all([
      fetchContactsWithJobs(userId),
      fetchJobs(userId),
    ]).then(([{ contacts, jobsByContact }, jobs]) => {
      setContacts(contacts)
      setJobsByContact(jobsByContact)
      setJobs(jobs)
      setLoading(false)
    })
  }, [userId])

  async function handlePing(id: string) {
    setContacts((prev) =>
      prev.map((c) => c.id === id ? { ...c, lastInteractionAt: new Date().toISOString() } : c)
    )
    await pingContact(id)
  }

  function handleAddContact() {
    if (!userId) return
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
    setDetailContactId(blank.id)
  }

  function handleDetailClose() {
    setContacts((prev) => prev.filter((c) => c.name.trim() !== '' || c.id !== detailContactId))
    setDetailContactId(null)
  }

  async function handleSave(contact: Contact, pendingJobIds: string[] = []) {
    if (!userId) return
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
      }, userId)
      if (error) { console.error('[MobileNetworkPage] insertContact:', error); return }
      if (data) {
        await Promise.all(pendingJobIds.map((jobId) => linkContactToJob(data.id, jobId)))
        setContacts((prev) => prev.map((c) => c.id === contact.id ? data : c))
        setDetailContactId(data.id)
      }
    } else {
      await updateContact(contact)
    }
  }

  async function refreshJobsByContact() {
    if (!userId) return
    const { jobsByContact: updated } = await fetchContactsWithJobs(userId)
    setJobsByContact(updated)
  }

  const SORT_OPTIONS: { key: SortBy; label: string }[] = [
    { key: 'exp', label: 'EXP' },
    { key: 'name',   label: 'A-Z' },
    { key: 'date',   label: 'DT' },
  ]

  return (
    <div className="h-full overflow-y-auto bg-bg text-primary scanlines pb-24">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-xs tracking-widest">NETWORK</h1>
          <p className="font-pixel text-[9px] text-muted mt-0.5">
            {loading ? '…' : `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Search + sort toolbar */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="search…" className="flex-1" />
        <div className="flex items-center gap-1 shrink-0">
          {SORT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`font-pixel text-[8px] px-1.5 py-0.5 border transition-none
                ${sortBy === key
                  ? 'border-primary text-primary'
                  : 'border-border text-muted'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {!loading && contacts.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-5 py-20 px-6 text-center">
          <p className="font-terminal text-xl text-muted leading-snug">
            "YOUR NETWORK IS YOUR NET WORTH."
          </p>
          <button
            onClick={handleAddContact}
            className="font-pixel text-[9px] px-4 py-2 border border-primary text-primary hover:bg-primary hover:text-bg transition-none"
          >
            + ADD FIRST CONTACT
          </button>
        </div>
      )}

      {/* Contact cards */}
      {contacts.length > 0 && (
        <ContactList
          contacts={contacts}
          sortBy={sortBy}
          search={search}
          onPing={handlePing}
          onOpenDetail={setDetailContactId}
          jobsByContact={jobsByContact}
          onOpenJob={setDetailJobId}
          mobile
        />
      )}

      {/* FAB */}
      <button
        onClick={handleAddContact}
        className="fixed bottom-16 right-4 z-[180] w-12 h-12 bg-primary text-bg font-pixel text-2xl flex items-center justify-center border-2 border-bg shadow-lg"
        title="Add contact"
        aria-label="Add contact"
      >
        +
      </button>

      {/* Contact detail card */}
      {detailContactId && (
        <ContactDetailModal
          contacts={contacts}
          contactId={detailContactId}
          onClose={() => { handleDetailClose(); refreshJobsByContact() }}
          onChange={(updated) =>
            setContacts((prev) => prev.map((c) => c.id === updated.id ? updated : c))
          }
          onSave={handleSave}
          userId={userId}
          fullScreen
        />
      )}

      {/* App detail card — opened from an Apps chip */}
      {detailJobId && (
        <JobDetailModal
          jobs={jobs}
          jobId={detailJobId}
          userId={userId}
          onClose={() => setDetailJobId(null)}
          onChange={(updated) =>
            setJobs((prev) => prev.map((j) => j.id === updated.id ? updated : j))
          }
          fullScreen
        />
      )}
    </div>
  )
}
