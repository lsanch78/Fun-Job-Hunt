import { useState, useRef, useEffect } from 'react'
import { PRO_UPGRADE_CTA_SHORT } from '@/config/pricing'
import { createPortal } from 'react-dom'
import { Terminal } from 'pixelarticons/react'
import { playPingBlip, playAiDing } from '@/lib/sfx'
import { lsGet, lsSet, lsRemove } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import { commCooldownRemaining, formatCooldown } from '@/lib/commSettings'
import type { Contact, ExpInfo, ContactJobLink } from '@/types'
import { useAI } from '@/hooks/useAI'
import type { AiPhase } from '@/types'
import AiButton from '@/components/ai/AiButton'
import { PROMPT_OUTREACH } from '@/config/aiPrompts'

export type { Contact }
export type SortBy = 'exp' | 'name' | 'company' | 'date' | 'recent'

// ── Exp helpers ───────────────────────────────────────────────────────────────

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

function getExpRank(exp: number): { level: number; title: string; barColor: string } {
  if (exp >= 80) return { level: 5, title: 'Champion',  barColor: '#22c55e' }
  if (exp >= 60) return { level: 4, title: 'Ally',      barColor: '#84cc16' }
  if (exp >= 40) return { level: 3, title: 'Contact',   barColor: '#eab308' }
  if (exp >= 20) return { level: 2, title: 'Prospect',  barColor: '#f97316' }
  if (exp > 0)   return { level: 1, title: 'Stranger',  barColor: '#ef4444' }
  return               { level: 0, title: 'Unknown',   barColor: '#555555' }
}

function ExpBar({ commBonus = 0 }: { lastInteractionAt?: string | null; commBonus?: number }) {
  const { level, title, barColor } = getExpRank(commBonus)
  const displayPct = commBonus
  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="h-1.5 w-full bg-border overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${displayPct}%`, backgroundColor: barColor, transition: 'width 400ms ease' }}
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

const PLATFORM_BG: Record<string, string> = {
  linkedin: '#0e2a45',
  github:   '#1e1e1e',
  twitter:  '#111827',
  discord:  '#1e1f3b',
  email:    '#1a2a1a',
}

interface SocialEntry { platform: string; value: string; label: string; icon: string }

function buildSocials(contact: Contact): SocialEntry[] {
  const entries: SocialEntry[] = []
  if (contact.linkedin) entries.push({ platform: 'linkedin', value: contact.linkedin, label: 'LinkedIn', icon: 'in' })
  if (contact.github)   entries.push({ platform: 'github',   value: contact.github,   label: 'GitHub',   icon: 'gh' })
  if (contact.twitter)  entries.push({ platform: 'twitter',  value: contact.twitter,  label: 'Twitter',  icon: 'tw' })
  if (contact.discord)  entries.push({ platform: 'discord',  value: contact.discord,  label: 'Discord',  icon: 'dc' })
  if (contact.email)    entries.push({ platform: 'email',    value: contact.email,    label: 'Email',    icon: '@' })
  return entries
}

function SocialIcons({ contact }: { contact: Contact }) {
  const socials = buildSocials(contact)
  const [menu, setMenu] = useState<{ x: number; y: number; value: string; label: string } | null>(null)
  const [copied, setCopied] = useState(false)

  if (socials.length === 0) return <span className="text-muted font-pixel text-[9px] flex items-center justify-center w-full h-full">—</span>

  function handleContextMenu(e: React.MouseEvent, value: string, label: string) {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, value, label })
    setCopied(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(menu!.value).catch(() => {})
    setCopied(true)
    setTimeout(() => setMenu(null), 600)
  }

  return (
    <>
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
              onContextMenu={(e) => handleContextMenu(e, value, label)}
              className="font-pixel text-[8px] w-[34px] h-[34px] flex items-center justify-center border border-border text-muted hover:text-primary hover:border-primary transition-none leading-none"
              style={{ backgroundColor: PLATFORM_BG[platform] ?? '#1a1a1a' }}
            >
              {icon}
            </a>
          )
        })}
      </div>
      {menu && createPortal(
        <>
          <div className="fixed inset-0 z-[210]" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null) }} />
          <div
            className="fixed z-[211] border border-border bg-bg py-0.5 min-w-[160px]"
            style={{ top: menu.y, left: menu.x }}
          >
            <div className="px-2 py-1 font-pixel text-[8px] text-muted border-b border-border mb-0.5 truncate">{menu.label}: {menu.value}</div>
            <button
              onClick={handleCopy}
              className="w-full text-left px-2 py-1 font-pixel text-[9px] text-muted hover:text-primary hover:bg-surface transition-none"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// ── Comm XP popup keyframes (injected once) ───────────────────────────────────

