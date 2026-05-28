import { useState } from 'react'
import ContactList, { type MockContact, type SortBy } from '@/components/ContactList'
import ContactDetailCard from '@/components/ContactDetailCard'

// ── Mock data (phase 1 — replaced by DB in phase 2) ──────────────────────────

const MOCK_CONTACTS: MockContact[] = [
  {
    id: '1',
    name: 'John Smith',
    linkedin: 'johnsmith',
    github: 'jsmith',
    email: 'john@example.com',
    apps: ['SWE @ Anthropic', 'Staff Eng @ Vercel'],
    lastInteractionAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    id: '2',
    name: 'Jane Doe',
    linkedin: 'janedoe',
    apps: ['Product Designer @ Linear'],
    lastInteractionAt: new Date(Date.now() - 22 * 86_400_000).toISOString(),
  },
  {
    id: '3',
    name: 'Alex Rivera',
    discord: 'alex#1234',
    linkedin: 'alexrivera',
    twitter: 'alexr',
    lastInteractionAt: null,
  },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MobileMultiplayerPage({ userId: _userId }: { userId: string | null }) {
  const [contacts, setContacts] = useState<MockContact[]>(MOCK_CONTACTS)
  const [sortBy, setSortBy] = useState<SortBy>('status')
  const [detailContactId, setDetailContactId] = useState<string | null>(null)

  function handlePing(id: string) {
    setContacts((prev) =>
      prev.map((c) => c.id === id ? { ...c, lastInteractionAt: new Date().toISOString() } : c)
    )
  }

  function handleAddContact() {
    const blank: MockContact = {
      id: `new-${Date.now()}`,
      name: '',
      lastInteractionAt: null,
    }
    setContacts((prev) => [blank, ...prev])
    setDetailContactId(blank.id)
  }

  function handleDetailClose() {
    setContacts((prev) => prev.filter((c) => c.name.trim() !== '' || c.id !== detailContactId))
    setDetailContactId(null)
  }

  const SORT_OPTIONS: { key: SortBy; label: string }[] = [
    { key: 'status', label: 'ST' },
    { key: 'name',   label: 'A-Z' },
    { key: 'date',   label: 'DT' },
  ]

  return (
    <div className="h-full overflow-y-auto bg-bg text-primary scanlines pb-24">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-xs tracking-widest">MULTIPLAYER</h1>
          <p className="font-pixel text-[9px] text-muted mt-0.5">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </p>
        </div>
        {/* Compact sort strip */}
        <div className="flex items-center gap-1">
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
      {contacts.length === 0 && (
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
          onPing={handlePing}
          onOpenDetail={setDetailContactId}
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

      {/* Contact detail card — used for both editing and adding (full screen on mobile) */}
      {detailContactId && (
        <ContactDetailCard
          contacts={contacts}
          contactId={detailContactId}
          onClose={handleDetailClose}
          onChange={(updated) =>
            setContacts((prev) => prev.map((c) => c.id === updated.id ? updated : c))
          }
          fullScreen
        />
      )}
    </div>
  )
}
