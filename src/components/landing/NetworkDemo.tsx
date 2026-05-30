import { useEffect, useRef, useState } from 'react'
import NetworkBackdrop from '@/components/shell/NetworkBackdrop'
import { playLinkBlip, playPingBlip } from '@/lib/sfx'
import type { Contact } from '@/types'

// ── Exp helpers (mirrors ContactList) ─────────────────────────────────────────
function getExpRank(exp: number): { level: number; title: string; barColor: string } {
  if (exp >= 80) return { level: 5, title: 'Champion', barColor: '#22c55e' }
  if (exp >= 60) return { level: 4, title: 'Ally',     barColor: '#84cc16' }
  if (exp >= 40) return { level: 3, title: 'Contact',  barColor: '#eab308' }
  if (exp >= 20) return { level: 2, title: 'Prospect', barColor: '#f97316' }
  if (exp > 0)   return { level: 1, title: 'Stranger', barColor: '#ef4444' }
  return               { level: 0, title: 'Unknown',  barColor: '#555555' }
}

function ExpBar({ exp }: { exp: number }) {
  const { level, title, barColor } = getExpRank(exp)
  return (
    <div className="flex flex-col gap-0.5 w-20 shrink-0">
      <div className="h-1.5 w-full bg-border overflow-hidden">
        <div className="h-full transition-all duration-500" style={{ width: `${exp}%`, backgroundColor: barColor }} />
      </div>
      <span className="font-pixel text-[8px] text-muted leading-none">LVL {level} · {title}</span>
    </div>
  )
}

// ── Seed contacts ─────────────────────────────────────────────────────────────
function makeContact(id: string, name: string, company: string, daysAgo: number | null): Contact {
  return {
    id,
    userId: 'demo',
    name,
    company,
    lastInteractionAt: daysAgo === null ? null : new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    commExp: daysAgo === null ? 0 : daysAgo === 0 ? 100 : daysAgo <= 7 ? 85 : daysAgo <= 14 ? 65 : daysAgo <= 30 ? 45 : 20,
    lastCommAt: daysAgo === null ? null : new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
  }
}

const SEED_CONTACTS: Contact[] = [
  makeContact('c1', 'Ada Lovelace',    'Aperture Science', 2),
  makeContact('c2', 'Alan Turing',     'Initech',          9),
  makeContact('c3', 'Grace Hopper',    'Umbrella Corp',    25),
  makeContact('c4', 'Linus Torvalds',  'Vault-Tec',        null),
]

const SEED_JOBS: Record<string, { id: string; title: string; company: string }[]> = {
  c1: [{ id: 'j1', title: 'Frontend Engineer', company: 'Aperture Science' }],
  c2: [{ id: 'j2', title: 'Sr. React Dev',     company: 'Initech'          }],
  c3: [],
  c4: [],
}

let nextContactNum = SEED_CONTACTS.length + 1

const DEMO_NAMES = [
  'Dennis Ritchie', 'Guido van Rossum', 'Margaret Hamilton', 'John von Neumann',
  'Tim Berners-Lee', 'Ken Thompson', 'Barbara Liskov', 'Donald Knuth',
]

