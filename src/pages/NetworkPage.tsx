import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import TutorialOverlay from '@/components/TutorialOverlay'
import { registerTutorialTrigger, unregisterTutorialTrigger, broadcastTutorialActive } from '@/lib/tutorialBus'
import { NETWORK_STEPS } from '@/lib/tutorialSteps'
import ContactList, { type SortBy } from '@/components/ContactList'
import ContactDetailCard from '@/components/ContactDetailCard'
import AppDetailCard from '@/components/AppDetailCard'
import SearchBar from '@/components/SearchBar'
import NetworkBackdrop from '@/components/NetworkBackdrop'
import type { Contact, Job } from '@/types'
import {
  fetchContactsWithJobs, insertContact, updateContact, pingContact, linkContactToJob, deleteContact, updateContactExp,
} from '@/services/contactService'
import { playDeleteBump, playTrash, playNetworkMapOpen, playNetworkMapClose } from '@/lib/sfx'
import { getCommCooldownHours } from '@/lib/commSettings'
import { Trash } from 'pixelarticons/react'
import { fetchJobs } from '@/services/jobService'

// ── Time range ────────────────────────────────────────────────────────────────
type TimeRange = 'today' | '7d' | '30d' | 'year' | 'all'

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'TODAY'    },
  { value: '7d',    label: 'LAST 7D'  },
  { value: '30d',   label: 'LAST 30D' },
  { value: 'year',  label: 'YEAR'     },
  { value: 'all',   label: 'ALL TIME' },
]

