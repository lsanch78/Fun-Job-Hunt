import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Terminal } from 'pixelarticons/react'
import { playPingBlip } from '@/lib/sfx'
import type { Contact } from '@/types'

export type { Contact }
export type SortBy = 'exp' | 'name' | 'company' | 'date'

// ── Exp helpers ───────────────────────────────────────────────────────────────

type ExpTier = 'excellent' | 'good' | 'fair' | 'low' | 'dead'

interface ExpInfo {
  pct: number
  tier: ExpTier
  daysAgo: number | null
  barColor: string
}

function computeExp(lastInteractionAt: string | null): ExpInfo {
  if (!lastInteractionAt) return { pct: 0,   tier: 'dead',      daysAgo: null, barColor: '#555555' }
  const days = Math.floor((Date.now() - new Date(lastInteractionAt).getTime()) / 86_400_000)
  if (days === 0)  return { pct: 100, tier: 'excellent', daysAgo: 0,    barColor: '#22c55e' }
  if (days <= 7)   return { pct: 100, tier: 'excellent', daysAgo: days, barColor: '#22c55e' }
  if (days <= 14)  return { pct: 75,  tier: 'good',      daysAgo: days, barColor: '#84cc16' }
  if (days <= 30)  return { pct: 50,  tier: 'fair',      daysAgo: days, barColor: '#eab308' }
  if (days <= 60)  return { pct: 25,  tier: 'low',       daysAgo: days, barColor: '#f97316' }
  return             { pct: 5,   tier: 'dead',      daysAgo: days, barColor: '#ef4444' }
}


// ── ExpBar ────────────────────────────────────────────────────────────────────

function ExpBar({ lastInteractionAt }: { lastInteractionAt: string | null }) {
  const { pct, barColor, daysAgo } = computeExp(lastInteractionAt)
  const hasHistory = daysAgo !== null
  const level = hasHistory ? 5 : 1
  const title = hasHistory ? 'Ally' : 'Prospect'
  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="h-1.5 w-full bg-border overflow-hidden">
        <div
          className="h-full transition-none"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="font-pixel text-[9px] text-muted leading-none flex flex-col">
        <span>LVL {level}</span>
        <span>{title}</span>
      </span>
    </div>
  )
}

// ── SocialIcons ───────────────────────────────────────────────────────────────

const PLATFORM_BASES: Record<string, string> = {
  linkedin: 'https://linkedin.com/in/',
  github:   'https://github.com/',
  twitter:  'https://twitter.com/',
}

function normalizeUrl(value: string, platform: string): string {
  if (value.startsWith('http')) return value
  const base = PLATFORM_BASES[platform]
  return base ? base + value : value
}

interface SocialEntry { platform: string; value: string; label: string; icon: string }

function buildSocials(contact: Contact): SocialEntry[] {
  const entries: SocialEntry[] = []
  if (contact.linkedin) entries.push({ platform: 'linkedin', value: contact.linkedin, label: 'LinkedIn', icon: 'in' })
  if (contact.github)   entries.push({ platform: 'github',   value: contact.github,   label: 'GitHub',   icon: 'gh' })
  if (contact.twitter)  entries.push({ platform: 'twitter',  value: contact.twitter,  label: 'Twitter',  icon: 'tw' })
  if (contact.discord)  entries.push({ platform: 'discord',  value: contact.discord,  label: 'Discord',  icon: 'dc' })
  if (contact.email)    entries.push({ platform: 'email',    value: contact.email,    label: 'Email',    icon: '✉' })
  return entries
}

function SocialIcons({ contact }: { contact: Contact }) {
  const socials = buildSocials(contact)
  if (socials.length === 0) return <span className="text-muted font-pixel text-[9px] flex items-center justify-center w-full h-full">—</span>

  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      {socials.map(({ platform, value, label, icon }) => {
        const href = platform === 'email'
          ? `mailto:${value}`
          : platform === 'discord'
          ? '#'
          : normalizeUrl(value, platform)

        return (
          <a
            key={platform}
            href={href}
            target={platform === 'email' || platform === 'discord' ? undefined : '_blank'}
            rel="noopener noreferrer"
            title={`${label}: ${value}`}
            className="font-pixel text-[8px] px-1.5 py-1.5 border border-border text-muted hover:text-primary hover:border-primary transition-none leading-none"
          >
            {icon}
          </a>
        )
      })}
    </div>
  )
}

// ── PingButton ────────────────────────────────────────────────────────────────