const DEMO_COMPANIES = [
  'Weyland-Yutani', 'Cyberdyne Systems', 'Soylent Corp', 'Tyrell Corp',
  'Buy n Large', 'Omni Consumer Products', 'InGen', 'Rekall Inc',
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function NetworkDemo({ mouse }: { mouse: { x: number; y: number } }) {
  const [contacts, setContacts] = useState<Contact[]>(SEED_CONTACTS)
  const [jobsByContact, setJobsByContact] = useState(SEED_JOBS)
  const [expOverrides, setExpOverrides] = useState<Record<string, number>>(
    () => Object.fromEntries(SEED_CONTACTS.map(c => [c.id, c.commExp]))
  )
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [revealed, setRevealed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 1400)
    return () => clearTimeout(t)
  }, [])

  function handleAdd() {
    const n = name.trim() || DEMO_NAMES[(nextContactNum - 1) % DEMO_NAMES.length]
    const co = company.trim() || DEMO_COMPANIES[(nextContactNum - 1) % DEMO_COMPANIES.length]
    const id = `demo-${nextContactNum++}`
    const now = new Date().toISOString()
    const newContact: Contact = {
      id,
      userId: 'demo',
      name: n,
      company: co,
      lastInteractionAt: now,
      commExp: 85,
      lastCommAt: now,
      createdAt: now,
    }
    setContacts(prev => [newContact, ...prev])
    setJobsByContact(prev => ({ ...prev, [id]: [] }))
    setExpOverrides(prev => ({ ...prev, [id]: 85 }))
    playLinkBlip()
    setName('')
    setCompany('')
    inputRef.current?.focus()
  }

  function handlePing(id: string) {
    playPingBlip()
    const now = new Date().toISOString()
    setContacts(prev => prev.map(c => c.id === id ? { ...c, lastInteractionAt: now, commExp: Math.min(100, (c.commExp ?? 0) + 15) } : c))
    setExpOverrides(prev => ({ ...prev, [id]: Math.min(100, (prev[id] ?? 0) + 15) }))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd()
  }

  const TILT_MAX = 3
  const rotX = -mouse.y * TILT_MAX
  const rotY = mouse.x * TILT_MAX

  return (
    <div
      style={{
        transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
        transition: 'transform 0.12s linear',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        position: 'relative',
      }}
    >
      {/* depth shadow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'translateZ(-20px)',
          background: 'var(--color-border)',
          opacity: 0.5,
        }}
      />

      {/* panel face */}
      <div
        className="border border-border bg-bg font-pixel text-primary overflow-hidden"
        style={{ transform: 'translateZ(0)', position: 'relative' }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* ── Live network graph backdrop ─────────────────────────── */}
        <div className="relative" style={{ height: '200px' }}>
          <NetworkBackdrop
            contacts={contacts}
            jobsByContact={jobsByContact}
            expanded={false}
            expOverrides={expOverrides}
          />
          {/* overlay label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[9px] text-muted tracking-widest opacity-60">YOUR NETWORK</span>
          </div>
        </div>

        {/* ── Add row ─────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-b border-border flex gap-2 items-center bg-surface">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Name…"
            maxLength={30}
            className="bg-transparent border-b border-border focus:border-primary outline-none text-xs text-primary placeholder-muted font-pixel py-0.5 w-32 min-w-0"
          />
          <input
            type="text"
            value={company}
            onChange={e => setCompany(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Company…"
            maxLength={30}
            className="bg-transparent border-b border-border focus:border-primary outline-none text-xs text-primary placeholder-muted font-pixel py-0.5 flex-1 min-w-0"
          />
          <button
            onClick={handleAdd}
            className="text-[10px] px-3 py-1 border border-primary text-primary hover:bg-primary hover:text-bg transition-colors"
          >
            + ADD
          </button>
        </div>

        {/* ── Contact rows ────────────────────────────────────────── */}
        <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
          <table className="border-collapse text-xs w-full">
            <thead>
              <tr className="border-b border-border text-muted text-left select-none">
                <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal">NAME</th>
                <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal">COMPANY</th>
                <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal">COMM EXP</th>
                <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(contact => (
                <tr key={contact.id} className="border-b border-border hover:bg-surface transition-none">
                  <td className="px-3 py-2 text-xs text-primary truncate max-w-[120px]">{contact.name}</td>
                  <td className="px-3 py-2 text-xs text-muted truncate max-w-[120px]">{contact.company ?? '—'}</td>
                  <td className="px-3 py-2">
                    <ExpBar exp={expOverrides[contact.id] ?? contact.commExp} />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={e => { e.stopPropagation(); handlePing(contact.id) }}
                      className="text-[9px] px-2 py-0.5 border border-border text-muted hover:border-secondary hover:text-secondary transition-none whitespace-nowrap"
                      title="Ping contact — boosts EXP"
                    >
                      PING
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="px-4 py-2 border-t border-border flex items-center justify-between">
          <span className="text-[9px] text-muted tracking-widest">
            {contacts.length} CONTACT{contacts.length !== 1 ? 'S' : ''} IN YOUR NETWORK
          </span>
          <span className="text-[9px] text-muted tracking-widest">PING TO BOOST EXP</span>
        </div>

        {/* CRT scanline overlay */}
        {revealed && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)',
              backgroundSize: '100% 4px',
              animation: 'demo-scanlines-scroll 0.3s linear infinite',
              mixBlendMode: 'multiply',
            }}
          />
        )}
      </div>
    </div>
  )
}
