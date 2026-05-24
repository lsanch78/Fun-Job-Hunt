import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { XP, RANK_THRESHOLDS, RANK_TITLES } from '@/config/game'
import type { Job, JobStatus } from '@/types'
import { readCache, writeCache, fetchJobs, insertJob, updateJob, runAutoGhost } from '@/services/jobService'
import { supabase } from '@/lib/supabase'

interface JobRowHandle {
  focusCompanyInput(): void
}

function emptyJob(): Job {
  return {
    id: crypto.randomUUID(),
    company: '',
    title: '',
    status: 'APPLIED',
    postingUrl: '',
    applicationDate: new Date().toISOString().slice(0, 10),
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

// ── XP helpers ───────────────────────────────────────────────────────────────
function getRankInfo(xp: number) {
  let rank = 1
  for (let i = 1; i < RANK_THRESHOLDS.length; i++) {
    if (xp >= RANK_THRESHOLDS[i]) rank = i
    else break
  }
  const isMax = rank >= RANK_THRESHOLDS.length - 1
  const currentFloor = RANK_THRESHOLDS[rank]
  const nextFloor = isMax ? currentFloor : RANK_THRESHOLDS[rank + 1]
  const progress = isMax ? 1 : (xp - currentFloor) / (nextFloor - currentFloor)
  return { rank, title: RANK_TITLES[rank] ?? '', progress, xp, nextFloor, isMax }
}

// ── Sound: level-up chime ─────────────────────────────────────────────────────
function playLevelUp() {
  try {
    const ctx = new AudioContext()
    // C5 → E5 → G5 → C6
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.18
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.09, t + 0.04)   // soft attack
      gain.gain.setValueAtTime(0.09, t + 0.18)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55) // long tail
      osc.start(t)
      osc.stop(t + 0.55)
    })
  } catch { /* AudioContext blocked */ }
}

// ── XpTracker ─────────────────────────────────────────────────────────────────
function XpTracker({ xp }: { xp: number }) {
  const { rank, title, progress, nextFloor, isMax } = getRankInfo(xp)
  const barPct = Math.round(progress * 100)
  const prevRankRef = useRef(rank)

  useEffect(() => {
    if (rank > prevRankRef.current) playLevelUp()
    prevRankRef.current = rank
  }, [rank])

  const avatarChars = ['◉', '◈', '◆', '▣', '★', '✦', '⬡', '⬟', '◉', '✸', '✺']
  const avatarChar = avatarChars[(rank - 1) % avatarChars.length]

  return (
    <div className="flex items-center gap-3 border border-border px-4 py-2.5 bg-surface">
      {/* Avatar */}
      <div className="text-2xl leading-none text-secondary select-none" title={`Rank ${rank}`}>
        {avatarChar}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 w-[200px]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-secondary text-[11px] tracking-widest uppercase leading-none">
            LVL {rank}
          </span>
          <span className="text-muted text-[9px] leading-none">
            {isMax ? 'MAX' : `${xp} / ${nextFloor} XP`}
          </span>
        </div>
        <div className="text-primary text-[9px] leading-tight">
          {title}
        </div>
        {/* XP bar */}
        <div className="w-full h-1.5 bg-border">
          <div
            className="h-full bg-secondary transition-all duration-500"
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Sound ───────────────────────────────────────────────────────────────────
function playThud(mega = false) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    if (mega) {
      osc.type = 'square'
      osc.frequency.setValueAtTime(220, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18)
      gain.gain.setValueAtTime(0.18, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
    } else {
      osc.type = 'square'
      osc.frequency.setValueAtTime(180, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.12)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.15)
    }
  } catch { /* AudioContext blocked */ }
}

