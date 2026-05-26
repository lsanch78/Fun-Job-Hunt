import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { isSfxMuted } from '@/lib/sfx'
import { Terminal, Trash } from 'pixelarticons/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { XP } from '@/config/game'
import XpTracker from '@/components/XpTracker'
import type { Job, JobStatus } from '@/types'
import { readCache, writeCache, fetchJobs, insertJob, updateJob, updateJobDetails, deleteJobs, runAutoGhost, JOB_LIMITS, JOB_CAP } from '@/services/jobService'
import { fetchScratchPad, upsertScratchPad, SCRATCH_PAD_LIMIT } from '@/services/scratchPadService'
import AppDetailCard from '@/components/AppDetailCard'
import TutorialOverlay, { TUTORIAL_SEEN_KEY } from '@/components/TutorialOverlay'
import { registerTutorialTrigger, unregisterTutorialTrigger, broadcastTutorialActive } from '@/lib/tutorialBus'

interface JobRowHandle {
  focusFirstInput(): void
}

function emptyJob(): Job {
  return {
    id: crypto.randomUUID(),
    company: '',
    title: '',
    status: 'APPLIED',
    postingUrl: '',
    applicationDate: (() => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-') })(),
    rating: 0,
    salary: '',
    committed: false,
    saving: false,
  }
}

const STATUS_OPTIONS: JobStatus[] = [
  'APPLIED', 'PHONE_SCREEN', 'INTERVIEW', 'OFFER', 'REJECTED', 'GHOSTED', 'WITHDRAWN',
]

const STATUS_COLORS: Record<JobStatus, string> = {
  APPLIED:      'text-dim',
  PHONE_SCREEN: 'text-secondary',
  INTERVIEW:    'text-secondary',
  OFFER:        'text-secondary',
  REJECTED:     'text-warning',
  GHOSTED:      'text-warning',
  WITHDRAWN:    'text-warning',
}

const cellInput =
  'bg-transparent border-0 outline-none w-full text-primary font-pixel text-xs placeholder-muted focus:bg-surface focus:border-b focus:border-primary px-1 py-0.5 min-w-0'

function isDraftReady(draft: Job): boolean {
  return draft.company.trim() !== '' && draft.title.trim() !== ''
}

// ── Sound: status upgrade chime (Phone Screen / Interview) ───────────────────
function playProgressChime() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    // Two ascending notes: G4 → B4
    const notes = [392.00, 493.88]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.14
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.09, t + 0.03)
      gain.gain.setValueAtTime(0.09, t + 0.14)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
      osc.start(t)
      osc.stop(t + 0.45)
    })
  } catch { /* AudioContext blocked */ }
}

// ── Sound: offer celebration fanfare ─────────────────────────────────────────
function playCelebrationFanfare() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    // C5 → E5 → G5 → E5 → C6
    const notes = [523.25, 659.25, 783.99, 659.25, 1046.5]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.13
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.04, t + 0.02)
      gain.gain.setValueAtTime(0.04, t + 0.11)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
      osc.start(t)
      osc.stop(t + 0.55)
    })
  } catch { /* AudioContext blocked */ }
}


// ── Sound ───────────────────────────────────────────────────────────────────
function playThud(mega = false) {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const keyCount = mega ? 14 : 7
    const spacing = mega ? 0.045 : 0.055

    for (let i = 0; i < keyCount; i++) {
      const t = ctx.currentTime + i * spacing + Math.random() * 0.015

      // Noise burst (the "click" body)
      const bufLen = ctx.sampleRate * 0.025
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let s = 0; s < bufLen; s++) data[s] = Math.random() * 2 - 1

      const src = ctx.createBufferSource()
      src.buffer = buf

      // Bandpass centred around the click sweet-spot (~3.5 kHz)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1000 + Math.random() * 5200
      bp.Q.value = 1.2

      // Short sharp envelope
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(mega ? 0.28 : 0.22, t + 0.002)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.022)

      src.connect(bp)
      bp.connect(gain)
      gain.connect(ctx.destination)
      src.start(t)
      src.stop(t + 0.03)
    }
  } catch { /* AudioContext blocked */ }
}

// ── Sound: delete mode bump ───────────────────────────────────────────────────
function playDeleteBump() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    // Low thud: sub-bass sine with sharp transient
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(90, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.18)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.25)

    // Click transient on top
    const bufLen = ctx.sampleRate * 0.012
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 800
    const clickGain = ctx.createGain()
    clickGain.gain.setValueAtTime(0.3, ctx.currentTime)
    clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.012)
    src.connect(lp)
    lp.connect(clickGain)
    clickGain.connect(ctx.destination)
    src.start(ctx.currentTime)
    src.stop(ctx.currentTime + 0.015)
  } catch { /* AudioContext blocked */ }
}

// ── Sound: palatal click (checkbox select) ───────────────────────────────────
function playSelectClick() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const t = ctx.currentTime

    // Noise burst shaped like a mouth click — very short, mid-forward
    const bufLen = Math.ceil(ctx.sampleRate * 0.018)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf

    // Bandpass around 1.8 kHz — the "wet" mouth-click sweet spot
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800
    bp.Q.value = 2.2

    // Very fast attack, sharp decay
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.18, t + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.018)

    src.connect(bp)
    bp.connect(gain)
    gain.connect(ctx.destination)
    src.start(t)
    src.stop(t + 0.02)
  } catch { /* AudioContext blocked */ }
}

// ── Sound: scratch pad drawer open — slide out ───────────────────────────────
function playScratchOpen() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const t0 = ctx.currentTime
    const slideLen = ctx.sampleRate * 0.18
    const slideBuf = ctx.createBuffer(1, slideLen, ctx.sampleRate)
    const slideData = slideBuf.getChannelData(0)
    for (let i = 0; i < slideLen; i++) slideData[i] = Math.random() * 2 - 1
    const slideSrc = ctx.createBufferSource()
    slideSrc.buffer = slideBuf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(400, t0)
    bp.frequency.linearRampToValueAtTime(1800, t0 + 0.18)
    bp.Q.value = 1.5
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(0.12, t0 + 0.02)
    gain.gain.setValueAtTime(0.12, t0 + 0.14)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18)
    slideSrc.connect(bp); bp.connect(gain); gain.connect(ctx.destination)
    slideSrc.start(t0); slideSrc.stop(t0 + 0.19)
  } catch { /* AudioContext blocked */ }
}

// ── Sound: scratch pad drawer close — slide in ───────────────────────────────
function playScratchClose() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const t0 = ctx.currentTime
    const slideLen = ctx.sampleRate * 0.16
    const slideBuf = ctx.createBuffer(1, slideLen, ctx.sampleRate)
    const slideData = slideBuf.getChannelData(0)
    for (let i = 0; i < slideLen; i++) slideData[i] = Math.random() * 2 - 1
    const slideSrc = ctx.createBufferSource()
    slideSrc.buffer = slideBuf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(1600, t0)
    bp.frequency.linearRampToValueAtTime(300, t0 + 0.16)
    bp.Q.value = 1.5
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.10, t0)
    gain.gain.linearRampToValueAtTime(0.02, t0 + 0.14)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16)
    slideSrc.connect(bp); bp.connect(gain); gain.connect(ctx.destination)
    slideSrc.start(t0); slideSrc.stop(t0 + 0.17)
  } catch { /* AudioContext blocked */ }
}

// ── Sound: trash delete whoosh ────────────────────────────────────────────────
function playTrash(count = 1) {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const duration = Math.min(0.08 + count * 0.04, 0.55)

    // Descending noise whoosh
    const bufLen = Math.ceil(ctx.sampleRate * duration)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf

    // Highpass sweeping downward — starts bright, ends dull
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.setValueAtTime(3200, ctx.currentTime)
    hp.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + duration)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.22, ctx.currentTime)
    gain.gain.setValueAtTime(0.22, ctx.currentTime + duration * 0.6)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    src.connect(hp)
    hp.connect(gain)
    gain.connect(ctx.destination)
    src.start(ctx.currentTime)
    src.stop(ctx.currentTime + duration + 0.01)

    // Short descending pitch "crunch" at the end
    const crunch = ctx.createOscillator()
    crunch.type = 'sawtooth'
    const t0 = ctx.currentTime + duration * 0.5
    crunch.frequency.setValueAtTime(220, t0)
    crunch.frequency.exponentialRampToValueAtTime(55, t0 + duration * 0.5)
    const crunchGain = ctx.createGain()
    crunchGain.gain.setValueAtTime(0.06, t0)
    crunchGain.gain.exponentialRampToValueAtTime(0.001, t0 + duration * 0.5)
    crunch.connect(crunchGain)
    crunchGain.connect(ctx.destination)
    crunch.start(t0)
    crunch.stop(t0 + duration * 0.5 + 0.01)
  } catch { /* AudioContext blocked */ }
}