const CONTACT_XP_STYLE = `
@keyframes contact-xp-pop {
  0%   { opacity: 0; transform: translateX(-50%) translateY(0px)   scale(0.7); }
  15%  { opacity: 1; transform: translateX(-50%) translateY(-12px) scale(1.2); }
  70%  { opacity: 1; transform: translateX(-50%) translateY(-36px) scale(1.05); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-58px) scale(0.95); }
}
@keyframes contact-xp-max {
  0%   { opacity: 0; transform: translateX(-50%) translateY(0px)  scale(0.5); }
  20%  { opacity: 1; transform: translateX(-50%) translateY(-18px) scale(1.4); }
  60%  { opacity: 1; transform: translateX(-50%) translateY(-44px) scale(1.1); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-72px) scale(1.0); }
}
`
if (typeof document !== 'undefined' && !document.getElementById('contact-xp-pop-keyframes')) {
  const el = document.createElement('style')
  el.id = 'contact-xp-pop-keyframes'
  el.textContent = CONTACT_XP_STYLE
  document.head.appendChild(el)
}

// ── CommButton ────────────────────────────────────────────────────────────────

const CONTACT_XP_PER_COMM = 5

function PingButton({ contactId, lastCommAt, cooldownHours, onPing, onComm }: {
  contactId: string
  lastCommAt: string | null
  cooldownHours: number
  onPing: (id: string) => void
  onComm: (x: number, y: number) => void
}) {
  const [state, setState] = useState<'idle' | 'done'>('idle')
  const [remaining, setRemaining] = useState(() => commCooldownRemaining(lastCommAt, cooldownHours))
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setRemaining(commCooldownRemaining(lastCommAt, cooldownHours))
    if (!lastCommAt) return
    const interval = setInterval(() => {
      const r = commCooldownRemaining(lastCommAt, cooldownHours)
      setRemaining(r)
      if (r <= 0) clearInterval(interval)
    }, 60_000)
    return () => clearInterval(interval)
  }, [lastCommAt, cooldownHours])

  const locked = remaining > 0

  function handleClick() {
    if (state === 'done' || locked) return
    onPing(contactId)
    const rect = btnRef.current?.getBoundingClientRect()
    onComm(rect ? rect.left + rect.width / 2 : window.innerWidth / 2, rect ? rect.top : window.innerHeight / 2)
    setState('done')
    setRemaining(cooldownHours)
    setTimeout(() => setState('idle'), 1500)
  }

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      disabled={locked}
      title={locked ? `Available in ${formatCooldown(remaining)}` : undefined}
      className={`font-pixel text-[8px] px-3 py-3 border whitespace-nowrap transition-none w-[80px]
        ${locked
          ? 'border-border text-muted cursor-not-allowed'
          : state === 'done'
            ? 'border-primary text-bg bg-primary'
            : 'border-secondary text-secondary hover:border-primary hover:text-primary'
        }`}
    >
      {locked ? formatCooldown(remaining) : 'COMM'}
    </button>
  )
}

// ── Sorting ───────────────────────────────────────────────────────────────────

function sortContacts(contacts: Contact[], sortBy: SortBy): Contact[] {
  return [...contacts].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
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

function abbrevTitle(title: string): string {
  return title
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 4)
}

