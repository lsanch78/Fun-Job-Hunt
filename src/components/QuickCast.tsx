import { useState, useEffect, useRef, type ChangeEvent } from 'react'
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
import ResumeModal from '@/components/ResumeModal'
import {
  fetchLinks as dbFetchLinks,
  createLink as dbCreateLink,
  updateLink as dbUpdateLink,
  deleteLink as dbDeleteLink,
} from '@/services/quickCastService'

// ── Sounds ────────────────────────────────────────────────────────────────────

function playPageFlip() {
  try {
    const ctx = new AudioContext()
    // Three "kshh" hits spaced 0.18s apart
    const hitDuration = 0.65   // each burst lasts this long
    const spacing     = 0.10   // offset between hits
    const hitCount    = 3
    // Pre-bake one shared noise buffer (reused by all three sources)
    const bufSize = Math.ceil(ctx.sampleRate * hitDuration)
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) nd[i] = Math.random() * 2 - 1

    const volumes = [0.1, 0.07, 0.05]  // each echo quieter than the last
    for (let h = 0; h < hitCount; h++) {
      const t0 = ctx.currentTime + h * spacing

      const src = ctx.createBufferSource()
      src.buffer = noiseBuf
      src.playbackRate.value = 0.50 + h * 0.06

      const hpf = ctx.createBiquadFilter()
      hpf.type = 'highpass'
      hpf.frequency.value = 300

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(volumes[h], t0)               // instant on
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + hitDuration)

      src.connect(hpf)
      hpf.connect(gain)
      gain.connect(ctx.destination)
      src.start(t0)
      src.stop(t0 + hitDuration)
    }
  } catch { /* AudioContext blocked */ }
}

function playSpellCast() {
  try {
    const ctx = new AudioContext()
    // Ascending arpeggio sweep: classic 8-bit "item get" shape
    const notes = [220, 277.18, 329.63, 440, 554.37, 659.25]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.045
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.07, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
      osc.start(t)
      osc.stop(t + 0.1)
    })
  } catch { /* AudioContext blocked */ }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LINKS_KEY  = 'fjobhunt:quickcast:links'
const RESUME_KEY = 'fjobhunt:quickcast:resume'
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

function loadLinks(): QuickCastSlot[] {
  try {
    const raw = localStorage.getItem(LINKS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as QuickCastSlot[]
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_SLOTS)
    }
  } catch { /* ignore */ }
  return []
}

function saveLinks(links: QuickCastSlot[]): void {
  try { localStorage.setItem(LINKS_KEY, JSON.stringify(links)) } catch { /* ignore */ }
}

function loadResumeFileName(): string | null {
  try { return localStorage.getItem(RESUME_KEY) } catch { return null }
}

