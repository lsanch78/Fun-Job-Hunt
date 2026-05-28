import { useState, useEffect } from 'react'
import ContactList, { type SortBy } from '@/components/ContactList'
import ContactDetailCard from '@/components/ContactDetailCard'
import AppDetailCard from '@/components/AppDetailCard'
import SearchBar from '@/components/SearchBar'
import NetworkBackdrop from '@/components/NetworkBackdrop'
import UniverseQuote from '@/components/UniverseQuote'
import type { Contact, Job } from '@/types'
import {
  fetchContactsWithJobs, insertContact, updateContact, pingContact, linkContactToJob, deleteContact,
} from '@/services/contactService'
import { playDeleteBump, playTrash, playUniverseOpen, playUniverseClose } from '@/lib/sfx'
import { Trash } from 'pixelarticons/react'
import { fetchJobs } from '@/services/jobService'

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MultiplayerPage({ userId }: { userId: string | null }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [jobsByContact, setJobsByContact] = useState<Record<string, { id: string; title: string; company: string }[]>>({})
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [search, setSearch] = useState('')
  const [detailContactId, setDetailContactId] = useState<string | null>(null)
  const [detailJobId, setDetailJobId] = useState<string | null>(null)
  const [deleteMode, setDeleteMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [universeView, setUniverseView] = useState(false)
  const [page, setPage] = useState(1)
  const [totalFiltered, setTotalFiltered] = useState(0)
  const PAGE_SIZE = 30

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

  function toggleDeleteMode() {
    setDeleteMode((prev) => { if (!prev) playDeleteBump(); return !prev })
    setSelected(new Set())
  }

  function handleToggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleDelete() {
    const ids = [...selected]
    playTrash(ids.length)
    await Promise.all(ids.map((id) => deleteContact(id)))
    setContacts((prev) => prev.filter((c) => !ids.includes(c.id)))
    setSelected(new Set())
    setDeleteMode(false)
  }

  useEffect(() => { setPage(1) }, [search, sortBy])

  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)

  const SORT_OPTIONS: { key: SortBy; label: string }[] = [
    { key: 'name',    label: 'NAME' },
    { key: 'company', label: 'COMPANY' },
    { key: 'exp',  label: 'EXP' },
    { key: 'date',    label: 'DATE' },
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
        <div className="flex items-center gap-1 ml-auto">
          {contacts.length > 0 && (
            <button
              onClick={() => setUniverseView((v) => { v ? playUniverseClose() : playUniverseOpen(); return !v })}
              className={`text-[10px] px-2 py-0.5 border transition-none ${
                universeView
                  ? 'border-primary text-primary'
                  : 'border-border text-muted hover:border-secondary hover:text-secondary'
              }`}
            >
              UNIVERSE
            </button>
          )}
          {deleteMode && selected.size > 0 && (
            <button
              onClick={handleDelete}
              className="text-[10px] px-2 py-0.5 border border-warning text-warning hover:border-secondary hover:text-secondary transition-none"
            >
              DELETE {selected.size} CONTACT{selected.size !== 1 ? 'S' : ''}
            </button>
          )}
          <button
            onClick={toggleDeleteMode}
            className={`text-[10px] px-2 py-0.5 border transition-none flex items-center gap-1 ${
              deleteMode
                ? 'border-warning text-warning hover:border-secondary hover:text-secondary'
                : 'border-border text-muted hover:border-secondary hover:text-secondary'
            }`}
            title={deleteMode ? 'Cancel' : 'Delete mode'}
          >
            {deleteMode ? 'X' : <Trash width={12} height={12} />}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="overflow-hidden flex-1 relative">

        {/* Animated network backdrop */}
        {!loading && contacts.length > 0 && (
          <NetworkBackdrop contacts={contacts} jobsByContact={jobsByContact} expanded={universeView} />
        )}

        {/* Universe quotes */}
        <UniverseQuote visible={universeView} />

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

        {/* Contact table — fades out in universe view */}
        {contacts.length > 0 && (
          <div
            style={{
              opacity: universeView ? 0 : 1,
              pointerEvents: universeView ? 'none' : undefined,
              transition: 'opacity 600ms ease',
              overflowY: 'auto',
              height: '100%',
            }}
          >
          <ContactList
            contacts={contacts}
            sortBy={sortBy}
            search={search}
            onPing={handlePing}
            onOpenDetail={setDetailContactId}
            jobsByContact={jobsByContact}
            onOpenJob={setDetailJobId}
            deleteMode={deleteMode}
            selected={selected}
            onToggle={handleToggle}
            page={safePage}
            pageSize={PAGE_SIZE}
            onTotalFiltered={setTotalFiltered}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="text-[10px] px-2 py-0.5 border border-border text-muted hover:border-secondary hover:text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-none"
              >
                ← PREV
              </button>
              <span className="text-muted text-[10px]">
                {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="text-[10px] px-2 py-0.5 border border-border text-muted hover:border-secondary hover:text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-none"
              >
                NEXT →
              </button>
              <span className="text-muted text-[10px] ml-2">
                {totalFiltered} contacts
              </span>
            </div>
          )}
          </div>
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
