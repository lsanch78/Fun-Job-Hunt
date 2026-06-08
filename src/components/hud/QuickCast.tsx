import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { playSpellCast } from '@/lib/sfx'
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
import { supabase } from '@/lib/supabase'
import {
  fetchLinks as dbFetchLinks,
  createLink as dbCreateLink,
  updateLink as dbUpdateLink,
  deleteLink as dbDeleteLink,
} from '@/services/quickCastService'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SLOTS  = 8

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


// ── QuickCast ─────────────────────────────────────────────────────────────────


export default function QuickCast() {
  // Link slots
  const [links,        setLinks]        = useState<QuickCastSlot[]>([])
  const [userId,       setUserId]       = useState<string | null>(null)
  const [addFormOpen,  setAddFormOpen]  = useState(false)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [draftLabel,   setDraftLabel]   = useState('')
  const [draftUrl,     setDraftUrl]     = useState('')
  const [draftIcon,    setDraftIcon]    = useState(ICON_OPTIONS[0].key)
  const [copiedId,     setCopiedId]     = useState<string | null>(null)


  const containerRef  = useRef<HTMLDivElement>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)
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
    })
  }, [])

  // Persist links to localStorage whenever they change
  useEffect(() => { if (userId) saveLinks(userId, links) }, [userId, links])


  // Focus label input when add form opens
  useEffect(() => {
    if (addFormOpen && editingId) {
      setTimeout(() => labelInputRef.current?.focus(), 0)
    }
  }, [addFormOpen, editingId])


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

        {/* Main hotbar row */}
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

        </div>
      </div>
    </>
  )
}