// ── XP popup ────────────────────────────────────────────────────────────────
interface XpPopup { id: number; mega: boolean; x: number; y: number; label?: string }

// Inject keyframes once into the document head
const XP_POP_STYLE = `
@keyframes xp-pop {
  0%   { opacity: 0; transform: translateX(-50%) translateY(0px)   scale(0.7); }
  15%  { opacity: 1; transform: translateX(-50%) translateY(-12px) scale(1.2); }
  70%  { opacity: 1; transform: translateX(-50%) translateY(-36px) scale(1.05); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-58px) scale(0.95); }
}
@keyframes xp-pop-mega {
  0%   { opacity: 0; transform: translateX(-50%) translateY(0px)   scale(0.7); }
  12%  { opacity: 1; transform: translateX(-50%) translateY(-10px) scale(1.65); }
  45%  { opacity: 1; transform: translateX(-50%) translateY(-38px) scale(1.35); }
  80%  { opacity: 0.85; transform: translateX(-50%) translateY(-62px) scale(1.1); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-82px) scale(0.9); }
}
`
if (typeof document !== 'undefined' && !document.getElementById('xp-pop-keyframes')) {
  const el = document.createElement('style')
  el.id = 'xp-pop-keyframes'
  el.textContent = XP_POP_STYLE
  document.head.appendChild(el)
}

// ── StarRating ───────────────────────────────────────────────────────────────
function StarRating({ value, onChange, onTabOut, onEnter, isNewRow }: {
  value: number
  onChange: (n: number) => void
  onTabOut?: () => void
  onEnter?: () => void
  isNewRow?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  function handleKeyDown(e: React.KeyboardEvent) {
    const n = Number(e.key)
    if (n >= 1 && n <= 5) { e.preventDefault(); onChange(value === n ? 0 : n) }
    if (e.key === '0') { e.preventDefault(); onChange(0) }
    if (e.key === 'Tab' && !e.shiftKey && onTabOut) { e.preventDefault(); onTabOut() }
    if (e.key === 'Enter') { e.preventDefault(); onEnter?.() }
  }

  if (isNewRow) {
    return (
      <span
        className="outline-none focus:border-b focus:border-primary block"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        title="Press 1–5 to rate, 0 to clear"
      >
        <span className={`font-pixel text-[9px] leading-none select-none ${isFocused ? 'text-primary' : 'text-muted'}`}>
          {value > 0 ? `${value}/5` : '1-5'}
        </span>
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-0">
      <span
        className="flex gap-0.5 whitespace-nowrap outline-none focus:border-b focus:border-primary"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        title="Press 1–5 to rate, 0 to clear"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            tabIndex={-1}
            className={`text-xs leading-none ${n <= (hover ?? value) ? 'text-secondary' : 'text-muted'}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onChange(value === n ? 0 : n)}
            title={`${n} star${n !== 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
      </span>
    </div>
  )
}

// ── Status cell — mouse-only, outside tab flow ────────────────────────────────
function StatusCell({
  status,
  onStatusChange,
}: {
  status: JobStatus
  onStatusChange: (s: JobStatus) => void
}) {
  const mutedSelect = 'bg-transparent border-0 outline-none w-full font-pixel text-xs text-muted bg-bg cursor-pointer px-1 py-0.5 min-w-0'

  return (
    <td className="px-2 py-1 min-w-[120px]">
      <select
        tabIndex={-1}
        className={`${mutedSelect} ${STATUS_COLORS[status]}`}
        value={status}
        onChange={(e) => onStatusChange(e.target.value as JobStatus)}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s} className="bg-bg text-primary">
            {s.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </td>
  )
}

// ── DateCell ──────────────────────────────────────────────────────────────────
function DateCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // value is YYYY-MM-DD; display as MM/DD
  const display = value ? value.slice(5).replace('-', '/') : '—'

  function startEditing() {
    setEditing(true)
    setTimeout(() => inputRef.current?.showPicker?.(), 0)
  }

  return (
    <td className="px-2 py-1 w-[54px]">
      <div className="relative">
        {/* Always-visible MM/DD label */}
        <button
          tabIndex={-1}
          className={`font-pixel text-xs px-1 py-0.5 bg-transparent border-0 outline-none w-full text-left cursor-pointer ${editing ? 'text-primary' : 'text-muted hover:text-primary'}`}
          title={value}
          onClick={startEditing}
        >
          {display}
        </button>
        {/* Hidden date input — opened programmatically, never rendered visibly */}
        <input
          ref={inputRef}
          tabIndex={-1}
          type="date"
          className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
          value={value}
          onChange={(e) => { onChange(e.target.value); setEditing(false) }}
          onBlur={() => setEditing(false)}
        />
      </div>
    </td>
  )
}

// ── PostingCell ───────────────────────────────────────────────────────────────
function PostingCell({ value, onChange, onEnter }: {
  value: string
  onChange: (v: string) => void
  onEnter: () => void
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleBlur() {
    setEditing(false)
  }

  const showLink = value && !editing

  return (
    <td className="px-2 py-1 w-10 text-center">
      {showLink ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-secondary hover:text-primary inline-flex items-center justify-center"
          title={value}
          tabIndex={-1}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </a>
      ) : (
        <input
          ref={inputRef}
          className={`${cellInput} text-center`}
          placeholder="_"
          value={value}
          maxLength={JOB_LIMITS.postingUrl}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onEnter()}
          onBlur={handleBlur}
          onFocus={() => setEditing(true)}
        />
      )}
    </td>
  )
}

// ── SalaryCell ────────────────────────────────────────────────────────────────
function SalaryCell({ value, onChange, onEnter }: {
  value: string
  onChange: (v: string) => void
  onEnter: () => void
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <td className="px-2 py-1 w-[72px]">
      {value && !editing ? (
        <button
          tabIndex={-1}
          className="font-pixel text-xs text-primary bg-transparent border-0 outline-none cursor-pointer hover:text-secondary px-1 py-0.5 whitespace-nowrap"
          onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) }}
        >
          ${value}K
        </button>
      ) : (
        <input
          ref={inputRef}
          className={cellInput}
          placeholder="_"
          value={value}
          maxLength={JOB_LIMITS.salary}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && onEnter()}
          onBlur={() => setEditing(false)}
          onFocus={() => setEditing(true)}
        />
      )}
    </td>
  )
}

