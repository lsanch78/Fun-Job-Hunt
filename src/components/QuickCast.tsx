import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { playPageFlip, playSpellCast, playAiConsume, playAiDing } from '@/lib/sfx'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import type { ComponentType, SVGProps } from 'react'
import { Globe } from 'pixelarticons/react'
import { ExternalLink } from 'pixelarticons/react'
import { Mail } from 'pixelarticons/react'
import { Briefcase } from 'pixelarticons/react'
import { FileText } from 'pixelarticons/react'
import { Bookmark } from 'pixelarticons/react'
import { Link } from 'pixelarticons/react'
import { Star } from 'pixelarticons/react'
import { User } from 'pixelarticons/react'
import { Terminal } from 'pixelarticons/react'
import { Hash } from 'pixelarticons/react'
import { Zap } from 'pixelarticons/react'
import { Share } from 'pixelarticons/react'
import { AtSign } from 'pixelarticons/react'
import { Heart } from 'pixelarticons/react'
import { Send } from 'pixelarticons/react'
import { Clipboard } from 'pixelarticons/react'
import { supabase } from '@/lib/supabase'
import { useSubscription } from '@/lib/SubscriptionContext'
import ResumeModal from '@/components/modals/ResumeModal'
import AiModal from '@/components/AiModal'
import { invalidateSlot, getResumeText } from '@/services/resumeTextService'
import { fetchModels, streamCompletion } from '@/services/aiService'
import { fetchAiSettings, DEFAULT_PROMPTS, type AiSettings } from '@/services/aiSettingsService'
import {
  fetchLinks as dbFetchLinks,
  createLink as dbCreateLink,
  updateLink as dbUpdateLink,
  deleteLink as dbDeleteLink,
} from '@/services/quickCastService'
import {
  fetchResumeSlots,
  upsertResumeSlot,
  deleteResumeSlot,
  getResumeSignedUrl,
  uploadResumePdf,
  deleteResumePdf,
  type ResumeSlot,
  type ResumeSlotRecord,
} from '@/services/resumeService'

// ── AI ready animation — injected once ────────────────────────────────────────

if (typeof document !== 'undefined' && !document.getElementById('qc-ai-ready-style')) {
  const el = document.createElement('style')
  el.id = 'qc-ai-ready-style'
  el.textContent = `
@keyframes qc-ai-ready-shine {
  0%   { box-shadow: none; border-color: rgba(88,28,135,0.4); }
  50%  { box-shadow: 0 0 6px 1px rgba(107,33,168,0.22),
                     inset 0 0 8px 1px rgba(88,28,135,0.06);
          border-color: rgba(126,34,206,0.65); }
  100% { box-shadow: none; border-color: rgba(88,28,135,0.4); }
}
.qc-ai-ready {
  animation: qc-ai-ready-shine 2.5s ease-in-out infinite;
}
`
  document.head.appendChild(el)
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SLOTS  = 8

// Resume slot color palette — works across all themes
// slot a = theme secondary (primary accent)
// slot b = success green
// slot c = caution amber
const SLOT_COLORS: Record<ResumeSlot, { border: string; text: string; label: string }> = {
  a: { border: 'var(--color-secondary)', text: 'var(--color-secondary)', label: 'A' },
  b: { border: '#22c55e',               text: '#22c55e',               label: 'B' },
  c: { border: '#f59e0b',               text: '#f59e0b',               label: 'C' },
}

const RESUME_SLOTS: ResumeSlot[] = ['a', 'b', 'c']

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuickCastSlot {
  id: string
  label: string
  url: string
  icon: string
}

type SvgIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

interface IconOption {
  key: string
  label: string
  Svg?: SvgIcon
  text?: string
}

// ── Icon registry ─────────────────────────────────────────────────────────────

const ICON_OPTIONS: IconOption[] = [
  { key: 'linkedin',  label: 'LinkedIn',    text: 'in'  },
  { key: 'github',    label: 'GitHub',      text: 'gh'  },
  { key: 'twitter',   label: 'Twitter / X', text: 'x'   },
  { key: 'globe',     label: 'Website',     Svg: Globe        },
  { key: 'mail',      label: 'Email',       Svg: Mail         },
  { key: 'link',      label: 'Link',        Svg: Link         },
  { key: 'external',  label: 'External',    Svg: ExternalLink },
  { key: 'briefcase', label: 'Job Board',   Svg: Briefcase    },
  { key: 'filetext',  label: 'Resume/Doc',  Svg: FileText     },
  { key: 'bookmark',  label: 'Bookmark',    Svg: Bookmark     },
  { key: 'star',      label: 'Portfolio',   Svg: Star         },
  { key: 'user',      label: 'Profile',     Svg: User         },
  { key: 'terminal',  label: 'Terminal',    Svg: Terminal     },
  { key: 'hash',      label: 'Channel',     Svg: Hash         },
  { key: 'zap',       label: 'Quick',       Svg: Zap          },
  { key: 'share',     label: 'Share',       Svg: Share        },
  { key: 'atsign',    label: 'At / Email',  Svg: AtSign       },
  { key: 'heart',     label: 'Favorite',    Svg: Heart        },
  { key: 'send',      label: 'Send',        Svg: Send         },
]

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map((o) => [o.key, o]))

