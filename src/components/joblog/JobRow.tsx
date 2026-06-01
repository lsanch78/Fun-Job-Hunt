import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { playProgressChime, playCelebrationFanfare } from '@/lib/sfx'
import { Terminal } from 'pixelarticons/react'
import type { Job, JobStatus } from '@/types'
import { JOB_LIMITS } from '@/services/jobService'
import type { ColConfig } from './types'

export interface JobRowHandle {
  focusFirstInput(): void
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
        aria-label="Application status"
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
          aria-hidden="true"
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

// ── JobRow ───────────────────────────────────────────────────────────────────
export const JobRow = forwardRef<JobRowHandle, {
  job: Job
  visibleCols: ColConfig[]
  onCommit: (committed: Job, rowEl: HTMLTableRowElement | null) => void
  onDraftChange: (draft: Job) => void
  onTabOut?: () => void
  deleteMode?: boolean
  checked?: boolean
  onToggle?: (id: string, e: React.MouseEvent<HTMLInputElement>) => void
  onOpenDetail?: () => void
  onOpenDetailPage2?: () => void
  onDetailBlur?: (job: Job) => void
}>(function JobRow({ job, visibleCols, onCommit, onDraftChange, onTabOut, deleteMode, checked, onToggle, onOpenDetail, onOpenDetailPage2, onDetailBlur }, ref) {
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
      setDraft((prev) => ({ ...prev, description: job.description, notes: job.notes }))
    }
  }, [job.description, job.notes, job.committed])

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
        return <DetailCell key="jd" value={draft.description} placeholder="Description" onChange={(v) => update('description', v)} onBlur={() => onDetailBlur?.(draft)} onOpenDetail={committed ? (onOpenDetailPage2 ?? onOpenDetail) : undefined} isNewRow={!committed} />
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
          aria-label={committed ? 'View application details' : 'Application not yet logged'}
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