// ── JobRow ───────────────────────────────────────────────────────────────────
const JobRow = forwardRef<JobRowHandle, {
  job: Job
  visibleCols: ColConfig[]
  onCommit: (committed: Job, rowEl: HTMLTableRowElement | null) => void
  onDraftChange: (draft: Job) => void
  onTabOut?: () => void
  deleteMode?: boolean
  checked?: boolean
  onToggle?: (id: string, e: React.MouseEvent<HTMLInputElement>) => void
  onOpenDetail?: () => void
  onDetailBlur?: (job: Job) => void
}>(function JobRow({ job, visibleCols, onCommit, onDraftChange, onTabOut, deleteMode, checked, onToggle, onOpenDetail, onDetailBlur }, ref) {
  const [draft, setDraft] = useState<Job>(job)
  const [focused, setFocused] = useState(false)
  const rowRef = useRef<HTMLTableRowElement>(null)

  useImperativeHandle(ref, () => ({
    focusFirstInput() {
      const firstInput = rowRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>(
        'input:not([type="checkbox"]):not([tabindex="-1"]), select:not([tabindex="-1"])'
      )
      firstInput?.focus()
    },
  }))

  useEffect(() => {
    if (!job.committed) setDraft(job)
  }, [job.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep committed job's detail fields in sync (lazy-loaded after detail card opens)
  useEffect(() => {
    if (job.committed) {
      setDraft((prev) => ({ ...prev, description: job.description, contacts: job.contacts, notes: job.notes }))
    }
  }, [job.description, job.contacts, job.notes, job.committed])

  function update<K extends keyof Job>(key: K, val: Job[K]) {
    const next = { ...draft, [key]: val }
    setDraft(next)
    onDraftChange(next)
  }

  function handleStatusChange(next: JobStatus) {
    if (next === 'OFFER') {
      playCelebrationFanfare()
    } else if (next === 'PHONE_SCREEN' || next === 'INTERVIEW') {
      playProgressChime()
    }
    update('status', next)
  }

  function tryCommit() {
    if (!draft.committed && isDraftReady(draft)) {
      const committed = { ...draft, committed: true }
      setDraft(committed)
      onCommit(committed, rowRef.current)
    }
  }

  const ready = isDraftReady(draft)
  const committed = draft.committed

  const rowClass = `border-b transition-colors ${
    committed
      ? `border-border ${focused ? 'bg-surface' : 'hover:bg-surface/50'}`
      : ready
        ? `border-secondary/40 ${focused ? 'bg-surface' : 'hover:bg-surface/50'}`
        : `border-border ${focused ? 'bg-surface' : 'hover:bg-surface/50'}`
  }`

  function renderCell(key: string) {
    switch (key) {
      case 'company':
        return (
          <td key="company" className="px-2 py-1 min-w-[120px]">
            <input
              className={cellInput}
              placeholder="Company"
              value={draft.company}
              maxLength={JOB_LIMITS.company}
              onChange={(e) => update('company', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && tryCommit()}
            />
          </td>
        )
      case 'title':
        return (
          <td key="title" className="px-2 py-1 min-w-[140px]">
            <input
              className={cellInput}
              placeholder="Job title"
              value={draft.title}
              maxLength={JOB_LIMITS.title}
              onChange={(e) => update('title', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && tryCommit()}
            />
          </td>
        )
      case 'url':
        return (
          <PostingCell
            key="url"
            value={draft.postingUrl}
            onChange={(v) => update('postingUrl', v)}
            onEnter={tryCommit}
          />
        )
      case 'salary':
        return <SalaryCell key="salary" value={draft.salary} onChange={(v) => update('salary', v)} onEnter={tryCommit} />
      case 'rating':
        return (
          <td key="rating" className="px-2 py-1 min-w-[90px]">
            <StarRating value={draft.rating} onChange={(n) => update('rating', n)} onTabOut={onTabOut} onEnter={tryCommit} isNewRow={!committed} />
          </td>
        )
      case 'date':
        return <DateCell key="date" value={draft.applicationDate} onChange={(v) => update('applicationDate', v)} />
      case 'status':
        return <StatusCell key="status" status={draft.status} onStatusChange={handleStatusChange} />
      case 'jd':
        return <DetailCell key="jd" value={draft.description} placeholder="Description" onChange={(v) => update('description', v)} onBlur={() => onDetailBlur?.(draft)} onOpenDetail={committed ? onOpenDetail : undefined} isNewRow={!committed} />
      case 'contacts':
        return <DetailCell key="contacts" value={draft.contacts} placeholder="Contacts" onChange={(v) => update('contacts', v)} onBlur={() => onDetailBlur?.(draft)} onOpenDetail={committed ? onOpenDetail : undefined} isNewRow={!committed} />
      case 'notes':
        return <DetailCell key="notes" value={draft.notes} placeholder="Notes" onChange={(v) => update('notes', v)} onBlur={() => onDetailBlur?.(draft)} onOpenDetail={committed ? onOpenDetail : undefined} isNewRow={!committed} />
      default:
        return null
    }
  }

  return (
    <tr
      ref={rowRef}
      className={rowClass}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      {/* Delete checkbox */}
      {deleteMode && (
        <td className="px-2 py-1 w-6">
          {job.committed && (
            <input
              type="checkbox"
              tabIndex={-1}
              checked={checked ?? false}
              onClick={(e) => onToggle?.(job.id, e)}
              onChange={() => {}}
              className="cursor-pointer accent-warning"
            />
          )}
        </td>
      )}

      {/* Fixed terminal icon — always leftmost, never reorderable */}
      <td className="px-2 py-1 w-6">
        <button
          tabIndex={-1}
          onClick={committed ? onOpenDetail : undefined}
          className={`flex-shrink-0 transition-colors ${committed ? 'text-muted hover:text-secondary cursor-pointer' : 'text-muted/30 cursor-default'}`}
          title={committed ? 'View application details' : undefined}
        >
          <Terminal width={22} height={22} />
        </button>
      </td>

      {visibleCols.map((col) => renderCell(col.key))}

      {/* Commit hint */}
      <td className="px-2 py-1 w-8">
        {ready && !committed && (
          <button tabIndex={-1} className="text-secondary text-xs animate-blink" title="Press Enter to log" onClick={tryCommit}>
            ↵
          </button>
        )}
        {committed && job.saving && (
          <span className="inline-flex items-center justify-center w-4 h-4" title="Saving…">
            <span className="text-secondary text-[8px] leading-none animate-pixel-spin inline-block">▪</span>
          </span>
        )}
        {committed && !job.saving && (
          <span className="text-muted text-xs">✓</span>
        )}
      </td>
    </tr>
  )
})

// ── Column configuration ──────────────────────────────────────────────────────
interface ColConfig {
  key: string
  visible: boolean
  width: number  // px
}

const COL_DEFS: Record<string, { label: string; defaultWidth: number }> = {
  company:  { label: 'COMPANY',  defaultWidth: 140 },
  title:    { label: 'TITLE',    defaultWidth: 160 },
  url:      { label: 'URL',      defaultWidth:  48 },
  salary:   { label: 'SALARY',   defaultWidth:  80 },
  rating:   { label: 'RATING',   defaultWidth:  96 },
  date:     { label: 'DATE',     defaultWidth:  60 },
  status:   { label: 'STATUS',   defaultWidth: 130 },
  jd:       { label: 'JD',       defaultWidth: 160 },
  contacts: { label: 'CONTACTS', defaultWidth: 140 },
  notes:    { label: 'NOTES',    defaultWidth: 160 },
}

const DEFAULT_COLS: ColConfig[] = [
  { key: 'company',  visible: true,  width: COL_DEFS.company.defaultWidth  },
  { key: 'title',    visible: true,  width: COL_DEFS.title.defaultWidth    },
  { key: 'url',      visible: true,  width: COL_DEFS.url.defaultWidth      },
  { key: 'salary',   visible: true,  width: COL_DEFS.salary.defaultWidth   },
  { key: 'rating',   visible: true,  width: COL_DEFS.rating.defaultWidth   },
  { key: 'date',     visible: true,  width: COL_DEFS.date.defaultWidth     },
  { key: 'status',   visible: true,  width: COL_DEFS.status.defaultWidth   },
  { key: 'jd',       visible: false, width: COL_DEFS.jd.defaultWidth       },
  { key: 'contacts', visible: false, width: COL_DEFS.contacts.defaultWidth },
  { key: 'notes',    visible: false, width: COL_DEFS.notes.defaultWidth    },
]

const COL_CONFIG_KEY = 'fjobhunt:col_config'

function readColConfig(): ColConfig[] {
  try {
    const raw = localStorage.getItem(COL_CONFIG_KEY)
    if (!raw) return DEFAULT_COLS
    const parsed = JSON.parse(raw) as ColConfig[]
    // Merge: keep saved order/visibility/width, add any new default cols, backfill width
    const savedKeys = new Set(parsed.map((c) => c.key))
    const withDefaults = parsed.map((c) => ({
      ...c,
      width: c.width ?? COL_DEFS[c.key]?.defaultWidth ?? 120,
    }))
    const merged = [...withDefaults, ...DEFAULT_COLS.filter((c) => !savedKeys.has(c.key))]
    return merged
  } catch {
    return DEFAULT_COLS
  }
}

function writeColConfig(cols: ColConfig[]): void {
  try { localStorage.setItem(COL_CONFIG_KEY, JSON.stringify(cols)) } catch { /* noop */ }
}

// ── Column context menu ───────────────────────────────────────────────────────
function ColContextMenu({
  x, y, isFirst, isLast, allCols,
  onMoveLeft, onMoveRight, onHide, onToggleCol, onReset, onClose,
}: {
  x: number; y: number
  isFirst: boolean; isLast: boolean
  allCols: ColConfig[]
  onMoveLeft: () => void; onMoveRight: () => void
  onHide: () => void; onToggleCol: (key: string) => void; onReset: () => void; onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const btnBase = 'block w-full text-left px-3 py-1.5 font-pixel text-[10px] transition-none'
  const btnActive = `${btnBase} text-primary hover:bg-surface`
  const btnDimmed = `${btnBase} text-muted/40 cursor-default`

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Menu */}
      <div
        className="fixed z-50 border border-border bg-bg py-1 min-w-[140px]"
        style={{ left: x, top: y }}
      >
        <button className={isFirst ? btnDimmed : btnActive} onClick={isFirst ? undefined : () => { onMoveLeft(); onClose() }}>
          ← Move Left
        </button>
        <button className={isLast ? btnDimmed : btnActive} onClick={isLast ? undefined : () => { onMoveRight(); onClose() }}>
          → Move Right
        </button>
        <div className="border-t border-border my-1" />
        <button className={btnActive} onClick={() => { onHide(); onClose() }}>
          ✕ Hide Column
        </button>
        <button className={btnActive} onClick={() => { onReset(); onClose() }}>
          ↺ Reset to Default
        </button>
        <div className="border-t border-border my-1" />
        {allCols.map((col) => (
          <button
            key={col.key}
            className={`${btnBase} flex items-center gap-2 text-muted hover:bg-surface hover:text-primary`}
            onClick={() => onToggleCol(col.key)}
          >
            <span className="w-3 text-secondary">{col.visible ? '✓' : ''}</span>
            {COL_DEFS[col.key].label}
          </button>
        ))}
      </div>
    </>
  )
}

// ── Editable detail cell (JD / Contacts / Notes) ─────────────────────────────
const PREVIEW_LIMIT = 200

function DetailCell({ value, onChange, onBlur, placeholder, onOpenDetail, isNewRow }: {
  value?: string
  onChange: (v: string) => void
  onBlur: () => void
  placeholder: string
  onOpenDetail?: () => void
  isNewRow?: boolean
}) {
  const [preview, setPreview] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function startHoverTimer() {
    if (!value) return
    hoverTimer.current = setTimeout(() => setPreview(true), 1000)
  }
  function clearHoverTimer() {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null }
    setPreview(false)
  }

  const previewText = value
    ? (value.length > PREVIEW_LIMIT ? value.slice(0, PREVIEW_LIMIT) + '…' : value)
    : ''

  // New (uncommitted) row — plain text input only
  if (isNewRow) {
    return (
      <td className="px-2 py-1 relative overflow-hidden">
        <input
          className={`${cellInput} text-muted placeholder-muted/40`}
          placeholder={placeholder}
          value={value ?? ''}
          maxLength={JOB_LIMITS.description}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      </td>
    )
  }

  // Committed row — <> button only, no inline text
  return (
    <td className="px-2 py-1 relative overflow-hidden">
      <button
        tabIndex={-1}
        onClick={onOpenDetail}
        onMouseEnter={startHoverTimer}
        onMouseLeave={clearHoverTimer}
        className={`font-pixel text-[9px] leading-none transition-colors ${value ? 'text-yellow-400 hover:text-yellow-200' : 'text-muted opacity-30 hover:opacity-60'}`}
        title="Open detail view"
      >
        {'<>'}
      </button>

      {/* 1s hover preview — only when value exists */}
      {preview && value && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-[400px] border border-border bg-bg px-4 py-3 font-terminal text-[15px] text-primary leading-relaxed whitespace-pre-wrap break-words cursor-pointer"
          onClick={onOpenDetail}
          onMouseEnter={() => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null } }}
          onMouseLeave={clearHoverTimer}
        >
          {previewText}
          {value.length > PREVIEW_LIMIT && onOpenDetail && (
            <span className="block mt-2 text-secondary text-[13px]">↵ open full view</span>
          )}
        </div>
      )}
    </td>
  )
}