function PingButton({ contactId, onPing }: { contactId: string; onPing: (id: string) => void }) {
  const [state, setState] = useState<'idle' | 'done'>('idle')

  function handleClick() {
    if (state === 'done') return
    playPingBlip()
    onPing(contactId)
    setState('done')
    setTimeout(() => setState('idle'), 1500)
  }

  return (
    <button
      onClick={handleClick}
      className={`font-pixel text-[8px] px-2 py-1 border whitespace-nowrap transition-none
        ${state === 'done'
          ? 'border-primary text-bg bg-primary'
          : 'border-secondary text-secondary hover:bg-secondary hover:text-bg'
        }`}
    >
      {state === 'done' ? '✓ PINGED!' : '✓ PING'}
    </button>
  )
}

// ── Sorting ───────────────────────────────────────────────────────────────────

function sortContacts(contacts: Contact[], sortBy: SortBy): Contact[] {
  return [...contacts].sort((a, b) => {
    if (sortBy === 'date') {
      if (!a.lastInteractionAt && !b.lastInteractionAt) return 0
      if (!a.lastInteractionAt) return 1
      if (!b.lastInteractionAt) return -1
      return new Date(b.lastInteractionAt).getTime() - new Date(a.lastInteractionAt).getTime()
    }
    if (sortBy === 'exp') {
      const pctDiff = computeExp(a.lastInteractionAt).pct - computeExp(b.lastInteractionAt).pct
      if (pctDiff !== 0) return pctDiff
    }
    if (sortBy === 'company') {
      const companyDiff = (a.company ?? '').localeCompare(b.company ?? '')
      if (companyDiff !== 0) return companyDiff
    }
    // name → company → status → date (tiebreaker chain for all modes)
    const nameDiff = a.name.localeCompare(b.name)
    if (nameDiff !== 0) return nameDiff
    const companyDiff = (a.company ?? '').localeCompare(b.company ?? '')
    if (companyDiff !== 0) return companyDiff
    const statusDiff = computeExp(a.lastInteractionAt).pct - computeExp(b.lastInteractionAt).pct
    if (statusDiff !== 0) return statusDiff
    if (!a.lastInteractionAt && !b.lastInteractionAt) return 0
    if (!a.lastInteractionAt) return 1
    if (!b.lastInteractionAt) return -1
    return new Date(b.lastInteractionAt).getTime() - new Date(a.lastInteractionAt).getTime()
  })
}

// ── AppsDropdown ──────────────────────────────────────────────────────────────

interface AppLink { id: string; title: string; company: string }

function abbrevTitle(title: string): string {
  return title
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 4)
}

