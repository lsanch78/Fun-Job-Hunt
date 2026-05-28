import { useState, useEffect } from 'react'
import ContactList, { type SortBy } from '@/components/ContactList'
import ContactDetailCard from '@/components/ContactDetailCard'
import AppDetailCard from '@/components/AppDetailCard'
import SearchBar from '@/components/SearchBar'
import type { Contact, Job } from '@/types'
import {
  fetchContactsWithJobs, insertContact, updateContact, pingContact, linkContactToJob,
} from '@/services/contactService'
import { fetchJobs } from '@/services/jobService'

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MultiplayerPage({ userId }: { userId: string | null }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [jobsByContact, setJobsByContact] = useState<Record<string, { id: string; title: string; company: string }[]>>({})
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('status')
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
      }, userId)
      if (error) { console.error('[MultiplayerPage] insertContact:', error); return }
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
    { key: 'status', label: 'STATUS' },
    { key: 'name',   label: 'NAME' },
    { key: 'date',   label: 'DATE' },
  ]

  return (
    <div className="h-full bg-bg font-pixel text-primary scanlines flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 min-h-[100px]">
        <div>
          <h1 className="text-sm tracking-widest">MULTIPLAYER</h1>
          <p className="text-muted text-xs mt-1">
            {loading ? '…' : `${contacts.length} contact${contacts.length !== 1 ? 's' : ''} in your network`}
          </p>
        </div>
        <button
          onClick={handleAddContact}
          className="text-[10px] px-3 py-1.5 border border-primary text-primary hover:bg-primary hover:text-bg transition-none"
        >
          + ADD CONTACT
        </button>
      </div>

      {/* Sort + search toolbar */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-x-4 gap-y-2">
        <SearchBar value={search} onChange={setSearch} placeholder="search contacts…" />
        <div className="flex items-center gap-1">
          <span className="text-muted text-[10px] mr-1 select-none">SORT</span>
          {SORT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`text-[10px] px-2 py-0.5 border transition-none
                ${sortBy === key
                  ? 'border-primary text-primary'
                  : 'border-border text-muted hover:border-secondary hover:text-secondary'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="overflow-auto flex-1">

        {/* Empty state */}
        {!loading && contacts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-6 py-24 px-6 text-center">
            <p className="font-terminal text-2xl text-muted leading-snug max-w-sm">
              "YOUR NETWORK IS YOUR NET WORTH.<br />START WITH ONE ALLY."
            </p>
            <button
              onClick={handleAddContact}
              className="text-[10px] px-4 py-2 border border-primary text-primary hover:bg-primary hover:text-bg transition-none"
            >
              + ADD YOUR FIRST CONTACT
            </button>
          </div>
        )}

        {/* Contact table */}
        {contacts.length > 0 && (
          <ContactList
            contacts={contacts}
            sortBy={sortBy}
            search={search}
            onPing={handlePing}
            onOpenDetail={setDetailContactId}
            jobsByContact={jobsByContact}
            onOpenJob={setDetailJobId}
          />
        )}

      </div>

      {/* Contact detail card */}
      {detailContactId && (
        <ContactDetailCard
          contacts={contacts}
          contactId={detailContactId}
          onClose={() => { handleDetailClose(); refreshJobsByContact() }}
          onChange={(updated) =>
            setContacts((prev) => prev.map((c) => c.id === updated.id ? updated : c))
          }
          onSave={handleSave}
          userId={userId}
        />
      )}

      {/* App detail card — opened from an Apps chip */}
      {detailJobId && (
        <AppDetailCard
          jobs={jobs}
          jobId={detailJobId}
          userId={userId}
          onClose={() => setDetailJobId(null)}
          onChange={(updated) =>
            setJobs((prev) => prev.map((j) => j.id === updated.id ? updated : j))
          }
        />
      )}
    </div>
  )
}