// ── Filter / sort types ───────────────────────────────────────────────────────
type SortField = 'company' | 'date' | 'status'
type SortDir   = 'asc' | 'desc'
interface SortState { field: SortField; dir: SortDir }

type TimeRange = 'today' | '7d' | '30d' | 'year' | 'all'

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'TODAY'     },
  { value: '7d',    label: 'LAST 7D'  },
  { value: '30d',   label: 'LAST 30D' },
  { value: 'year',  label: 'YEAR'     },
  { value: 'all',   label: 'ALL TIME' },
]

const TIME_RANGE_KEY = 'fjobhunt:time_range'

function getTimeRangeCutoff(range: TimeRange): string | null {
  if (range === 'all') return null
  const d = new Date()
  if (range === 'today') {
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
  }
  if (range === '7d')   d.setDate(d.getDate() - 6)
  if (range === '30d')  d.setDate(d.getDate() - 29)
  if (range === 'year') d.setFullYear(d.getFullYear() - 1)
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
}

const HIDE_OPTIONS: { status: JobStatus; label: string }[] = [
  { status: 'GHOSTED',   label: 'Ghosted'   },
  { status: 'REJECTED',  label: 'Rejected'  },
  { status: 'WITHDRAWN', label: 'Withdrawn' },
]

const STATUS_ORDER: Record<JobStatus, number> = {
  OFFER: 0, INTERVIEW: 1, PHONE_SCREEN: 2, APPLIED: 3, WITHDRAWN: 4, REJECTED: 5, GHOSTED: 6,
}

function applyFilters(
  jobs: Job[],
  search: string,
  hidden: Set<JobStatus>,
  sort: SortState | null,
): Job[] {
  const q = search.trim().toLowerCase()

  let visible = jobs.filter((j) => {
    if (!j.committed) return true                          // drafts always shown
    if (hidden.has(j.status)) return false
    if (q && !j.company.toLowerCase().includes(q) && !j.title.toLowerCase().includes(q)) return false
    return true
  })

  if (sort) {
    const committed = visible.filter((j) => j.committed)
    const drafts    = visible.filter((j) => !j.committed)

    committed.sort((a, b) => {
      let cmp = 0
      if (sort.field === 'company') cmp = a.company.localeCompare(b.company)
      if (sort.field === 'date')    cmp = a.applicationDate.localeCompare(b.applicationDate)
      if (sort.field === 'status')  cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      return sort.dir === 'asc' ? cmp : -cmp
    })

    visible = [...committed, ...drafts]
  }

  return visible
}

// ── Sync badge ───────────────────────────────────────────────────────────────
function SyncBadge({ status }: { status: 'synced' | 'syncing' | null }) {
  if (!status) return <span className="font-pixel text-[9px] text-muted select-none">local only</span>
  return (
    <span className="flex items-center gap-1 select-none">
      <span className={`font-pixel text-[9px] ${status === 'syncing' ? 'animate-blink' : ''} ${status === 'synced' ? 'text-secondary' : 'text-muted'}`}>●</span>
      <span className="font-pixel text-[9px] text-muted">{status === 'synced' ? 'synced' : 'syncing'}</span>
    </span>
  )
}

// ── Scratch pad ───────────────────────────────────────────────────────────────
const SCRATCH_PAD_KEY    = 'fjobhunt:scratchpad'
const SCRATCH_LIST_KEY   = 'fjobhunt:scratchlist'
const SCRATCH_TAB_KEY    = 'fjobhunt:scratchtab'
const SCRATCH_HEIGHT_KEY = 'fjobhunt:scratchheight'
const SCRATCH_OPEN_KEY   = 'fjobhunt:scratchopen'

const SCRATCH_MIN_H = 120
const SCRATCH_MAX_H = 600
const SCRATCH_DEF_H = 220

interface CheckItem { id: string; text: string; done: boolean }

function readList(): CheckItem[] {
  try {
    const raw = localStorage.getItem(SCRATCH_LIST_KEY)
    return raw ? (JSON.parse(raw) as CheckItem[]) : []
  } catch { return [] }
}
function saveList(items: CheckItem[]) {
  try { localStorage.setItem(SCRATCH_LIST_KEY, JSON.stringify(items)) } catch { /* noop */ }
}