// ── XP popup ────────────────────────────────────────────────────────────────
interface XpPopup { id: number; mega: boolean; x: number; y: number }

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
function StarRating({ value, onChange, onTabOut, onEnter }: {
  value: number
  onChange: (n: number) => void
  onTabOut?: () => void
  onEnter?: () => void
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

  return (
    <div className="flex flex-col gap-0">
      <span
        className="flex gap-0.5 whitespace-nowrap outline-none focus:border-b focus:border-primary"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
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
      {isFocused && (
        <span className="text-muted text-[9px] leading-none mt-0.5 font-pixel select-none">
          1-5/0
        </span>
      )}
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
  onCommit: (committed: Job, rowEl: HTMLTableRowElement | null) => void
  onDraftChange: (draft: Job) => void
  onTabOut?: () => void
}>(function JobRow({ job, onCommit, onDraftChange, onTabOut }, ref) {
  const [draft, setDraft] = useState<Job>(job)
  const [focused, setFocused] = useState(false)
  const rowRef = useRef<HTMLTableRowElement>(null)
  const companyInputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    focusCompanyInput() {
      companyInputRef.current?.focus()
    },
  }))

  useEffect(() => {
    if (!job.committed) setDraft(job)
  }, [job.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function update<K extends keyof Job>(key: K, val: Job[K]) {
    const next = { ...draft, [key]: val }
    setDraft(next)
    onDraftChange(next)
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

  return (
    <tr
      ref={rowRef}
      className={rowClass}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      {/* Company */}
      <td className="px-2 py-1 min-w-[120px]">
        <input
          ref={companyInputRef}
          className={cellInput}
          placeholder="Company"
          value={draft.company}
          onChange={(e) => update('company', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && tryCommit()}
        />
      </td>

      {/* Title */}
      <td className="px-2 py-1 min-w-[140px]">
        <input
          className={cellInput}
          placeholder="Job title"
          value={draft.title}
          onChange={(e) => update('title', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && tryCommit()}
        />
      </td>

      {/* Posting */}
      <PostingCell
        value={draft.postingUrl}
        onChange={(v) => update('postingUrl', v)}
        onEnter={tryCommit}
      />

      {/* Salary */}
      <SalaryCell value={draft.salary} onChange={(v) => update('salary', v)} onEnter={tryCommit} />

      {/* Rating */}
      <td className="px-2 py-1 min-w-[90px]">
        <StarRating value={draft.rating} onChange={(n) => update('rating', n)} onTabOut={onTabOut} onEnter={tryCommit} />
      </td>

      {/* Date — outside tab flow, mouse-only */}
      <DateCell value={draft.applicationDate} onChange={(v) => update('applicationDate', v)} />

      {/* Status — mouse-only */}
      <StatusCell
        status={draft.status}
        onStatusChange={(s) => update('status', s)}
      />

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

// ── Filter / sort types ───────────────────────────────────────────────────────
type SortField = 'company' | 'date' | 'status'
type SortDir   = 'asc' | 'desc'
interface SortState { field: SortField; dir: SortDir }

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

// ── Page ─────────────────────────────────────────────────────────────────────
export default function JobLogPage() {
  const [jobs, setJobs] = useState<Job[]>([emptyJob()])
  const [popups, setPopups] = useState<XpPopup[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [hidden, setHidden] = useState<Set<JobStatus>>(new Set())
  const [sort, setSort] = useState<SortState | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 100
  const popupCounter = useRef(0)
  const committedCountRef = useRef(0)
  const rowHandlesRef = useRef<Map<string, JobRowHandle>>(new Map())
  const pendingFocusIdRef = useRef<string | null>(null)
  const updateTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Auto-focus newly created draft rows
  useEffect(() => {
    if (pendingFocusIdRef.current) {
      rowHandlesRef.current.get(pendingFocusIdRef.current)?.focusCompanyInput()
      pendingFocusIdRef.current = null
    }
  }, [jobs])

  // Mount: load cache → render, then hydrate from DB in background
  useEffect(() => {
    let cancelled = false

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return

      const uid = user.id
      setUserId(uid)

      // 1. Render from cache immediately
      const cached = readCache(uid)
      if (cached.length > 0) {
        setJobs((prev) => {
          const draft = prev.find((j) => !j.committed) ?? emptyJob()
          return [...cached, draft]
        })
        committedCountRef.current = cached.length
      }

      // 2. Hydrate from DB in background
      let dbJobs = await fetchJobs(uid)
      if (cancelled) return

      // 3. Auto-ghost stale entries (no-op if setting is disabled)
      dbJobs = await runAutoGhost(dbJobs)
      if (cancelled) return

      setJobs((prev) => {
        const drafts = prev.filter((j) => !j.committed)
        const merged = dbJobs.length > 0 ? [...dbJobs, ...drafts] : prev
        const hasDraft = merged.some((j) => !j.committed)
        return hasDraft ? merged : [...merged, emptyJob()]
      })
      writeCache(uid, dbJobs)
      committedCountRef.current = dbJobs.length
    }

    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup: cancel pending debounced update timers on unmount
  useEffect(() => {
    return () => {
      updateTimers.current.forEach((t) => clearTimeout(t))
      updateTimers.current.clear()
    }
  }, [])

  function spawnPopup(mega: boolean, x: number, y: number) {
    const id = ++popupCounter.current
    setPopups((prev) => [...prev, { id, mega, x, y }])
    setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== id)), 1400)
  }

  function handleDraftChange(draft: Job) {
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
      const idx = prev.findIndex((j) => j.id === committed.id)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = savingRow
      const needsNewRow = idx === prev.length - 1 || !prev.slice(idx + 1).some((j) => !j.committed)
      if (needsNewRow) {
        next.push(newJob)
        pendingFocusIdRef.current = newJob.id
      } else {
        const nextUncommitted = next.slice(idx + 1).find((j) => !j.committed)
        if (nextUncommitted) pendingFocusIdRef.current = nextUncommitted.id
      }
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
  const filteredJobs = applyFilters(jobs, search, hidden, sort)

  // Reset to page 1 whenever filters/sort/search change
  const filterKey = `${search}|${[...hidden].sort().join(',')}|${sort?.field ?? ''}|${sort?.dir ?? ''}`
  useEffect(() => { setPage(1) }, [filterKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const committedFiltered = filteredJobs.filter((j) => j.committed)
  const drafts            = filteredJobs.filter((j) => !j.committed)
  const totalPages        = Math.max(1, Math.ceil(committedFiltered.length / PAGE_SIZE))
  const safePage          = Math.min(page, totalPages)
  const pagedCommitted    = committedFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  // Drafts always appear on the last page
  const visibleJobs       = safePage === totalPages ? [...pagedCommitted, ...drafts] : pagedCommitted

  function toggleHide(status: JobStatus) {
    setHidden((prev) => {
      const next = new Set(prev)
      next.has(status) ? next.delete(status) : next.add(status)
      return next
    })
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
    <div className="min-h-screen bg-bg font-pixel text-primary scanlines">
      {/* XP popups */}
      {popups.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none fixed z-[9998] select-none font-pixel"
          style={{
            left: p.x,
            top: p.y,
            fontSize: p.mega ? '0.875rem' : '0.75rem',
            color: p.mega ? 'var(--color-secondary)' : 'var(--color-primary)',
            animation: `${p.mega ? 'xp-pop-mega 1.3s' : 'xp-pop 1.0s'} ease-out forwards`,
          }}
        >
          {p.mega ? `✦ +${XP.ADD_JOB * 2} XP ✦` : `+${XP.ADD_JOB} XP`}
        </div>
      ))}

      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm tracking-widest">JOBS</h1>
          <p className="text-muted text-xs mt-1">{committedCount} applications tracked</p>
        </div>
        <XpTracker xp={committedCount * XP.ADD_JOB} />
      </div>

      {/* Filter / sort toolbar */}
      <div className="px-4 py-2 border-b border-border flex flex-wrap items-center gap-x-4 gap-y-2">
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
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-primary text-left select-none cursor-default">
              {[
                { label: 'COMPANY', muted: false },
                { label: 'TITLE',   muted: false },
                { label: 'URL',     muted: true  },
                { label: 'SALARY',  muted: true  },
                { label: 'RATING',  muted: true  },
                { label: 'DATE',    muted: true  },
                { label: 'STATUS',  muted: true  },
                { label: '',        muted: true  },
              ].map(({ label, muted }) => (
                <th key={label} className={`px-2 py-2 font-normal whitespace-nowrap ${muted ? 'text-muted' : ''}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleJobs.map((job, idx) => {
              function handleTabOut() {
                const next = visibleJobs.slice(idx + 1).find((j) => !j.committed)
                const lastUncommitted = [...visibleJobs].reverse().find((j) => !j.committed)
                const targetId = next?.id ?? lastUncommitted?.id ?? null
                if (targetId) rowHandlesRef.current.get(targetId)?.focusCompanyInput()
              }
              return (
                <JobRow
                  key={job.id}
                  ref={(handle) => {
                    if (handle) rowHandlesRef.current.set(job.id, handle)
                    else rowHandlesRef.current.delete(job.id)
                  }}
                  job={job}
                  onCommit={handleCommit}
                  onDraftChange={handleDraftChange}
                  onTabOut={handleTabOut}
                />
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-border flex items-center gap-3">
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
            {committedFiltered.length} results
          </span>
        </div>
      )}
    </div>
  )
}