function AppsDropdown({ apps, onOpenJob }: { apps?: ContactJobLink[]; onOpenJob?: (jobId: string) => void }) {
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
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className={`font-pixel text-xs px-2 py-3 border leading-none transition-none whitespace-nowrap w-full
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

// ── AI Outreach ───────────────────────────────────────────────────────────────

function loadOutreachPrompt(): string {
  return lsGet<string>(SK.outreachPrompt, '') || PROMPT_OUTREACH
}

function saveOutreachPrompt(prompt: string): void {
  if (prompt.trim() && prompt.trim() !== PROMPT_OUTREACH) lsSet(SK.outreachPrompt, prompt.trim())
  else lsRemove(SK.outreachPrompt)
}

// TODO: wire up CV / curated resume as resume context for outreach drafts.
async function loadSenderResume(_userId: string | null): Promise<string> {
  return 'Let the user know that their resume did not load and it is being worked on by the developer'
}

function buildOutreachPrompt(contact: Contact, apps: ContactJobLink[], senderResume: string): string {
  const lines: string[] = []

  lines.push('--- RECIPIENT (the contact you are writing TO) ---')
  lines.push(`Name: ${contact.name}`)
  if (contact.company) lines.push(`Company: ${contact.company}`)
  if (apps.length > 0) lines.push(`Linked job(s): ${apps.map((a) => a.title).join(', ')}`)
  if (contact.notes) lines.push(`Notes: ${contact.notes}`)

  if (senderResume.trim()) {
    lines.push('')
    lines.push('--- SENDER (the job seeker writing the message — extract their name from this resume) ---')
    lines.push(senderResume.trim().slice(0, 3000))
  }

  return lines.join('\n')
}

function ContactAiDrawer({ phase, dots, draft, limitHit, isEditing, onClose, onStopEditing, onUpgrade }: {
  phase: AiPhase
  dots: number
  draft: string
  limitHit: boolean
  isEditing: boolean
  onClose: () => void
  onStopEditing: () => void
  onUpgrade?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [promptInput, setPromptInput] = useState(() => loadOutreachPrompt())

  function handleCopy() {
    navigator.clipboard.writeText(draft).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 800)
  }

  function handleSavePrompt() {
    saveOutreachPrompt(promptInput)
    onStopEditing()
  }

  function handleResetPrompt() {
    setPromptInput(PROMPT_OUTREACH)
    saveOutreachPrompt(PROMPT_OUTREACH)
  }

  if (isEditing) {
    return (
      <div className="border border-border bg-bg mt-1 p-3 font-pixel text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted text-[10px] tracking-widest">// EDIT DRAFT PROMPT</span>
          <button onClick={onStopEditing} className="text-muted hover:text-primary text-[10px] transition-none">✕ CLOSE</button>
        </div>
        <textarea
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          rows={6}
          className="w-full bg-surface border border-border text-primary font-pixel text-[10px] p-2 resize-y leading-relaxed focus:outline-none focus:border-secondary"
          spellCheck={false}
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleSavePrompt}
            className="text-[10px] px-2 py-0.5 border border-secondary text-secondary hover:opacity-80 transition-none"
          >
            SAVE
          </button>
          <button
            onClick={handleResetPrompt}
            className="text-[10px] px-2 py-0.5 border border-border text-muted hover:border-primary hover:text-primary transition-none"
          >
            RESET DEFAULT
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-border bg-bg mt-1 p-3 font-pixel text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-muted text-[10px] tracking-widest">// AI OUTREACH DRAFT</span>
        <button onClick={onClose} className="text-muted hover:text-primary text-[10px] transition-none">✕ CLOSE</button>
      </div>

      {phase === 'generating' && (
        <div className="text-secondary text-[10px] animate-pulse">GEN{'.'.repeat(dots + 1)}</div>
      )}

      {limitHit && phase === 'idle' && (
        <div className="flex items-center gap-3">
          <span className="text-warning text-[10px]">// MONTHLY LIMIT REACHED</span>
          <button
            onClick={() => onUpgrade?.()}
            className="text-[10px] px-2 py-0.5 border border-warning text-warning hover:opacity-80 transition-none"
          >
            {PRO_UPGRADE_CTA_SHORT}
          </button>
        </div>
      )}

      {!limitHit && draft && phase !== 'generating' && (
        <>
          <pre className="text-primary text-[11px] whitespace-pre-wrap leading-relaxed mb-2 font-pixel">{draft}</pre>
          <button
            onClick={handleCopy}
            className="text-[10px] px-2 py-0.5 border border-border text-muted hover:border-primary hover:text-primary transition-none"
          >
            {copied ? '✓ COPIED' : 'COPY'}
          </button>
        </>
      )}
    </div>
  )
}

// ── Desktop table row ─────────────────────────────────────────────────────────

interface ContactXpPopup { id: number; x: number; y: number }

function ContactRow({ contact, apps, onPing, onOpenDetail, onOpenJob, deleteMode, checked, onToggle, onExpChange, cooldownHours, aiPhase, aiDots, isAiActive, isAiEditing, aiDraft, aiLimitHit, onAiClick, onAiRightClick, onStopEditing, onUpgrade }: {
  contact: Contact
  apps?: ContactJobLink[]
  onPing: (id: string) => void
  onOpenDetail: (id: string) => void
  onOpenJob?: (jobId: string) => void
  deleteMode?: boolean
  checked?: boolean
  onToggle?: (id: string) => void
  onExpChange?: (id: string, exp: number) => void
  cooldownHours: number
  aiPhase: AiPhase
  aiDots: number
  isAiActive: boolean
  isAiEditing: boolean
  aiDraft: string
  aiLimitHit: boolean
  onAiClick: () => void
  onAiRightClick: (e: React.MouseEvent) => void
  onStopEditing: () => void
  onUpgrade?: () => void
}) {
  const [commBonus, setCommBonus] = useState(contact.commExp ?? 0)
  const [popups, setPopups] = useState<ContactXpPopup[]>([])
  const [maxPopup, setMaxPopup] = useState<{ x: number; y: number } | null>(null)
  const popupCounter = useRef(0)
  const expBarRef = useRef<HTMLTableCellElement>(null)

  function getExpBarPos(): { x: number; y: number } {
    const rect = expBarRef.current?.getBoundingClientRect()
    return rect
      ? { x: rect.left + rect.width / 2, y: rect.top }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }

  function handleComm(_x: number, _y: number) {
    const next = Math.min(100, commBonus + CONTACT_XP_PER_COMM)
    setCommBonus(next)
    onExpChange?.(contact.id, next)
    playPingBlip(next)
    const { x, y } = getExpBarPos()
    if (next >= 100 && commBonus < 100) {
      setMaxPopup({ x, y })
      setTimeout(() => setMaxPopup(null), 1400)
    }
    const id = ++popupCounter.current
    setPopups((prev) => [...prev, { id, x, y }])
    setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== id)), 1100)
  }

  return (
    <>
    {popups.map((p) => (
      <div
        key={p.id}
        className="pointer-events-none fixed z-[9998] select-none font-pixel text-primary"
        style={{
          left: p.x,
          top: p.y,
          fontSize: '0.7rem',
          animation: 'contact-xp-pop 1.0s ease-out forwards',
        }}
      >
        +{CONTACT_XP_PER_COMM} EXP
      </div>
    ))}
    {maxPopup && (
      <div
        className="pointer-events-none fixed z-[9999] select-none font-pixel text-yellow-400"
        style={{
          left: maxPopup.x,
          top: maxPopup.y,
          fontSize: '0.85rem',
          animation: 'contact-xp-max 1.4s ease-out forwards',
        }}
      >
        ★ MAX
      </div>
    )}
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

      {/* Company */}
      <td className="px-2 py-1 min-w-[120px] max-w-[180px]">
        <span className="font-pixel text-xs text-muted truncate block">{contact.company ?? '—'}</span>
      </td>

      {/* Apps */}
      <td className="p-0 max-w-[200px]">
        <AppsDropdown apps={apps} onOpenJob={onOpenJob} />
      </td>

      {/* Socials */}
      <td className="p-0 w-px whitespace-nowrap">
        <SocialIcons contact={contact} />
      </td>

      {/* EXP bar */}
      <td ref={expBarRef} className="px-2 py-1 w-[130px]">
        <ExpBar lastInteractionAt={contact.lastInteractionAt} commBonus={commBonus} />
      </td>

      {/* Comm */}
      <td data-tutorial="network-comm" className="p-0 w-[100px] text-center">
        <PingButton contactId={contact.id} lastCommAt={contact.lastCommAt} cooldownHours={cooldownHours} onPing={onPing} onComm={handleComm} />
      </td>

      {/* AI Outreach */}
      <td data-tutorial="network-draft" className="px-2 py-1 w-[80px] text-right">
        <AiButton
          label="DRAFT"
          phase={isAiActive ? aiPhase : 'idle'}
          dots={aiDots}
          onClick={onAiClick}
          onContextMenu={onAiRightClick}
          title="Left-click: generate · Right-click: edit prompt"
        />
      </td>
    </tr>
    {(isAiActive || isAiEditing) && (
      <tr>
        <td colSpan={deleteMode ? 10 : 9} className="px-3 pb-3 pt-0 bg-surface/30 border-b border-border">
          <ContactAiDrawer
            phase={aiPhase}
            dots={aiDots}
            draft={aiDraft}
            limitHit={aiLimitHit}
            isEditing={isAiEditing}
            onClose={onAiClick}
            onStopEditing={onStopEditing}
            onUpgrade={onUpgrade}
          />
        </td>
      </tr>
    )}
    </>
  )
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function ContactCard({ contact, apps, onPing, onOpenDetail, onOpenJob }: {
  contact: Contact
  apps?: ContactJobLink[]
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
        <PingButton contactId={contact.id} lastCommAt={contact.lastCommAt} cooldownHours={168} onPing={onPing} onComm={() => {}} />
      </div>
    </div>
  )
}

// ── ContactList (exported) ────────────────────────────────────────────────────

interface ContactListProps {
  contacts: Contact[]
  sortBy: SortBy
  sortDir?: 'asc' | 'desc'
  search?: string
  onPing: (id: string) => void
  onOpenDetail: (id: string) => void
  jobsByContact?: Record<string, ContactJobLink[]>
  onOpenJob?: (jobId: string) => void
  mobile?: boolean
  deleteMode?: boolean
  selected?: Set<string>
  onToggle?: (id: string) => void
  page?: number
  pageSize?: number
  onTotalFiltered?: (n: number) => void
  onExpChange?: (id: string, exp: number) => void
  cooldownHours?: number
  userId?: string | null
  onUpgrade?: () => void
}

export default function ContactList({ contacts, sortBy, sortDir = 'asc', search = '', onPing, onOpenDetail, jobsByContact = {}, onOpenJob, mobile = false, deleteMode, selected, onToggle, page = 1, pageSize, onTotalFiltered, onExpChange, cooldownHours = 168, userId = null, onUpgrade }: ContactListProps) {
  const q = search.trim().toLowerCase()
  const filtered = q
    ? contacts.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      )
    : contacts
  const sorted = sortDir === 'desc' ? [...sortContacts(filtered, sortBy)].reverse() : sortContacts(filtered, sortBy)

  useEffect(() => {
    onTotalFiltered?.(sorted.length)
  }, [sorted.length, onTotalFiltered])

  const paged = pageSize ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted

  const ai = useAI()
  const [activeAiContactId, setActiveAiContactId] = useState<string | null>(null)
  const [editingAiContactId, setEditingAiContactId] = useState<string | null>(null)
  const [aiDraft, setAiDraft] = useState('')
  const [aiLimitHit, setAiLimitHit] = useState(false)
  const senderResumeRef = useRef<string>('')

  useEffect(() => {
    loadSenderResume(userId).then((text) => { senderResumeRef.current = text })
  }, [userId])

  function handleAiClick(contact: Contact, apps: ContactJobLink[]) {
    if (activeAiContactId === contact.id) {
      setActiveAiContactId(null)
      setEditingAiContactId(null)
      setAiDraft('')
      setAiLimitHit(false)
      ai.cancel()
      return
    }
    ai.cancel()
    setAiDraft('')
    setAiLimitHit(false)
    setEditingAiContactId(null)
    setActiveAiContactId(contact.id)
    ai.run({
      system: loadOutreachPrompt(),
      prompt: buildOutreachPrompt(contact, apps ?? [], senderResumeRef.current),
      onComplete: (result) => { setAiDraft(result); requestAnimationFrame(playAiDing) },
      onError: (msg) => {
        const isLimit = msg.includes('Monthly limit') || msg.includes('limit reached')
        setAiLimitHit(isLimit)
        if (!isLimit) setAiDraft(`> ERROR: ${msg}`)
      },
    })
  }

  function handleAiRightClick(e: React.MouseEvent, contactId: string) {
    e.preventDefault()
    setActiveAiContactId(null)
    setAiDraft('')
    setAiLimitHit(false)
    ai.cancel()
    setEditingAiContactId(contactId)
  }

  if (mobile) {
    return (
      <div>
        {paged.map((c) => (
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
            <th className="px-2 py-2 font-normal text-[10px] text-muted" scope="col">COMPANY</th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted text-center" scope="col">APPS</th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted text-center" scope="col">SOCIALS</th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted w-[130px]" scope="col">EXP</th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted w-[100px] text-center" scope="col">ACTION</th>
            <th className="px-2 py-2 font-normal text-[10px] text-muted w-[80px] text-center" scope="col">DRAFT</th>
          </tr>
        </thead>
        <tbody>
          {paged.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              apps={jobsByContact[c.id]}
              onPing={onPing}
              onOpenDetail={onOpenDetail}
              onOpenJob={onOpenJob}
              deleteMode={deleteMode}
              checked={selected?.has(c.id)}
              onToggle={onToggle}
              onExpChange={onExpChange}
              cooldownHours={cooldownHours}
              aiPhase={ai.phase}
              aiDots={ai.dots}
              isAiActive={activeAiContactId === c.id}
              isAiEditing={editingAiContactId === c.id}
              aiDraft={aiDraft}
              aiLimitHit={aiLimitHit}
              onAiClick={() => handleAiClick(c, jobsByContact[c.id] ?? [])}
              onAiRightClick={(e) => handleAiRightClick(e, c.id)}
              onStopEditing={() => setEditingAiContactId(null)}
              onUpgrade={onUpgrade}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