function ScratchPad({ userId }: { userId: string | null }) {
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(SCRATCH_OPEN_KEY) === 'true' } catch { return false }
  })
  const [tab, setTab] = useState<'pad' | 'list'>(() => {
    try { return (localStorage.getItem(SCRATCH_TAB_KEY) as 'pad' | 'list') ?? 'pad' } catch { return 'pad' }
  })
  const [height, setHeight] = useState<number>(() => {
    try { return Number(localStorage.getItem(SCRATCH_HEIGHT_KEY)) || SCRATCH_DEF_H } catch { return SCRATCH_DEF_H }
  })
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(SCRATCH_PAD_KEY) ?? '' } catch { return '' }
  })
  const [items, setItems] = useState<CheckItem[]>(readList)
  const [newItem, setNewItem] = useState('')

  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing'>('synced')
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const newItemRef    = useRef<HTMLInputElement>(null)
  const isDragging    = useRef(false)
  const saveTextTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveListTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hydrate from DB on mount
  useEffect(() => {
    if (!userId) return
    setSyncStatus('syncing')
    fetchScratchPad(userId).then((rec) => {
      if (rec) {
        if (rec.notes) {
          setText(rec.notes)
          try { localStorage.setItem(SCRATCH_PAD_KEY, rec.notes) } catch { /* noop */ }
        }
        if (rec.list) {
          try {
            const parsed = JSON.parse(rec.list) as CheckItem[]
            setItems(parsed)
            saveList(parsed)
          } catch { /* noop */ }
        }
      }
      setSyncStatus('synced')
    })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    setTimeout(() => {
      if (tab === 'pad') textareaRef.current?.focus()
      else newItemRef.current?.focus()
    }, 50)
  }, [open, tab])

  function toggleOpen() {
    setOpen((o) => {
      const next = !o
      next ? playScratchOpen() : playScratchClose()
      try { localStorage.setItem(SCRATCH_OPEN_KEY, String(next)) } catch { /* noop */ }
      return next
    })
  }

  function switchTab(t: 'pad' | 'list') {
    setTab(t)
    try { localStorage.setItem(SCRATCH_TAB_KEY, t) } catch { /* noop */ }
  }

  function persistText(val: string) {
    try { localStorage.setItem(SCRATCH_PAD_KEY, val) } catch { /* noop */ }
    if (!userId) return
    setSyncStatus('syncing')
    if (saveTextTimer.current) clearTimeout(saveTextTimer.current)
    saveTextTimer.current = setTimeout(async () => {
      await upsertScratchPad(userId, { notes: val })
      setSyncStatus('synced')
    }, 800)
  }

  function persistItems(next: CheckItem[]) {
    saveList(next)
    if (!userId) return
    setSyncStatus('syncing')
    if (saveListTimer.current) clearTimeout(saveListTimer.current)
    saveListTimer.current = setTimeout(async () => {
      await upsertScratchPad(userId, { list: JSON.stringify(next) })
      setSyncStatus('synced')
    }, 800)
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value.slice(0, SCRATCH_PAD_LIMIT)
    setText(val)
    persistText(val)
  }

  function addItem() {
    const trimmed = newItem.trim()
    if (!trimmed) return
    const next = [...items, { id: crypto.randomUUID(), text: trimmed, done: false }]
    setItems(next); persistItems(next); setNewItem('')
  }

  function toggleItem(id: string) {
    playSelectClick()
    const next = items.map((it) => it.id === id ? { ...it, done: !it.done } : it)
    setItems(next); persistItems(next)
  }

  function deleteItem(id: string) {
    const next = items.filter((it) => it.id !== id)
    setItems(next); persistItems(next)
  }

  function clearDone() {
    const next = items.filter((it) => !it.done)
    setItems(next); persistItems(next)
  }

  function clearAll() {
    setItems([]); persistItems([])
  }

  function onItemDragHandlePointerDown(e: React.PointerEvent<HTMLSpanElement>, dragId: string) {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const listEl = (e.currentTarget as HTMLElement).closest('ul')
    if (!listEl) return

    function getIdAtY(y: number): string | null {
      const lis = Array.from(listEl!.querySelectorAll<HTMLElement>('li[data-id]'))
      for (const li of lis) {
        const rect = li.getBoundingClientRect()
        if (y < rect.top + rect.height / 2) return li.dataset.id ?? null
      }
      return null // dropped at end
    }

    function onMove(ev: PointerEvent) {
      setDragOverId(getIdAtY(ev.clientY) ?? '__end__')
    }
    function onUp(ev: PointerEvent) {
      const targetId = getIdAtY(ev.clientY)
      setDragOverId(null)
      setItems((prev) => {
        if (dragId === targetId) return prev
        const next = prev.filter((it) => it.id !== dragId)
        const dragged = prev.find((it) => it.id === dragId)!
        const insertIdx = targetId === null ? next.length : next.findIndex((it) => it.id === targetId)
        next.splice(insertIdx, 0, dragged)
        persistItems(next)
        return next
      })
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Drag-to-resize: pointer capture on the handle strip
  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    isDragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const startY = e.clientY
    const startH = height

    function onMove(ev: PointerEvent) {
      const next = Math.min(SCRATCH_MAX_H, Math.max(SCRATCH_MIN_H, startH - (ev.clientY - startY)))
      setHeight(next)
    }
    function onUp(ev: PointerEvent) {
      isDragging.current = false
      const final = Math.min(SCRATCH_MAX_H, Math.max(SCRATCH_MIN_H, startH - (ev.clientY - startY)))
      try { localStorage.setItem(SCRATCH_HEIGHT_KEY, String(final)) } catch { /* noop */ }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const doneCount   = items.filter((it) => it.done).length
  const hasActivity = (!!text) || items.length > 0

  return (
    <div data-tutorial="journal" className="border-t border-border bg-bg shrink-0">
      {/* Drag handle — only visible when open */}
      {open && (
        <div
          onPointerDown={onHandlePointerDown}
          className="w-full flex items-center justify-center h-3 cursor-ns-resize hover:bg-surface/60 select-none group/handle"
          title="Drag to resize"
        >
          <span className="font-pixel text-[8px] text-muted/40 group-hover/handle:text-muted leading-none">⠿⠿⠿</span>
        </div>
      )}

      {/* Toggle bar */}
      <button
        onClick={toggleOpen}
        className="w-full flex items-center gap-2 px-4 text-muted hover:text-primary transition-none group"
        style={open ? { paddingTop: '0.5rem', paddingBottom: '0.5rem' } : { height: 119 }}
        title={open ? 'Close journal' : 'Open journal'}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1.5" y="1.5" width="9" height="9" rx="0.5" />
          <line x1="3.5" y1="4" x2="8.5" y2="4" />
          <line x1="3.5" y1="6" x2="8.5" y2="6" />
          <line x1="3.5" y1="8" x2="6.5" y2="8" />
        </svg>
        <span className="font-pixel text-[10px] select-none">JOURNAL</span>
        {hasActivity && !open && (
          <span className="font-pixel text-[8px] text-secondary ml-1 select-none">●</span>
        )}
        <span className="ml-auto font-pixel text-[10px] select-none group-hover:text-primary">
          {open ? '▼' : '▲'}
        </span>
      </button>

      {/* Drawer */}
      {open && (
        <div className="px-4 pb-3 flex flex-col gap-2 overflow-hidden" style={{ height }}>
          {/* Tabs */}
          <div className="flex items-center gap-0 border-b border-border shrink-0">
            {(['pad', 'list'] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`font-pixel text-[10px] px-3 py-1 border-b-2 -mb-px transition-none ${
                  tab === t ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-secondary'
                }`}
              >
                {t === 'pad' ? 'NOTES' : 'CHECKLIST'}
              </button>
            ))}
          </div>

          {/* Notes tab */}
          {tab === 'pad' && (
            <div className="flex flex-col gap-1.5 flex-1 min-h-0">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                placeholder="jot something down…"
                className="w-full flex-1 bg-surface border border-border text-primary font-terminal text-sm placeholder-muted outline-none focus:border-primary resize-none px-3 py-2 leading-relaxed min-h-0"
              />
              <div className="flex items-center justify-between shrink-0">
                <SyncBadge status={userId ? syncStatus : null} />
                {text && (
                  <button
                    onClick={() => { setText(''); persistText('') }}
                    className="font-pixel text-[9px] text-muted hover:text-warning transition-none"
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Checklist tab */}
          {tab === 'list' && (
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={newItemRef}
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem()}
                  placeholder="add item…"
                  className="flex-1 bg-surface border border-border text-primary font-terminal text-sm placeholder-muted outline-none focus:border-primary px-2 py-1"
                />
                <button
                  onClick={addItem}
                  disabled={!newItem.trim()}
                  className="font-pixel text-[10px] px-2 py-1 border border-border text-muted hover:border-secondary hover:text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-none"
                >
                  + ADD
                </button>
              </div>

              {items.length > 0 && (
                <ul className="flex flex-col gap-0.5 overflow-y-auto flex-1 min-h-0">
                  {items.map((it) => (
                    <li
                      key={it.id}
                      data-id={it.id}
                      className={`flex items-center gap-2 group/item py-0.5 border-t-2 transition-none ${dragOverId === it.id ? 'border-secondary' : 'border-transparent'}`}
                    >
                      {/* Drag grip */}
                      <span
                        onPointerDown={(e) => onItemDragHandlePointerDown(e, it.id)}
                        className="opacity-0 group-hover/item:opacity-40 hover:!opacity-100 font-pixel text-[9px] text-muted cursor-grab active:cursor-grabbing shrink-0 select-none"
                        title="Drag to reorder"
                      >
                        ⠿
                      </span>
                      <input
                        type="checkbox"
                        checked={it.done}
                        onChange={() => toggleItem(it.id)}
                        className="accent-secondary cursor-pointer shrink-0"
                      />
                      <span className={`font-terminal text-sm flex-1 leading-snug ${it.done ? 'line-through text-muted' : 'text-primary'}`}>
                        {it.text}
                      </span>
                      <button
                        onClick={() => deleteItem(it.id)}
                        className="opacity-0 group-hover/item:opacity-100 font-pixel text-[9px] text-muted hover:text-warning transition-none shrink-0"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center justify-between shrink-0">
                <span className="flex items-center gap-2">
                  <SyncBadge status={userId ? syncStatus : null} />
                  {items.length > 0 && <span className="font-pixel text-[9px] text-muted">{doneCount} / {items.length} done</span>}
                </span>
                <div className="flex items-center gap-3">
                  {doneCount > 0 && (
                    <button onClick={clearDone} className="font-pixel text-[9px] text-muted hover:text-warning transition-none">
                      CLEAR DONE
                    </button>
                  )}
                  {items.length > 0 && (
                    <button onClick={clearAll} className="font-pixel text-[9px] text-muted hover:text-warning transition-none">
                      CLEAR ALL
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── First-app-of-the-day messages ────────────────────────────────────────────
const MORNING_MESSAGES = [
  (name: string) => `you've got this, ${name}.`,
  (name: string) => `ready when you are, ${name}.`,
  (name: string) => `your next offer starts here, ${name}.`,
  (name: string) => `let's land something great, ${name}.`,
  (name: string) => `rooting for you today, ${name}.`,
  (name: string) => `one application at a time, ${name}.`,
]

function getDailyMessage(name: string): string {
  const day = new Date().getDate()
  const fn = MORNING_MESSAGES[day % MORNING_MESSAGES.length]
  return fn(name)
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function JobLogPage({ userId, userName }: { userId: string | null; userName: string | null }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [jobs, setJobs] = useState<Job[]>(() => {
    const cached = userId ? readCache(userId) : []
    return [emptyJob(), ...cached]
  })
  const [popups, setPopups] = useState<XpPopup[]>([])
  const [search, setSearch] = useState('')
  const [hidden, setHidden] = useState<Set<JobStatus>>(new Set())
  const [sort, setSort] = useState<SortState | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const saved = localStorage.getItem(TIME_RANGE_KEY)
    return (saved as TimeRange | null) ?? 'today'
  })
  const [page, setPage] = useState(1)
  const [deleteMode, setDeleteMode] = useState(false)
  const [detailJobId, setDetailJobId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showTutorial, setShowTutorial] = useState(false)
  const [colConfig, setColConfig] = useState<ColConfig[]>(readColConfig)
  const [colMenu, setColMenu] = useState<{ x: number; y: number; key: string } | null>(null)

  const [dragColKey, setDragColKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const isResizingRef = useRef(false)
  const PAGE_SIZE = 30
  const popupCounter = useRef(0)
  const committedCountRef = useRef(0)
  const rowHandlesRef = useRef<Map<string, JobRowHandle>>(new Map())
  const pendingFocusIdRef = useRef<string | null>(null)
  const updateTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const lastCheckedIdxRef = useRef<number | null>(null)

  // Auto-focus newly created draft rows
  useEffect(() => {
    if (pendingFocusIdRef.current) {
      rowHandlesRef.current.get(pendingFocusIdRef.current)?.focusFirstInput()
      pendingFocusIdRef.current = null
    }
  }, [jobs])

  // Mount: seed from cache already done in useState; hydrate from DB in background
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function init() {
      // Set initial committedCount from whatever the cache seeded
      committedCountRef.current = jobs.filter((j) => j.committed).length

      // Hydrate from DB in background
      let dbJobs = await fetchJobs(userId!)
      if (cancelled) return

      // Auto-ghost stale entries (no-op if setting is disabled)
      dbJobs = await runAutoGhost(dbJobs)
      if (cancelled) return

      setJobs((prev) => {
        const draft = prev.find((j) => !j.committed) ?? emptyJob()
        const merged = dbJobs.length > 0 ? [draft, ...dbJobs] : prev
        return merged
      })
      writeCache(userId!, dbJobs)
      committedCountRef.current = dbJobs.length
    }

    init()
    return () => { cancelled = true }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup: cancel pending debounced update timers on unmount
  useEffect(() => {
    return () => {
      updateTimers.current.forEach((t) => clearTimeout(t))
      updateTimers.current.clear()
    }
  }, [])

  function spawnPopup(mega: boolean, x: number, y: number, label?: string) {
    const id = ++popupCounter.current
    setPopups((prev) => [...prev, { id, mega, x, y, label }])
    setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== id)), 1400)
  }

  function handleDraftChange(draft: Job) {
    // Notify WorkdayBar that the user is actively working on a job row
    window.dispatchEvent(new Event('fjobhunt:job-input'))

    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === draft.id)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = draft
      // Write cache immediately for edits to committed rows
      if (draft.committed && userId) writeCache(userId, next)
      return next
    })

    // Debounced DB update for committed rows only
    if (draft.committed && userId) {
      const existing = updateTimers.current.get(draft.id)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => {
        updateTimers.current.delete(draft.id)
        updateJob(draft)
      }, 500)
      updateTimers.current.set(draft.id, timer)
    }
  }

  function handleCommit(committed: Job, rowEl: HTMLTableRowElement | null) {
    if (committedCountRef.current >= JOB_CAP) {
      const rect = rowEl?.getBoundingClientRect()
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
      spawnPopup(false, x, y, `✕ ${JOB_CAP} APP LIMIT — export or delete old entries`)
      return
    }
    committedCountRef.current += 1
    const mega = committedCountRef.current % 10 === 0
    const rect = rowEl?.getBoundingClientRect()
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    playThud(mega)
    spawnPopup(mega, x, y)

    const newJob = emptyJob()
    // Eagerly mark as committed + saving before the DB insert resolves
    const savingRow: Job = { ...committed, committed: true, saving: true }

    setJobs((prev) => {
      // Remove the committed draft, put a fresh draft at index 0, insert committed job at index 1
      const without = prev.filter((j) => j.id !== committed.id)
      const next = [newJob, savingRow, ...without.filter((j) => j.committed)]
      pendingFocusIdRef.current = newJob.id
      if (userId) writeCache(userId, next)
      return next
    })

    if (userId) {
      insertJob(savingRow, userId).then(() => {
        // Flip spinner → checkmark regardless of error (silent failure per spec)
        setJobs((prev) => prev.map((j) => j.id === committed.id ? { ...j, saving: false } : j))
      })
    }
  }

  const committedCount = jobs.filter((j) => j.committed).length
  const todayStr = (() => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-') })()
  const todayCount = jobs.filter((j) => j.committed && j.applicationDate === todayStr).length

  function handleTimeRange(r: TimeRange) {
    setTimeRange(r)
    localStorage.setItem(TIME_RANGE_KEY, r)
  }

  const cutoff = getTimeRangeCutoff(timeRange)
  const rangeJobs = jobs.filter((j) => {
    if (!j.committed) return true
    if (cutoff === null) return true
    if (timeRange === 'today') return j.applicationDate === cutoff
    return j.applicationDate >= cutoff
  })
  const filteredJobs = applyFilters(rangeJobs, search, hidden, sort)

  // Reset to page 1 whenever filters/sort/search change
  const filterKey = `${search}|${[...hidden].sort().join(',')}|${sort?.field ?? ''}|${sort?.dir ?? ''}|${timeRange}`
  useEffect(() => { setPage(1) }, [filterKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Broadcast tutorial open/close to NavBar button
  useEffect(() => { broadcastTutorialActive(showTutorial) }, [showTutorial])

  // Open tutorial immediately if navigated here with ?tutorial=1
  useEffect(() => {
    if (searchParams.get('tutorial') === '1') {
      setShowTutorial(true)
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Tutorial: register re-trigger bus + auto-show for first-time visitors
  useEffect(() => {
    registerTutorialTrigger(() => setShowTutorial(true))
    const seen = (() => { try { return localStorage.getItem(TUTORIAL_SEEN_KEY) === 'true' } catch { return false } })()
    if (!seen) {
      const id = setTimeout(() => setShowTutorial(true), 800)
      return () => { clearTimeout(id); unregisterTutorialTrigger() }
    }
    return () => { unregisterTutorialTrigger() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const committedFiltered = filteredJobs.filter((j) => j.committed)
  const drafts            = filteredJobs.filter((j) => !j.committed)
  const totalPages        = Math.max(1, Math.ceil(committedFiltered.length / PAGE_SIZE))
  const safePage          = Math.min(page, totalPages)
  const pagedCommitted    = committedFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  // Draft pinned at top of page 1 only
  const visibleJobs       = safePage === 1 ? [...drafts, ...pagedCommitted] : pagedCommitted

  function toggleHide(status: JobStatus) {
    setHidden((prev) => {
      const next = new Set(prev)
      next.has(status) ? next.delete(status) : next.add(status)
      return next
    })
  }

  function toggleDeleteMode() {
    setDeleteMode((prev) => {
      if (!prev) playDeleteBump()
      return !prev
    })
    setSelected(new Set())
  }

  async function handleDelete() {
    const ids = [...selected]
    playTrash(ids.length)
    await deleteJobs(ids)
    setJobs((prev) => {
      const next = prev.filter((j) => !selected.has(j.id))
      if (userId) writeCache(userId, next.filter((j) => j.committed))
      return next
    })
    committedCountRef.current = Math.max(0, committedCountRef.current - ids.length)
    setSelected(new Set())
    setDeleteMode(false)
  }

  function cycleSort(field: SortField) {
    setSort((prev) => {
      if (!prev || prev.field !== field) return { field, dir: 'asc' }
      if (prev.dir === 'asc') return { field, dir: 'desc' }
      return null
    })
  }

  function sortIndicator(field: SortField) {
    if (!sort || sort.field !== field) return null
    return sort.dir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className="h-full bg-bg font-pixel text-primary scanlines flex flex-col overflow-hidden">
      {/* XP popups */}
      {popups.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none fixed z-[9998] select-none font-pixel"
          style={{
            left: p.x,
            top: p.y,
            fontSize: p.mega ? '0.875rem' : '0.75rem',
            color: p.label ? '#ff4444' : p.mega ? 'var(--color-secondary)' : 'var(--color-primary)',
            animation: `${p.mega ? 'xp-pop-mega 1.3s' : 'xp-pop 1.0s'} ease-out forwards`,
          }}
        >
          {p.label ?? (p.mega ? `✦ +${XP.ADD_JOB * 2} XP ✦` : `+${XP.ADD_JOB} XP`)}
        </div>
      ))}

      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm tracking-widest">JOBS</h1>
          <p className="text-muted text-xs mt-1">
            {todayCount === 0 && userName
              ? getDailyMessage(userName)
              : `${todayCount} application${todayCount !== 1 ? 's' : ''} tracked today`}
          </p>
        </div>
        <button
          onClick={() => navigate('/story')}
          className="cursor-pointer hover:opacity-80 transition-opacity"
          title="View Story Map"
        >
          <XpTracker xp={committedCount * XP.ADD_JOB} />
        </button>
      </div>

      {/* Filter / sort toolbar */}
      <div className="px-4 py-2 border-b border-border flex flex-col gap-y-2">
        {/* Row 1: search + sort + hide + delete */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Search */}
        <div className="flex items-center gap-1.5 min-w-[160px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search…"
            className="bg-transparent outline-none border-b border-border focus:border-primary text-xs text-primary placeholder-muted font-pixel py-0.5 w-full"
          />
          {search && (
            <button tabIndex={-1} onClick={() => setSearch('')} className="text-muted hover:text-primary text-[10px] leading-none">✕</button>
          )}
        </div>

        {/* Sort buttons */}
        <div className="flex items-center gap-1">
          <span className="text-muted text-[10px] mr-1 select-none">SORT</span>
          {(['company', 'date', 'status'] as SortField[]).map((f) => (
            <button
              key={f}
              onClick={() => cycleSort(f)}
              className={`text-[10px] px-2 py-0.5 border transition-none ${
                sort?.field === f
                  ? 'border-primary text-primary'
                  : 'border-border text-muted hover:border-secondary hover:text-secondary'
              }`}
            >
              {f.toUpperCase()}{sortIndicator(f)}
            </button>
          ))}
        </div>

        {/* Hide toggles */}
        <div className="flex items-center gap-1">
          <span className="text-muted text-[10px] mr-1 select-none">HIDE</span>
          {HIDE_OPTIONS.map(({ status, label }) => (
            <button
              key={status}
              onClick={() => toggleHide(status)}
              className={`text-[10px] px-2 py-0.5 border transition-none ${
                hidden.has(status)
                  ? 'border-primary text-primary'
                  : 'border-border text-muted hover:border-secondary hover:text-secondary'
              }`}
            >
              {hidden.has(status) ? '✕ ' : ''}{label}
            </button>
          ))}
        </div>

        {/* Delete mode */}
        <div className="flex items-center gap-1 ml-auto">
          {deleteMode && selected.size > 0 && (
            <button
              onClick={handleDelete}
              className="text-[10px] px-2 py-0.5 border border-warning text-warning hover:border-secondary hover:text-secondary transition-none"
            >
              DELETE {selected.size} JOB{selected.size !== 1 ? 'S' : ''}
            </button>
          )}
          <button
            onClick={toggleDeleteMode}
            className={`text-[10px] px-2 py-0.5 border transition-none flex items-center gap-1 ${
              deleteMode
                ? 'border-warning text-warning hover:border-secondary hover:text-secondary'
                : 'border-border text-muted hover:border-secondary hover:text-secondary'
            }`}
            title={deleteMode ? 'Cancel' : 'Delete mode'}
          >
            {deleteMode ? 'X' : <Trash width={12} height={12} />}
          </button>
        </div>
        </div>{/* end row 1 */}

        {/* Row 2: time range */}
        <div className="flex items-center gap-1">
          <span className="text-muted text-[10px] mr-1 select-none">RANGE</span>
          {TIME_RANGE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleTimeRange(value)}
              className={`text-[10px] px-2 py-0.5 border transition-none ${
                timeRange === value
                  ? 'border-primary text-primary'
                  : 'border-border text-muted hover:border-secondary hover:text-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>{/* end toolbar */}

      {/* Table */}
      <div data-tutorial="job-rows" className="overflow-auto flex-1">
        {/* Column context menu */}
        {colMenu && (() => {
          const visibleCols = colConfig.filter((c) => c.visible)
          const visIdx = visibleCols.findIndex((c) => c.key === colMenu.key)
          return (
            <ColContextMenu
              x={colMenu.x}
              y={colMenu.y}
              isFirst={visIdx === 0}
              isLast={visIdx === visibleCols.length - 1}
              onClose={() => setColMenu(null)}
              onMoveLeft={() => {
                setColConfig((prev) => {
                  const next = [...prev]
                  const allIdx = next.findIndex((c) => c.key === colMenu.key)
                  // Find the closest visible col to the left in the full array
                  let swapIdx = -1
                  for (let i = allIdx - 1; i >= 0; i--) {
                    if (next[i].visible) { swapIdx = i; break }
                  }
                  if (swapIdx === -1) return prev
                  ;[next[swapIdx], next[allIdx]] = [next[allIdx], next[swapIdx]]
                  writeColConfig(next)
                  return next
                })
              }}
              onMoveRight={() => {
                setColConfig((prev) => {
                  const next = [...prev]
                  const allIdx = next.findIndex((c) => c.key === colMenu.key)
                  let swapIdx = -1
                  for (let i = allIdx + 1; i < next.length; i++) {
                    if (next[i].visible) { swapIdx = i; break }
                  }
                  if (swapIdx === -1) return prev
                  ;[next[allIdx], next[swapIdx]] = [next[swapIdx], next[allIdx]]
                  writeColConfig(next)
                  return next
                })
              }}
              onHide={() => {
                setColConfig((prev) => {
                  const next = prev.map((c) => c.key === colMenu.key ? { ...c, visible: false } : c)
                  writeColConfig(next)
                  return next
                })
              }}
              allCols={colConfig}
              onToggleCol={(key) => {
                setColConfig((prev) => {
                  const next = prev.map((c) => c.key === key ? { ...c, visible: !c.visible } : c)
                  writeColConfig(next)
                  return next
                })
              }}
              onReset={() => {
                writeColConfig(DEFAULT_COLS)
                setColConfig(DEFAULT_COLS)
              }}
            />
          )
        })()}

        <table className="border-collapse text-xs" style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
          <colgroup>
            {deleteMode && <col style={{ width: 24 }} />}
            <col style={{ width: 28 }} />
            {colConfig.filter((c) => c.visible).map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
            <col style={{ width: 32 }} />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-primary text-left select-none">
              {deleteMode && <th className="px-2 py-2" />}
              <th className="px-2 py-2 w-6" />
              {colConfig.filter((c) => c.visible).map((col) => (
                <th
                  key={col.key}
                  draggable
                  onDragStart={(e) => {
                    if (isResizingRef.current) { e.preventDefault(); return }
                    setDragColKey(col.key)
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', col.key)
                  }}
                  onDragEnd={() => { setDragColKey(null); setDragOverKey(null) }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverKey(col.key) }}
                  onDragLeave={() => setDragOverKey(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    const fromKey = e.dataTransfer.getData('text/plain')
                    if (!fromKey || fromKey === col.key) { setDragOverKey(null); return }
                    setColConfig((prev) => {
                      const next = [...prev]
                      const fromIdx = next.findIndex((c) => c.key === fromKey)
                      const toIdx   = next.findIndex((c) => c.key === col.key)
                      if (fromIdx === -1 || toIdx === -1) return prev
                      const [moved] = next.splice(fromIdx, 1)
                      next.splice(toIdx, 0, moved)
                      writeColConfig(next)
                      return next
                    })
                    setDragOverKey(null)
                  }}
                  onContextMenu={(e) => { e.preventDefault(); setColMenu({ x: e.clientX, y: e.clientY, key: col.key }) }}
                  className={`px-2 py-2 font-normal whitespace-nowrap cursor-grab active:cursor-grabbing select-none hover:text-secondary group transition-colors relative ${
                    dragOverKey === col.key ? 'text-secondary border-l-2 border-secondary' : dragColKey === col.key ? 'opacity-40 text-muted' : 'text-muted'
                  }`}
                  title="Drag to reorder · Right-click for options"
                >
                  {COL_DEFS[col.key].label}
                  <span className="ml-1 opacity-0 group-hover:opacity-40 text-[8px]">⠿</span>
                  {/* Resize handle — uses pointer capture so it wins over the th's drag */}
                  <span
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize opacity-0 group-hover:opacity-100 flex items-center justify-center select-none z-10"
                    style={{ touchAction: 'none' }}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      isResizingRef.current = true
                      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                      const startX = e.clientX
                      const startW = col.width
                      function onMove(ev: PointerEvent) {
                        const newW = Math.max(40, startW + ev.clientX - startX)
                        setColConfig((prev) => prev.map((c) => c.key === col.key ? { ...c, width: newW } : c))
                      }
                      function onUp() {
                        isResizingRef.current = false
                        window.removeEventListener('pointermove', onMove)
                        window.removeEventListener('pointerup', onUp)
                        setColConfig((prev) => { writeColConfig(prev); return prev })
                      }
                      window.addEventListener('pointermove', onMove)
                      window.addEventListener('pointerup', onUp)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    title="Drag to resize"
                  >
                    <span className="text-muted/60 text-[8px] leading-none pointer-events-none">│</span>
                  </span>
                </th>
              ))}
              {/* Commit-hint col */}
              <th className="px-2 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {visibleJobs.map((job, idx) => {
              const visibleCols = colConfig.filter((c) => c.visible)
              function handleTabOut() {
                const next = visibleJobs.slice(idx + 1).find((j) => !j.committed)
                const lastUncommitted = [...visibleJobs].reverse().find((j) => !j.committed)
                const targetId = next?.id ?? lastUncommitted?.id ?? null
                if (targetId) rowHandlesRef.current.get(targetId)?.focusFirstInput()
              }
              return (
                <JobRow
                  key={job.id}
                  ref={(handle) => {
                    if (handle) rowHandlesRef.current.set(job.id, handle)
                    else rowHandlesRef.current.delete(job.id)
                  }}
                  job={job}
                  visibleCols={visibleCols}
                  onCommit={handleCommit}
                  onDraftChange={handleDraftChange}
                  onTabOut={handleTabOut}
                  deleteMode={deleteMode}
                  checked={selected.has(job.id)}
                  onOpenDetail={job.committed ? () => setDetailJobId(job.id) : undefined}
                  onDetailBlur={(j) => {
                    if (!j.committed) return
                    updateJobDetails(j.id, {
                      description: j.description ?? null,
                      contacts:    j.contacts    ?? null,
                      notes:       j.notes       ?? null,
                    })
                  }}
                  onToggle={(id, e) => {
                    playSelectClick()
                    const committedVisible = visibleJobs.filter((j) => j.committed)
                    const clickedIdx = committedVisible.findIndex((j) => j.id === id)
                    if (e.shiftKey && lastCheckedIdxRef.current !== null) {
                      const lo = Math.min(lastCheckedIdxRef.current, clickedIdx)
                      const hi = Math.max(lastCheckedIdxRef.current, clickedIdx)
                      const rangeIds = committedVisible.slice(lo, hi + 1).map((j) => j.id)
                      setSelected((prev) => {
                        const next = new Set(prev)
                        rangeIds.forEach((rid) => next.add(rid))
                        return next
                      })
                    } else {
                      setSelected((prev) => {
                        const next = new Set(prev)
                        next.has(id) ? next.delete(id) : next.add(id)
                        return next
                      })
                      lastCheckedIdxRef.current = clickedIdx
                    }
                  }}
                />
              )
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="px-4 py-3 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="text-[10px] px-2 py-0.5 border border-border text-muted hover:border-secondary hover:text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-none"
          >
            ← PREV
          </button>
          <span className="text-muted text-[10px]">
            {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="text-[10px] px-2 py-0.5 border border-border text-muted hover:border-secondary hover:text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-none"
          >
            NEXT →
          </button>
          <span className="text-muted text-[10px] ml-2">
            {committedCount} total applications
          </span>
        </div>
      </div>

      {/* Application detail card */}
      {detailJobId && (
        <AppDetailCard
          jobs={jobs.filter((j) => j.committed)}
          jobId={detailJobId}
          onClose={() => setDetailJobId(null)}
          onChange={handleDraftChange}
        />
      )}

      {/* Tutorial overlay */}
      {showTutorial && <TutorialOverlay onDone={() => setShowTutorial(false)} />}

      {/* Scratch pad drawer */}
      <ScratchPad userId={userId} />

    </div>
  )
}