function renderIcon(key: string, size: number) {
  const opt = ICON_MAP[key]
  if (!opt) return <span className="font-pixel leading-none" style={{ fontSize: size * 0.4 }}>{key}</span>
  if (opt.Svg) return <opt.Svg width={size} height={size} />
  return (
    <span
      className="font-pixel leading-none font-bold tracking-tight"
      style={{ fontSize: Math.max(8, size * 0.38) }}
    >
      {opt.text}
    </span>
  )
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadLinks(userId: string): QuickCastSlot[] {
  const parsed = lsGet<QuickCastSlot[]>(SK.quickcastLinks(userId), [])
  return Array.isArray(parsed) ? parsed.slice(0, MAX_SLOTS) : []
}

function saveLinks(userId: string, links: QuickCastSlot[]): void {
  lsSet(SK.quickcastLinks(userId), links)
}

// ── Icon picker sub-component ─────────────────────────────────────────────────

function IconPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted text-[9px] tracking-widest">ICON</p>
      <div className="grid grid-cols-8 gap-0.5">
        {ICON_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            title={label}
            className={[
              'w-7 h-7 flex items-center justify-center leading-none',
              'border transition-none cursor-pointer',
              value === key
                ? 'border-primary text-primary'
                : 'border-border text-muted hover:border-secondary hover:text-secondary',
            ].join(' ')}
          >
            {renderIcon(key, 14)}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Resume name edit popover ──────────────────────────────────────────────────

interface ResumeNamePopoverProps {
  slot: ResumeSlot
  currentName: string
  onSave: (name: string) => void
  onDelete: () => void
  onClose: () => void
}

function ResumeNamePopover({ slot, currentName, onSave, onDelete, onClose }: ResumeNamePopoverProps) {
  const [draft, setDraft] = useState(currentName)
  const colors = SLOT_COLORS[slot]
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  return (
    <div
      className="absolute bottom-full mb-2 right-0 z-50 bg-surface border border-border font-pixel text-xs flex flex-col w-56"
      style={{ borderColor: colors.border }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border"
        style={{ borderColor: colors.border }}
      >
        <span className="text-[9px] tracking-widest" style={{ color: colors.text }}>
          RESUME {slot.toUpperCase()}
        </span>
        <button
          onClick={onClose}
          className="text-muted hover:text-primary text-[9px] transition-none"
        >
          ✕
        </button>
      </div>
      <div className="px-3 py-2 flex flex-col gap-2">
        <input
          ref={inputRef}
          className="bg-bg border border-border text-primary text-[9px] px-2 py-1 outline-none focus:border-primary font-pixel placeholder-muted w-full"
          style={{ '--tw-ring-color': colors.border } as React.CSSProperties}
          placeholder="Resume name…"
          value={draft}
          maxLength={10}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave(draft.trim() || 'Resume')
            if (e.key === 'Escape') onClose()
          }}
        />
        <div className="flex gap-1">
          <button
            onClick={() => onSave(draft.trim() || 'Resume')}
            className="text-bg text-[9px] px-3 py-1 font-pixel hover:opacity-80 transition-none"
            style={{ background: colors.border }}
          >
            SAVE
          </button>
          <button
            onClick={onClose}
            className="text-muted border border-border text-[9px] px-2 py-1 font-pixel hover:border-secondary hover:text-secondary transition-none"
          >
            CANCEL
          </button>
          <button
            onClick={onDelete}
            className="text-muted border border-border text-[9px] px-2 py-1 font-pixel hover:border-warning hover:text-warning transition-none ml-auto"
            title="Delete this resume"
          >
            DEL
          </button>
        </div>
      </div>
    </div>
  )
}

// ── QuickCast ─────────────────────────────────────────────────────────────────

const PREMIUM_SLOTS: ResumeSlot[] = ['b', 'c']

export default function QuickCast() {
  const { isSubscribed } = useSubscription()

  // Link slots
  const [links,        setLinks]        = useState<QuickCastSlot[]>([])
  const [userId,       setUserId]       = useState<string | null>(null)
  const [addFormOpen,  setAddFormOpen]  = useState(false)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [draftLabel,   setDraftLabel]   = useState('')
  const [draftUrl,     setDraftUrl]     = useState('')
  const [draftIcon,    setDraftIcon]    = useState(ICON_OPTIONS[0].key)
  const [copiedId,     setCopiedId]     = useState<string | null>(null)

  // Resume slots — keyed by slot letter
  const [resumeSlots,    setResumeSlots]    = useState<Partial<Record<ResumeSlot, ResumeSlotRecord>>>({})
  const [uploadingSlot,  setUploadingSlot]  = useState<ResumeSlot | null>(null)
  const [loadingSlot,    setLoadingSlot]    = useState<ResumeSlot | null>(null)
  const [editingSlot,    setEditingSlot]    = useState<ResumeSlot | null>(null)
  const [showResume,     setShowResume]     = useState(false)
  const [resumeSignedUrl, setResumeSignedUrl] = useState<string | null>(null)
  const [activeSlot,     setActiveSlot]     = useState<ResumeSlot | null>(null)
  const [aiModalOpen,    setAiModalOpen]    = useState(false)
  const [ollamaStatus,   setOllamaStatus]   = useState<'unknown' | 'connected' | 'not_connected'>('unknown')

  // AI quick-generate (right-click submenu)
  const [aiMenuOpen,     setAiMenuOpen]     = useState(false)
  const [aiSettings,     setAiSettings]     = useState<AiSettings | null>(null)
  const aiMenuRef    = useRef<HTMLDivElement>(null)
  const aiAbortRef   = useRef<AbortController | null>(null)
  const [aiGenerating,   setAiGenerating]   = useState(false)
  const [aiGenDots,      setAiGenDots]      = useState(0)
  const [aiResult,       setAiResult]       = useState<string | null>(null)

  const containerRef  = useRef<HTMLDivElement>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)
  const fileInputRefs = useRef<Partial<Record<ResumeSlot, HTMLInputElement | null>>>({})
  const linkButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const editPopupRef  = useRef<HTMLDivElement>(null)
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null)

  // On mount: resolve user, load from DB
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      setLinks(loadLinks(user.id))
      dbFetchLinks(user.id).then((rows) => {
        if (rows.length > 0) {
          setLinks(rows.map((r) => ({ id: r.id, label: r.label, url: r.url, icon: r.icon })))
        }
      })
      fetchResumeSlots(user.id).then((rows) => {
        const map: Partial<Record<ResumeSlot, ResumeSlotRecord>> = {}
        rows.forEach((r) => { map[r.slot as ResumeSlot] = r })
        setResumeSlots(map)
      })
      fetchAiSettings(user.id).then(setAiSettings)
    })
  }, [])

  // Background Ollama status poll — checks once on mount, then every 15s
  useEffect(() => {
    function check() {
      fetchModels().then(({ status }) => setOllamaStatus(status))
    }
    check()
    const interval = setInterval(check, 15000)
    return () => clearInterval(interval)
  }, [])

  // Persist links to localStorage whenever they change
  useEffect(() => { if (userId) saveLinks(userId, links) }, [userId, links])

  // Generating dots animation
  useEffect(() => {
    if (!aiGenerating) return
    const id = setInterval(() => setAiGenDots((d) => (d + 1) % 3), 500)
    return () => clearInterval(id)
  }, [aiGenerating])

  // Close AI context menu when clicking outside
  useEffect(() => {
    if (!aiMenuOpen) return
    function onPointerDown(e: PointerEvent) {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setAiMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [aiMenuOpen])

  // Focus label input when add form opens
  useEffect(() => {
    if (addFormOpen && editingId) {
      setTimeout(() => labelInputRef.current?.focus(), 0)
    }
  }, [addFormOpen, editingId])

  // Close resume name popover when clicking outside
  useEffect(() => {
    if (!editingSlot) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (!containerRef.current?.contains(target)) setEditingSlot(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [editingSlot])

  // Close link edit popup when clicking outside
  useEffect(() => {
    if (!addFormOpen || !editingId || editingId === 'new') return
    function onPointerDown(e: PointerEvent) {
      if (editPopupRef.current && !editPopupRef.current.contains(e.target as Node)) {
        cancelEdit()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [addFormOpen, editingId])

  // ── Link handlers ─────────────────────────────────────────────────────────

  function handleCopy(slot: QuickCastSlot) {
    playSpellCast()
    navigator.clipboard.writeText(slot.url).catch(() => {
      try {
        const ta = document.createElement('textarea')
        ta.value = slot.url
        ta.style.cssText = 'position:fixed;opacity:0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      } catch { /* ignore */ }
    })
    setCopiedId(slot.id)
    setTimeout(() => setCopiedId(null), 600)
  }

  function openAddForm() {
    setEditingId('new')
    setDraftLabel('')
    setDraftUrl('')
    setDraftIcon(ICON_OPTIONS[0].key)
    setAddFormOpen(true)
  }

  function openEditSlot(slot: QuickCastSlot) {
    setEditingId(slot.id)
    setDraftLabel(slot.label)
    setDraftUrl(slot.url)
    setDraftIcon(slot.icon)
    setAddFormOpen(true)
    // Compute clamped fixed position above the button
    const btn = linkButtonRefs.current[slot.id]
    if (btn) {
      const rect = btn.getBoundingClientRect()
      const popupW = 224 // w-56
      const popupH = 220 // approximate
      const top = Math.max(8, rect.top - popupH - 8)
      const left = Math.min(rect.left, window.innerWidth - popupW - 8)
      setPopupPos({ top, left: Math.max(8, left) })
    }
  }

  function commitEdit() {
    if (!draftUrl.trim()) return
    const label = draftLabel.trim()
    const url   = draftUrl.trim()
    const icon  = draftIcon
    if (editingId === 'new') {
      const tempId = crypto.randomUUID()
      setLinks((prev) => [...prev, { id: tempId, label, url, icon }])
      if (userId) {
        dbCreateLink(userId, { label, url, icon, position: links.length }).then((realId) => {
          if (realId) {
            setLinks((prev) => prev.map((s) => s.id === tempId ? { ...s, id: realId } : s))
          }
        })
      }
    } else if (editingId) {
      setLinks((prev) =>
        prev.map((s) => s.id === editingId ? { ...s, label, url, icon } : s)
      )
      if (userId) {
        const position = links.findIndex((s) => s.id === editingId)
        dbUpdateLink({ id: editingId, label, url, icon, position })
      }
    }
    setAddFormOpen(false)
    setEditingId(null)
  }

  function cancelEdit() {
    setAddFormOpen(false)
    setEditingId(null)
  }

  function deleteSlot(id: string) {
    setLinks((prev) => prev.filter((s) => s.id !== id))
    if (userId) dbDeleteLink(id)
    if (editingId === id) { setAddFormOpen(false); setEditingId(null) }
  }

  // ── Resume handlers ───────────────────────────────────────────────────────

  async function handleResumeFileInput(slot: ResumeSlot, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!file || !allowed.includes(file.type)) return
    if (!userId) return
    setUploadingSlot(slot)
    const { error } = await uploadResumePdf(userId, slot, file)
    if (!error) {
      const name = resumeSlots[slot]?.name ?? 'Resume'
      await upsertResumeSlot(userId, slot, name)
      setResumeSlots((prev) => ({
        ...prev,
        [slot]: {
          id: prev[slot]?.id ?? crypto.randomUUID(),
          user_id: userId,
          slot,
          name,
          uploaded_at: new Date().toISOString(),
        },
      }))
    }
    if (!error) invalidateSlot(userId, slot)
    setUploadingSlot(null)
  }

  async function handleOpenResume(slot: ResumeSlot) {
    if (loadingSlot || !userId) return
    setLoadingSlot(slot)
    const signedUrl = await getResumeSignedUrl(userId, slot)
    setLoadingSlot(null)
    if (!signedUrl) return
    setActiveSlot(slot)
    setResumeSignedUrl(signedUrl)
    setShowResume(true)
  }

  async function handleReplace(slot: ResumeSlot, file: File) {
    if (!userId) return
    setUploadingSlot(slot)
    const { error } = await uploadResumePdf(userId, slot, file)
    if (!error) {
      const name = resumeSlots[slot]?.name ?? 'Resume'
      await upsertResumeSlot(userId, slot, name)
    }
    setUploadingSlot(null)
  }

  async function handleSaveName(slot: ResumeSlot, name: string) {
    setEditingSlot(null)
    if (!userId) return
    await upsertResumeSlot(userId, slot, name)
    setResumeSlots((prev) => ({
      ...prev,
      [slot]: {
        ...prev[slot]!,
        name,
      },
    }))
  }

  async function handleDeleteResume(slot: ResumeSlot) {
    setEditingSlot(null)
    if (!userId) return
    await deleteResumePdf(userId, slot)
    await deleteResumeSlot(userId, slot)
    setResumeSlots((prev) => {
      const next = { ...prev }
      delete next[slot]
      return next
    })
  }

  function triggerUpload(slot: ResumeSlot) {
    fileInputRefs.current[slot]?.click()
  }

  // ── AI quick-generate ─────────────────────────────────────────────────────

  async function handleAiQuickGenerate(mode: 'cover_letter' | 'why_work_here' | 'custom') {
    if (!userId || aiGenerating) return
    setAiMenuOpen(false)

    // Read clipboard for job description
    let jd = ''
    try { jd = await navigator.clipboard.readText() } catch { /* permission denied */ }

    // Resolve prompt from saved settings or defaults
    const systemPrompt =
      mode === 'cover_letter'
        ? (aiSettings?.cover_letter_prompt || DEFAULT_PROMPTS.cover_letter)
        : mode === 'why_work_here'
        ? (aiSettings?.why_good_fit_prompt  || DEFAULT_PROMPTS.why_good_fit)
        : (aiSettings?.custom_prompt        || DEFAULT_PROMPTS.custom)

    // Pick first available model
    const { models } = await fetchModels()
    if (models.length === 0) return

    // Assemble resume context from any occupied slots
    const occupiedSlots = (Object.keys(resumeSlots) as ResumeSlot[]).filter((s) => resumeSlots[s])
    const parts: string[] = []
    for (const slot of occupiedSlots) {
      const signedUrl = await getResumeSignedUrl(userId, slot)
      if (signedUrl) {
        const text = await getResumeText(userId, slot, signedUrl)
        if (text) parts.push(`--- RESUME ${slot.toUpperCase()} ---\n${text}`)
      }
    }
    let userPrompt = ''
    if (parts.length > 0) userPrompt += `RESUME:\n${parts.join('\n\n')}\n\n`
    if (jd.trim()) userPrompt += `JOB DESCRIPTION:\n${jd.trim()}`

    setAiResult(null)
    setAiGenerating(true)
    setAiGenDots(0)
    playAiConsume()

    let accumulated = ''
    const controller = new AbortController()
    aiAbortRef.current = controller

    streamCompletion({
      model: models[0],
      system: systemPrompt,
      prompt: userPrompt,
      signal: controller.signal,
      onToken: (token) => { accumulated += token },
      onDone: () => {
        setAiGenerating(false)
        setAiResult(accumulated)
        playAiDing()
      },
      onError: () => {
        setAiGenerating(false)
      },
    })
  }

  // ── Shared classnames ─────────────────────────────────────────────────────

  const inputCls =
    'bg-bg border border-border text-primary text-[9px] px-2 py-1 ' +
    'outline-none focus:border-primary font-pixel placeholder-muted w-full'

  const hotbarBtnCls = (active: boolean, extra = '') => [
    'w-20 h-20 flex items-center justify-center leading-none',
    'border transition-none cursor-pointer select-none',
    active
      ? 'border-primary text-primary'
      : 'border-border text-muted hover:border-primary hover:text-primary',
    extra,
  ].join(' ')

  const formPanelCls =
    'bg-surface border border-border w-72 flex flex-col z-50 font-pixel text-xs'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        ref={containerRef}
        data-tutorial="quickcast"
        className="relative bg-bg border-t border-border px-6 pt-2 pb-3 hidden sm:flex sm:flex-col items-center gap-2 shrink-0"
      >
        {/* Label */}
        <span className="self-start text-[9px] text-dim font-pixel tracking-widest select-none">
          QUICK CAST
        </span>

        {/* Main hotbar row — three zones: links | resumes | + */}
        <div className="flex items-end gap-6 w-full justify-center">

          {/* ── Left zone: link slots ── */}
          <div data-tutorial="quickcast-links" className="flex items-center gap-1.5 relative">
            {links.map((slot) => (
              <div key={slot.id} className="relative group">
                <button
                  ref={(el) => { linkButtonRefs.current[slot.id] = el }}
                  onClick={() => handleCopy(slot)}
                  onContextMenu={(e) => { e.preventDefault(); openEditSlot(slot) }}
                  className={hotbarBtnCls(copiedId === slot.id)}
                  title={slot.label || slot.url}
                >
                  {renderIcon(slot.icon, 44)}
                </button>
                {/* Tooltip */}
                <div className={[
                  'absolute bottom-full right-0 mb-2',
                  'bg-surface border border-border font-pixel text-[8px] text-primary',
                  'px-2 py-1 whitespace-nowrap pointer-events-none z-50',
                  'opacity-0 group-hover:opacity-100 transition-none',
                ].join(' ')}>
                  {copiedId === slot.id ? 'COPIED!' : (slot.label || slot.url)}
                </div>
              </div>
            ))}
            {/* Edit popup — portalled to body so it's never clipped */}
            {addFormOpen && editingId && editingId !== 'new' && popupPos && createPortal(
              <div
                ref={editPopupRef}
                className={formPanelCls}
                style={{ position: 'fixed', top: popupPos.top, left: popupPos.left, zIndex: 9999 }}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-muted text-[9px] tracking-widest">EDIT SLOT</span>
                  <button
                    onClick={cancelEdit}
                    className="text-muted hover:text-primary text-[9px] transition-none"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
                <div className="px-3 py-2 flex flex-col gap-2">
                  <input
                    ref={labelInputRef}
                    className={inputCls}
                    placeholder="Label  (e.g. LinkedIn)"
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                  />
                  <input
                    className={inputCls}
                    placeholder="https://..."
                    value={draftUrl}
                    onChange={(e) => setDraftUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                  />
                  <IconPicker value={draftIcon} onChange={setDraftIcon} />
                  <div className="flex gap-1 mt-0.5">
                    <button
                      onClick={commitEdit}
                      disabled={!draftUrl.trim()}
                      className="bg-primary text-bg text-[9px] px-3 py-1 font-pixel hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-none"
                    >
                      SAVE
                    </button>
                    <button
                      onClick={() => deleteSlot(editingId)}
                      className="text-muted border border-border text-[9px] px-3 py-1 font-pixel hover:border-warning hover:text-warning transition-none"
                    >
                      DELETE
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {/* + button — hidden at max slots */}
            {links.length < MAX_SLOTS && (
              <div className="relative">
                <button
                  onClick={() => addFormOpen ? cancelEdit() : openAddForm()}
                  className={hotbarBtnCls(addFormOpen, 'text-2xl')}
                  title="Add link"
                >
                  {addFormOpen ? '✕' : '+'}
                </button>

                {/* Add form — pops upward above the + button (new slots only) */}
                {addFormOpen && editingId === 'new' && (
                  <div className={`absolute bottom-full right-0 mb-2 ${formPanelCls}`}>
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                      <span className="text-muted text-[9px] tracking-widest">ADD SLOT</span>
                    </div>
                    <div className="px-3 py-2 flex flex-col gap-2">
                      <input
                        ref={labelInputRef}
                        className={inputCls}
                        placeholder="Label  (e.g. LinkedIn)"
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                      />
                      <input
                        className={inputCls}
                        placeholder="https://..."
                        value={draftUrl}
                        onChange={(e) => setDraftUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                      />
                      <IconPicker value={draftIcon} onChange={setDraftIcon} />
                      <div className="flex gap-1 mt-0.5">
                        <button
                          onClick={commitEdit}
                          disabled={!draftUrl.trim()}
                          className="bg-primary text-bg text-[9px] px-3 py-1 font-pixel hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-none"
                        >
                          SAVE
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-muted border border-border text-[9px] px-3 py-1 font-pixel hover:border-secondary hover:text-secondary transition-none"
                        >
                          CANCEL
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Center zone: resume slots (A, B, C) ── */}
          <div data-tutorial="quickcast-resumes" className="flex items-end gap-1.5">
            {RESUME_SLOTS.map((slot) => {
              const record      = resumeSlots[slot]
              const colors      = SLOT_COLORS[slot]
              const hasFile     = Boolean(record)
              const isUploading = uploadingSlot === slot
              const isLoading   = loadingSlot === slot
              const isEditOpen  = editingSlot === slot
              const locked      = PREMIUM_SLOTS.includes(slot) && !isSubscribed
              return (
                <div key={slot} className="relative flex flex-col items-center gap-0.5">
                  {/* Name popover */}
                  {isEditOpen && hasFile && !locked && (
                    <ResumeNamePopover
                      slot={slot}
                      currentName={record!.name}
                      onSave={(name) => handleSaveName(slot, name)}
                      onDelete={() => handleDeleteResume(slot)}
                      onClose={() => setEditingSlot(null)}
                    />
                  )}

                  {/* Slot button */}
                  <div className="relative group">
                    <button
                      onClick={() => {
                        if (locked || isUploading || isLoading) return
                        if (hasFile) {
                          playPageFlip()
                          handleOpenResume(slot)
                        } else {
                          playPageFlip()
                          triggerUpload(slot)
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        if (!locked && hasFile) setEditingSlot(isEditOpen ? null : slot)
                      }}
                      disabled={isUploading || isLoading}
                      className={[
                        'w-20 h-20 flex flex-col items-center justify-center gap-1 leading-none',
                        'border transition-none select-none',
                        locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                        (!locked && (isUploading || isLoading)) ? 'opacity-50 cursor-not-allowed' : '',
                      ].join(' ')}
                      style={{
                        borderColor: locked ? 'var(--color-border)' : hasFile ? colors.border : 'var(--color-border)',
                        color:       locked ? 'var(--color-muted)'  : hasFile ? colors.text   : 'var(--color-muted)',
                      }}
                      title={locked
                        ? 'Upgrade for access to two more resume slots'
                        : hasFile
                        ? `${record!.name} — click to preview, right-click to rename`
                        : `Upload Resume ${slot.toUpperCase()}`}
                    >
                      <FileText width={32} height={32} />
                      <span className="font-pixel text-[7px] tracking-widest leading-none">
                        {locked ? '🔒' : isUploading || isLoading ? '...' : hasFile ? record!.name.slice(0, 10) : slot.toUpperCase()}
                      </span>
                    </button>

                    {/* Tooltip */}
                    <div className={[
                      'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
                      'bg-surface border border-border font-pixel text-[8px] text-primary',
                      'px-2 py-1 pointer-events-none z-50',
                      'opacity-0 group-hover:opacity-100 transition-none',
                      locked ? 'whitespace-normal w-36 text-center' : 'whitespace-nowrap',
                    ].join(' ')}>
                      {locked
                        ? 'Upgrade for access to two more resume slots'
                        : isUploading ? 'UPLOADING...'
                        : isLoading   ? 'LOADING...'
                        : hasFile     ? record!.name
                        : `RESUME ${slot.toUpperCase()}`}
                    </div>
                  </div>

                  {/* Hidden file input */}
                  {!locked && (
                    <input
                      ref={(el) => { fileInputRefs.current[slot] = el }}
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={(e) => handleResumeFileInput(slot, e)}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Right zone: AI assistant ── */}
          <div className="relative flex flex-col items-center" ref={aiMenuRef}>
            <button
              data-tutorial="ai-assistant"
              onClick={() => {
                if (aiGenerating) return
                setAiModalOpen((prev) => !prev)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                if (ollamaStatus !== 'connected' || aiGenerating) return
                setAiMenuOpen((prev) => !prev)
              }}
              className={[
                'w-20 h-20 flex flex-col items-center justify-center gap-1 leading-none',
                'border transition-none select-none cursor-pointer',
                aiModalOpen
                  ? 'border-primary text-primary'
                  : aiResult && !aiGenerating
                  ? 'qc-ai-ready'
                  : 'border-border text-muted hover:border-primary hover:text-primary',
              ].join(' ')}
              title={aiGenerating ? 'Generating…' : aiResult ? 'Click to view result · Right-click for quick generate' : 'AI Resume Assistant · Right-click for quick generate'}
            >
              <span className="font-pixel leading-none font-bold tracking-tight" style={{ fontSize: 24 }}>
                AI
              </span>
              <span
                className="font-pixel text-[7px] tracking-widest leading-none"
                style={{
                  color: aiGenerating
                    ? '#22c55e'
                    : aiResult
                    ? '#7e22ce'
                    : ollamaStatus === 'connected'
                    ? '#22c55e'
                    : ollamaStatus === 'not_connected'
                    ? 'var(--color-warning)'
                    : 'var(--color-dim)',
                }}
              >
                {aiGenerating
                  ? `GEN${'.'.repeat(aiGenDots + 1)}${'  '.repeat(2 - aiGenDots)}`
                  : aiResult
                  ? '● READY'
                  : ollamaStatus === 'connected'
                  ? '● ON'
                  : ollamaStatus === 'not_connected'
                  ? '○ OFF'
                  : '· · ·'}
              </span>
            </button>

            {/* AI right-click context menu */}
            {aiMenuOpen && (
              <div className="absolute bottom-full mb-2 right-0 z-50 bg-surface border border-border font-pixel text-xs flex flex-col w-56">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-[9px] tracking-widest text-muted">QUICK GENERATE</span>
                  <button
                    onClick={() => setAiMenuOpen(false)}
                    className="text-muted hover:text-primary text-[9px] transition-none"
                  >
                    ✕
                  </button>
                </div>
                <div className="px-3 py-2 flex flex-col gap-1">
                  {([
                    ['cover_letter',  'COVER LETTER'],
                    ['why_work_here', 'WHY WORK HERE?'],
                    ['custom',        'CUSTOM'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => handleAiQuickGenerate(mode)}
                      className="text-left text-muted border border-border text-[9px] px-2 py-1 font-pixel hover:border-primary hover:text-primary transition-none flex items-center gap-1.5"
                    >
                      <Clipboard width={10} height={10} className="shrink-0" />
                      + {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* AI panel — fixed centered overlay */}
      {aiModalOpen && userId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <AiModal
              userId={userId}
              resumeSlots={resumeSlots}
              initialOutput={aiResult ?? undefined}
              onClose={() => { setAiModalOpen(false); setAiResult(null) }}
            />
          </div>
        </div>
      )}

      {/* Resume modal */}
      {showResume && resumeSignedUrl && activeSlot && resumeSlots[activeSlot] && (
        <ResumeModal
          url={resumeSignedUrl}
          fileName={resumeSlots[activeSlot]!.name}
          slotColor={SLOT_COLORS[activeSlot].border}
          replacing={uploadingSlot === activeSlot}
          onClose={() => { setShowResume(false); setResumeSignedUrl(null); setActiveSlot(null) }}
          onReplace={(file) => handleReplace(activeSlot, file)}
        />
      )}
    </>
  )
}
