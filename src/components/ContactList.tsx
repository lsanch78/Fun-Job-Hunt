import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Terminal } from 'pixelarticons/react'
import { playPingBlip } from '@/lib/sfx'
import type { Contact } from '@/types'

export type { Contact }
export type SortBy = 'status' | 'name' | 'date'

// ── Status helpers ────────────────────────────────────────────────────────────

type StatusTier = 'excellent' | 'good' | 'fair' | 'low' | 'dead'

interface StatusInfo {
  pct: number
  tier: StatusTier
  daysAgo: number | null
  barColor: string
}

function computeStatus(lastInteractionAt: string | null): StatusInfo {
  if (!lastInteractionAt) return { pct: 0,   tier: 'dead',      daysAgo: null, barColor: '#555555' }
  const days = Math.floor((Date.now() - new Date(lastInteractionAt).getTime()) / 86_400_000)
  if (days === 0)  return { pct: 100, tier: 'excellent', daysAgo: 0,    barColor: '#22c55e' }
  if (days <= 7)   return { pct: 100, tier: 'excellent', daysAgo: days, barColor: '#22c55e' }
  if (days <= 14)  return { pct: 75,  tier: 'good',      daysAgo: days, barColor: '#84cc16' }
  if (days <= 30)  return { pct: 50,  tier: 'fair',      daysAgo: days, barColor: '#eab308' }
  if (days <= 60)  return { pct: 25,  tier: 'low',       daysAgo: days, barColor: '#f97316' }
  return             { pct: 5,   tier: 'dead',      daysAgo: days, barColor: '#ef4444' }
}

function daysAgoLabel(daysAgo: number | null): string {
  if (daysAgo === null) return 'never'
  if (daysAgo === 0)    return 'today'
  if (daysAgo === 1)    return '1d ago'
  return `${daysAgo}d ago`
}

// ── StatusBar ─────────────────────────────────────────────────────────────────

function StatusBar({ lastInteractionAt }: { lastInteractionAt: string | null }) {
  const { pct, barColor, daysAgo } = computeStatus(lastInteractionAt)
  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="h-1.5 w-full bg-border overflow-hidden">
        <div
          className="h-full transition-none"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="font-pixel text-[9px] text-muted leading-none">
        {daysAgoLabel(daysAgo)}
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
  if (socials.length === 0) return <span className="text-muted font-pixel text-[9px]">—</span>

  return (
    <div className="flex items-center gap-1.5">
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
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'date') {
      if (!a.lastInteractionAt && !b.lastInteractionAt) return 0
      if (!a.lastInteractionAt) return 1
      if (!b.lastInteractionAt) return -1
      return new Date(b.lastInteractionAt).getTime() - new Date(a.lastInteractionAt).getTime()
    }
    return computeStatus(a.lastInteractionAt).pct - computeStatus(b.lastInteractionAt).pct
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

  if (!apps || apps.length === 0) return <span className="text-muted font-pixel text-[9px]">—</span>

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className={`font-pixel text-[8px] px-1.5 py-0.5 border leading-none transition-none whitespace-nowrap
          ${open ? 'border-secondary text-secondary' : 'border-border text-muted hover:border-secondary hover:text-secondary'}`}
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

function ContactRow({ contact, apps, onPing, onOpenDetail, onOpenJob }: {
  contact: Contact
  apps?: AppLink[]
  onPing: (id: string) => void
  onOpenDetail: (id: string) => void
  onOpenJob?: (jobId: string) => void
}) {
  return (
    <tr className="border-b border-border hover:bg-surface/50 transition-colors">
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
        <StatusBar lastInteractionAt={contact.lastInteractionAt} />
      </td>

      {/* Apps */}
      <td className="px-2 py-1 max-w-[200px]">
        <AppsDropdown apps={apps} onOpenJob={onOpenJob} />
      </td>

      {/* Socials */}
      <td className="px-2 py-1">
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
          <StatusBar lastInteractionAt={contact.lastInteractionAt} />
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
}

export default function ContactList({ contacts, sortBy, search = '', onPing, onOpenDetail, jobsByContact = {}, onOpenJob, mobile = false }: ContactListProps) {
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
            <th className="w-6 px-2 py-2" scope="col"><span className="sr-only">Details</span></th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted" scope="col">NAME</th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted w-[130px]" scope="col">STATUS</th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted" scope="col">APPS</th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted" scope="col">SOCIALS</th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted w-[100px]" scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <ContactRow key={c.id} contact={c} apps={jobsByContact[c.id]} onPing={onPing} onOpenDetail={onOpenDetail} onOpenJob={onOpenJob} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