function AppsDropdown({ apps, onOpenJob }: { apps?: AppLink[]; onOpenJob?: (jobId: string) => void }) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function reposition() {
      const rect = btnRef.current?.getBoundingClientRect()
      if (rect) setMenuPos({ top: rect.bottom + 2, left: rect.left })
    }
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  if (!apps || apps.length === 0) return <span className="text-muted font-pixel text-[9px] flex items-center justify-center w-full h-full">—</span>

  return (
    <div className="relative h-full">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className={`font-pixel text-xs px-2 border-0 border-l leading-none transition-none whitespace-nowrap w-full h-full
          ${open ? 'border-secondary text-secondary bg-surface' : 'border-border text-muted hover:border-secondary hover:text-secondary hover:bg-surface/50'}`}
      >
        {apps.length} app{apps.length !== 1 ? 's' : ''} {open ? '▲' : '▼'}
      </button>

      {open && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-[210]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[211] border border-border bg-bg min-w-[180px] py-0.5"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {apps.map(({ id, title, company }) => (
              <button
                key={id}
                onClick={() => { onOpenJob?.(id); setOpen(false) }}
                className="w-full text-left px-2 py-1 font-pixel text-[8px] text-muted hover:text-primary hover:bg-surface transition-none flex items-baseline gap-1 truncate"
              >
                <span className="text-secondary shrink-0">{abbrevTitle(title)}</span>
                <span className="text-muted/60 shrink-0">@</span>
                <span className="truncate">{company || title}</span>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

// ── Desktop table row ─────────────────────────────────────────────────────────

function ContactRow({ contact, apps, onPing, onOpenDetail, onOpenJob, deleteMode, checked, onToggle }: {
  contact: Contact
  apps?: AppLink[]
  onPing: (id: string) => void
  onOpenDetail: (id: string) => void
  onOpenJob?: (jobId: string) => void
  deleteMode?: boolean
  checked?: boolean
  onToggle?: (id: string) => void
}) {
  return (
    <tr className="border-b border-border hover:bg-surface/50 transition-colors">
      {/* Delete checkbox */}
      {deleteMode && (
        <td className="px-2 py-1 w-6">
          <input
            type="checkbox"
            checked={!!checked}
            onChange={() => onToggle?.(contact.id)}
            className="accent-warning cursor-pointer"
          />
        </td>
      )}
      {/* Terminal icon */}
      <td className="px-2 py-1 w-6">
        <button
          tabIndex={-1}
          onClick={() => onOpenDetail(contact.id)}
          className="flex-shrink-0 transition-colors text-muted hover:text-secondary cursor-pointer"
          title="View contact details"
          aria-label="View contact details"
        >
          <Terminal width={22} height={22} />
        </button>
      </td>

      {/* Name */}
      <td className="px-2 py-1 min-w-[140px] max-w-[200px]">
        <span className="font-pixel text-xs text-primary truncate block">{contact.name}</span>
      </td>

      {/* Status bar */}
      <td className="px-2 py-1 w-[130px]">
        <ExpBar lastInteractionAt={contact.lastInteractionAt} />
      </td>

      {/* Apps */}
      <td className="p-0 max-w-[200px]">
        <AppsDropdown apps={apps} onOpenJob={onOpenJob} />
      </td>

      {/* Socials */}
      <td className="p-0">
        <SocialIcons contact={contact} />
      </td>

      {/* Ping */}
      <td className="px-2 py-1 w-[100px] text-right">
        <PingButton contactId={contact.id} onPing={onPing} />
      </td>
    </tr>
  )
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function ContactCard({ contact, apps, onPing, onOpenDetail, onOpenJob }: {
  contact: Contact
  apps?: AppLink[]
  onPing: (id: string) => void
  onOpenDetail: (id: string) => void
  onOpenJob?: (jobId: string) => void
}) {
  return (
    <div className="border-b border-border px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            tabIndex={-1}
            onClick={() => onOpenDetail(contact.id)}
            className="text-muted hover:text-secondary transition-none shrink-0"
            title="View contact details"
          >
            <Terminal width={14} height={14} />
          </button>
          <span className="font-pixel text-xs text-primary truncate">{contact.name}</span>
        </div>
        <SocialIcons contact={contact} />
      </div>
      {apps && apps.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <AppsDropdown apps={apps} onOpenJob={onOpenJob} />
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <ExpBar lastInteractionAt={contact.lastInteractionAt} />
        </div>
        <PingButton contactId={contact.id} onPing={onPing} />
      </div>
    </div>
  )
}

// ── ContactList (exported) ────────────────────────────────────────────────────

interface ContactListProps {
  contacts: Contact[]
  sortBy: SortBy
  search?: string
  onPing: (id: string) => void
  onOpenDetail: (id: string) => void
  jobsByContact?: Record<string, AppLink[]>
  onOpenJob?: (jobId: string) => void
  mobile?: boolean
  deleteMode?: boolean
  selected?: Set<string>
  onToggle?: (id: string) => void
}

export default function ContactList({ contacts, sortBy, search = '', onPing, onOpenDetail, jobsByContact = {}, onOpenJob, mobile = false, deleteMode, selected, onToggle }: ContactListProps) {
  const q = search.trim().toLowerCase()
  const filtered = q
    ? contacts.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      )
    : contacts
  const sorted = sortContacts(filtered, sortBy)

  if (mobile) {
    return (
      <div>
        {sorted.map((c) => (
          <ContactCard key={c.id} contact={c} apps={jobsByContact[c.id]} onPing={onPing} onOpenDetail={onOpenDetail} onOpenJob={onOpenJob} />
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border text-primary text-left select-none">
            {deleteMode && <th className="w-6 px-2 py-2" scope="col"><span className="sr-only">Delete</span></th>}
            <th className="w-6 px-2 py-2" scope="col"><span className="sr-only">Details</span></th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted" scope="col">NAME</th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted w-[130px]" scope="col">EXP</th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted" scope="col">APPS</th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted" scope="col">SOCIALS</th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted w-[100px]" scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <ContactRow key={c.id} contact={c} apps={jobsByContact[c.id]} onPing={onPing} onOpenDetail={onOpenDetail} onOpenJob={onOpenJob} deleteMode={deleteMode} checked={selected?.has(c.id)} onToggle={onToggle} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
