import { useState } from 'react'
import ContactList, { type SortBy } from '@/components/contacts/ContactList'
import ContactDetailModal from '@/components/contacts/ContactDetailModal'
import JobDetailModal from '@/components/joblog/JobDetailModal'
import SearchBar from '@/components/shell/SearchBar'
import type { Contact } from '@/types'
import { useNetworkData } from '@/hooks/network/useNetworkData'

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MobileNetworkPage({ userId }: { userId: string | null }) {
  const {
    contacts, setContacts,
    jobsByContact,
    jobs, setJobs,
    loading,
    capError, setCapError,
    atCap,
    FREE_CONTACT_CAP,
    handleAddContact,
    handleDetailClose,
    handleSave,
    handlePing,
    refreshJobsByContact,
    handleUpgrade,
  } = useNetworkData(userId)

  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [search, setSearch] = useState('')
  const [detailContactId, setDetailContactId] = useState<string | null>(null)
  const [detailJobId, setDetailJobId] = useState<string | null>(null)

  function addAndOpen() {
    const blank = handleAddContact()
    if (blank) setDetailContactId(blank.id)
  }

  function closeDetail() {
    handleDetailClose(detailContactId)
    setDetailContactId(null)
  }

  async function saveAndUpdateDetail(contact: Contact, pendingJobIds: string[] = []) {
    const newId = await handleSave(contact, pendingJobIds)
    if (newId && contact.id.startsWith('new-')) setDetailContactId(newId)
  }

  const SORT_OPTIONS: { key: SortBy; label: string }[] = [
    { key: 'exp',  label: 'EXP' },
    { key: 'name', label: 'A-Z' },
    { key: 'date', label: 'DT'  },
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
          {capError && (
            <div className="flex items-center gap-2 mt-1 border border-warning px-2 py-1.5">
              <p className="font-pixel text-[8px] text-warning flex-1">Limit: {FREE_CONTACT_CAP} contacts on free.</p>
              <button
                onClick={handleUpgrade}
                className="font-pixel text-[8px] px-2 py-1 border border-secondary text-secondary hover:opacity-80 transition-none shrink-0"
              >
                UPGRADE
              </button>
              <button onClick={() => setCapError(null)} className="text-muted hover:text-primary text-[10px] shrink-0">✕</button>
            </div>
          )}
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
            onClick={addAndOpen}
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
          onUpgrade={handleUpgrade}
        />
      )}

      {/* FAB */}
      <button
        onClick={addAndOpen}
        disabled={atCap}
        className="fixed bottom-16 right-4 z-[180] w-12 h-12 bg-primary text-bg font-pixel text-2xl flex items-center justify-center border-2 border-bg shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
        title={atCap ? `Contact limit reached (${FREE_CONTACT_CAP} max on free)` : 'Add contact'}
        aria-label="Add contact"
      >
        +
      </button>

      {detailContactId && (
        <ContactDetailModal
          contacts={contacts}
          contactId={detailContactId}
          onClose={() => { closeDetail(); refreshJobsByContact() }}
          onChange={(updated) =>
            setContacts((prev) => prev.map((c) => c.id === updated.id ? updated : c))
          }
          onSave={saveAndUpdateDetail}
          userId={userId}
          fullScreen
        />
      )}

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