function getTimeRangeCutoff(range: TimeRange): string | null {
  if (range === 'all') return null
  const d = new Date()
  if (range === 'today') {
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
  }
  if (range === '7d')   d.setDate(d.getDate() - 6)
  if (range === '30d')  d.setDate(d.getDate() - 29)
  if (range === 'year') d.setFullYear(d.getFullYear() - 1)
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NetworkPage({ userId }: { userId: string | null }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showTutorial, setShowTutorial] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [jobsByContact, setJobsByContact] = useState<Record<string, { id: string; title: string; company: string }[]>>({})
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('recent')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')
  const [timeRange, setTimeRange] = useState<TimeRange>(() => lsGet<string>(SK.networkTimeRange, 'all') as TimeRange)
  const [detailContactId, setDetailContactId] = useState<string | null>(null)
  const [detailJobId, setDetailJobId] = useState<string | null>(null)
  const [deleteMode, setDeleteMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [networkMapView, setNetworkMapView] = useState(false)
  const [expOverrides, setExpOverrides] = useState<Record<string, number>>({})
  const [cooldownHours, setCooldownHours] = useState(168)
  const [page, setPage] = useState(1)
  const [totalFiltered, setTotalFiltered] = useState(0)
  const PAGE_SIZE = 30

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && networkMapView) {
        playNetworkMapClose()
        setNetworkMapView(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [networkMapView])

  useEffect(() => {
    if (searchParams.get('tutorial') === '1') {
      setShowTutorial(true)
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { broadcastTutorialActive(showTutorial) }, [showTutorial])

  useEffect(() => {
    registerTutorialTrigger(() => setShowTutorial(true))
    if (!userId) return () => { unregisterTutorialTrigger() }
    const seen = lsGet<boolean>(SK.tutorialSeen(userId, 'network'), false)
    if (!seen) {
      const id = setTimeout(() => setShowTutorial(true), 800)
      return () => { clearTimeout(id); unregisterTutorialTrigger() }
    }
    return () => { unregisterTutorialTrigger() }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (error) { console.error('[NetworkPage] insertContact:', error); return }
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

  useEffect(() => { setPage(1) }, [search, sortBy, sortDir, timeRange])

  function handleTimeRange(r: TimeRange) {
    setTimeRange(r)
    lsSet(SK.networkTimeRange, r)
  }

  const cutoff = getTimeRangeCutoff(timeRange)
  const rangeContacts = contacts.filter((c) => {
    if (cutoff === null) return true
    const dateStr = c.createdAt.slice(0, 10)
    if (timeRange === 'today') return dateStr === cutoff
    return dateStr >= cutoff
  })

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
      <div data-tutorial="network-header" className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 min-h-[100px]">
        <div>
          <h1 className="text-sm tracking-widest">NETWORK</h1>
          <p className="text-muted text-xs mt-1">
            {loading ? '…' : `${contacts.length} contact${contacts.length !== 1 ? 's' : ''} in your network`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {contacts.length > 0 && (
            <button
              onClick={() => setNetworkMapView((v) => { v ? playNetworkMapClose() : playNetworkMapOpen(); return !v })}
              className={`text-[10px] px-3 py-1.5 border transition-none ${
                networkMapView
                  ? 'border-primary text-primary'
                  : 'border-border text-muted hover:border-secondary hover:text-secondary'
              }`}
            >
              YOUR NETWORK
            </button>
          )}
          <button
            onClick={handleAddContact}
            className="text-[10px] px-3 py-1.5 border border-primary text-primary hover:bg-primary hover:text-bg transition-none"
          >
            + ADD CONTACT
          </button>
        </div>
      </div>

      {/* Filter / sort toolbar */}
      <div data-tutorial="network-toolbar" className="px-4 py-2 border-b border-border flex flex-col gap-y-2">
        {/* Row 1: search + sort + delete */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5 min-w-[160px]">
            <SearchBar value={search} onChange={setSearch} placeholder="search contacts…" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted text-[10px] mr-1 select-none">SORT</span>
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  if (sortBy === key) {
                    if (sortDir === 'asc') { setSortDir('desc') }
                    else { setSortBy('recent'); setSortDir('asc') }
                  } else {
                    setSortBy(key)
                    setSortDir('asc')
                  }
                }}
                className={`text-[10px] px-2 py-0.5 border transition-none ${
                  sortBy === key
                    ? 'border-primary text-primary'
                    : 'border-border text-muted hover:border-secondary hover:text-secondary'
                }`}
              >
                {label}{sortBy === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 ml-auto">
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
        {/* Row 2: time range */}
        <div className="flex items-center gap-1">
          <span className="text-muted text-[10px] mr-1 select-none">RANGE</span>
          {TIME_RANGE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleTimeRange(value)}
              className={`text-[10px] px-2 py-0.5 border transition-none ${
                timeRange === value
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
      <div data-tutorial="network-list" className="overflow-hidden flex-1 relative">

        {/* Animated network backdrop */}
        {!loading && contacts.length > 0 && (
          <NetworkBackdrop contacts={contacts} jobsByContact={jobsByContact} expanded={networkMapView} expOverrides={expOverrides} />
        )}

        {/* Empty state */}
        {!loading && contacts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-6 py-24 px-6 text-center">
            <button
              onClick={handleAddContact}
              className="text-[10px] px-4 py-2 border border-primary text-primary hover:bg-primary hover:text-bg transition-none"
            >
              + ADD YOUR FIRST CONTACT
            </button>
          </div>
        )}

        {/* Contact table — fades out in network map view */}
        {contacts.length > 0 && (
          <div
            style={{
              opacity: networkMapView ? 0 : 1,
              pointerEvents: networkMapView ? 'none' : undefined,
              transition: 'opacity 600ms ease',
              overflowY: 'auto',
              height: '100%',
            }}
          >
          <ContactList
            contacts={rangeContacts}
            sortBy={sortBy}
            sortDir={sortDir}
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
            cooldownHours={cooldownHours}
            userId={userId}
            onExpChange={(id, exp) => {
              const now = new Date().toISOString()
              setContacts((prev) => prev.map((c) => c.id === id ? { ...c, commExp: exp, lastCommAt: now } : c))
              setExpOverrides((prev) => ({ ...prev, [id]: exp }))
              updateContactExp(id, exp)
            }}
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

      {showTutorial && userId && (
        <TutorialOverlay steps={NETWORK_STEPS} screen="network" userId={userId} onDone={() => setShowTutorial(false)} />
      )}
    </div>
  )
}
