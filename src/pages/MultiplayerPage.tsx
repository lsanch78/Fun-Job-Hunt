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

export default function MultiplayerPage({ userId: _userId }: { userId: string | null }) {
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
    // Discard the contact if it was never given a name
    setContacts((prev) => prev.filter((c) => c.name.trim() !== '' || c.id !== detailContactId))
    setDetailContactId(null)
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
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} in your network
          </p>
        </div>
        <button
          onClick={handleAddContact}
          className="text-[10px] px-3 py-1.5 border border-primary text-primary hover:bg-primary hover:text-bg transition-none"
        >
          + ADD CONTACT
        </button>
      </div>

      {/* Sort toolbar */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-x-4 gap-y-2">
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
        {contacts.length === 0 && (
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
            onPing={handlePing}
            onOpenDetail={setDetailContactId}
          />
        )}

      </div>

      {/* Contact detail card — used for both editing and adding */}
      {detailContactId && (
        <ContactDetailCard
          contacts={contacts}
          contactId={detailContactId}
          onClose={handleDetailClose}
          onChange={(updated) =>
            setContacts((prev) => prev.map((c) => c.id === updated.id ? updated : c))
          }
        />
      )}
    </div>
  )
}