function saveResumeFileName(name: string | null): void {
  try {
    if (name) localStorage.setItem(RESUME_KEY, name)
    else localStorage.removeItem(RESUME_KEY)
  } catch { /* ignore */ }
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
  const [links,        setLinks]        = useState<QuickCastSlot[]>(loadLinks)
  const [userId,       setUserId]       = useState<string | null>(null)
  const [addFormOpen,  setAddFormOpen]  = useState(false)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [draftLabel,   setDraftLabel]   = useState('')
  const [draftUrl,     setDraftUrl]     = useState('')
  const [draftIcon,    setDraftIcon]    = useState(ICON_OPTIONS[0].key)
  const [copiedId,     setCopiedId]     = useState<string | null>(null)

  // Resume
  const [resumeFileName,  setResumeFileName]  = useState<string | null>(loadResumeFileName)
  const [resumeUploading, setResumeUploading] = useState(false)
  const [showResume,      setShowResume]      = useState(false)
  const [resumeSignedUrl, setResumeSignedUrl] = useState<string | null>(null)
  const [resumeLoading,   setResumeLoading]   = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)

  // On mount: resolve user, load from DB if signed in
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      dbFetchLinks(user.id).then((rows) => {
        if (rows.length > 0) {
          setLinks(rows.map((r) => ({ id: r.id, label: r.label, url: r.url, icon: r.icon })))
        }
      })
    })
  }, [])

  // Persist to localStorage whenever links change (fallback for signed-out users)
  useEffect(() => { saveLinks(links) }, [links])

  // Focus label input when add form opens
  useEffect(() => {
    if (addFormOpen && editingId) {
      setTimeout(() => labelInputRef.current?.focus(), 0)
    }
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

  async function uploadResume(file: File) {
    if (file.type !== 'application/pdf') return
    setResumeUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setResumeUploading(false); return }
    const { error } = await supabase.storage
      .from('resumes')
      .upload(`${user.id}/resume.pdf`, file, { upsert: true, contentType: 'application/pdf' })
    if (error) {
      console.error('[QuickCast] resume upload:', error.message)
    } else {
      setResumeFileName(file.name)
      saveResumeFileName(file.name)
    }
    setResumeUploading(false)
  }

  function handleResumeFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) uploadResume(file)
  }

  async function handleOpenResume() {
    if (resumeLoading) return
    setResumeLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setResumeLoading(false); return }
    const { data, error } = await supabase.storage
      .from('resumes')
      .createSignedUrl(`${user.id}/resume.pdf`, 3600)
    if (error || !data) {
      console.error('[QuickCast] signed URL:', error?.message)
      setResumeLoading(false)
      return
    }
    setResumeSignedUrl(data.signedUrl)
    setShowResume(true)
    setResumeLoading(false)
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
        className="relative bg-bg border-t border-border px-6 pt-2 pb-3 flex flex-col items-center gap-2 shrink-0"
      >
        {/* Label */}
        <span className="self-start text-[9px] text-dim font-pixel tracking-widest select-none">
          QUICK CAST
        </span>

        {/* Main hotbar row — three zones: links | resume | + */}
        <div className="flex items-end gap-6 w-full justify-center">

          {/* ── Left zone: link slots ── */}
          <div className="flex items-center gap-1.5 relative">
            {links.map((slot) => (
              <div key={slot.id} className="relative group">
                <button
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

                {/* Add / edit form — pops upward above the + button */}
                {addFormOpen && (
                  <div className={`absolute bottom-full right-0 mb-2 ${formPanelCls}`}>
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                      <span className="text-muted text-[9px] tracking-widest">
                        {editingId === 'new' ? 'ADD SLOT' : 'EDIT SLOT'}
                      </span>
                      {editingId && editingId !== 'new' && (
                        <button
                          onClick={() => deleteSlot(editingId)}
                          className="text-muted hover:text-warning text-[9px] transition-none"
                          title="Delete slot"
                        >
                          ✕ DELETE
                        </button>
                      )}
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

          {/* ── Center zone: resume button ── */}
          <div className="flex flex-col items-center gap-1 relative">
            <div className="relative group">
              <button
                onClick={resumeFileName ? () => { playPageFlip(); handleOpenResume() } : () => { playPageFlip(); fileInputRef.current?.click() }}
                disabled={resumeLoading || resumeUploading}
                className={[
                  'w-20 h-20 flex items-center justify-center leading-none',
                  'border transition-none select-none',
                  resumeFileName
                    ? 'border-secondary text-secondary hover:border-primary hover:text-primary cursor-pointer'
                    : 'border-border text-muted hover:border-primary hover:text-primary cursor-pointer',
                  (resumeLoading || resumeUploading) ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
                title={resumeFileName ? 'Preview Resume' : 'Upload Resume'}
              >
                <FileText width={44} height={44} />
              </button>
              {/* Tooltip */}
              <div className={[
                'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
                'bg-surface border border-border font-pixel text-[8px] text-primary',
                'px-2 py-1 whitespace-nowrap pointer-events-none z-50',
                'opacity-0 group-hover:opacity-100 transition-none',
              ].join(' ')}>
                {resumeLoading ? 'LOADING...' : resumeUploading ? 'UPLOADING...' : 'RESUME'}
              </div>
            </div>

            {/* Hidden file input for initial upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleResumeFileInput}
            />
          </div>

        </div>
      </div>

      {/* Resume modal */}
      {showResume && resumeSignedUrl && resumeFileName && (
        <ResumeModal
          url={resumeSignedUrl}
          fileName={resumeFileName}
          replacing={resumeUploading}
          onClose={() => { setShowResume(false); setResumeSignedUrl(null) }}
          onReplace={(file) => uploadResume(file)}
        />
      )}
    </>
  )
}
