import { useState } from 'react'
import type { Job, JobStatus } from '@/types'

type SortField = 'company' | 'date' | 'status'
type SortDir   = 'asc' | 'desc'
export interface SortState { field: SortField; dir: SortDir }

export type TimeRange = 'today' | '7d' | '30d' | 'year' | 'all'

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'TODAY'    },
  { value: '7d',    label: 'LAST 7D'  },
  { value: '30d',   label: 'LAST 30D' },
  { value: 'year',  label: 'YEAR'     },
  { value: 'all',   label: 'ALL TIME' },
]

const HIDE_OPTIONS: { status: JobStatus; label: string }[] = [
  { status: 'GHOSTED',   label: 'GHOSTED'   },
  { status: 'REJECTED',  label: 'REJECTED'  },
  { status: 'WITHDRAWN', label: 'WITHDRAWN' },
]

const SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: 'company', label: 'COMPANY' },
  { field: 'date',    label: 'DATE'    },
  { field: 'status',  label: 'STATUS'  },
]

const STATUS_COLORS: Record<JobStatus, string> = {
  APPLIED:      'text-dim      border-dim',
  PHONE_SCREEN: 'text-secondary border-secondary',
  INTERVIEW:    'text-secondary border-secondary',
  OFFER:        'text-secondary border-secondary',
  REJECTED:     'text-warning   border-warning',
  GHOSTED:      'text-warning   border-warning',
  WITHDRAWN:    'text-warning   border-warning',
}

const STATUS_LABELS: Record<JobStatus, string> = {
  APPLIED:      'APPLIED',
  PHONE_SCREEN: 'PHONE',
  INTERVIEW:    'INTERVIEW',
  OFFER:        'OFFER',
  REJECTED:     'REJECTED',
  GHOSTED:      'GHOSTED',
  WITHDRAWN:    'WITHDRAWN',
}

function formatDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  return `${parts[1]}/${parts[2]}`
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-secondary text-[10px] shrink-0 select-none">
      {'★'.repeat(rating)}{'☆'.repeat(Math.max(0, 5 - rating))}
    </span>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────
function MobileJobRow({
  job,
  onOpenDetail,
  onDeleteJob,
}: {
  job: Job
  onOpenDetail: (id: string) => void
  onDeleteJob: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="relative border-b border-border">
      {/* Tap target */}
      <button
        className="w-full text-left px-4 py-3 active:bg-surface flex flex-col gap-1"
        onClick={() => { if (!menuOpen) onOpenDetail(job.id) }}
      >
        {/* Line 1: company + status badge */}
        <div className="flex items-center justify-between gap-2 pr-6">
          <span className="font-pixel text-[10px] text-primary truncate">{job.company || '—'}</span>
          <span className={`font-pixel text-[8px] px-1.5 py-0.5 border shrink-0 ${STATUS_COLORS[job.status]}`}>
            {STATUS_LABELS[job.status]}
          </span>
        </div>
        {/* Line 2: title + date + stars */}
        <div className="flex items-center gap-3">
          <span className="font-terminal text-sm text-muted truncate flex-1">
            {job.title || 'No title'}
          </span>
          <span className="font-pixel text-[9px] text-muted shrink-0">{formatDate(job.applicationDate)}</span>
          {job.rating > 0 && <Stars rating={job.rating} />}
        </div>
      </button>

      {/* 3-dot menu button */}
      <button
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted hover:text-primary font-pixel text-base"
        onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
        title="Options"
      >
        ⋮
      </button>

      {/* Inline menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-[10]" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-2 top-10 z-[20] bg-surface border border-border min-w-[100px]">
            <button
              className="block w-full text-left px-3 py-2 font-pixel text-[10px] text-warning hover:bg-border"
              onClick={() => { setMenuOpen(false); onDeleteJob(job.id) }}
            >
              ✕ DELETE
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Filter sheet ──────────────────────────────────────────────────────────────
function FilterSheet({
  sort,
  onSort,
  hidden,
  onToggleHide,
  timeRange,
  onTimeRange,
  onClose,
}: {
  sort: SortState | null
  onSort: (f: SortField) => void
  hidden: Set<JobStatus>
  onToggleHide: (s: JobStatus) => void
  timeRange: TimeRange
  onTimeRange: (r: TimeRange) => void
  onClose: () => void
}) {
  const sectionLabel = 'font-pixel text-[9px] text-muted tracking-widest mb-2'
  const btnBase = 'font-pixel text-[9px] px-3 py-2 border transition-none'
  const btnActive = `${btnBase} border-primary text-primary`
  const btnIdle = `${btnBase} border-border text-muted`

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[189]" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[190] bg-surface border-t border-border flex flex-col max-h-[70vh]">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Sort */}
          <div>
            <p className={sectionLabel}>SORT BY</p>
            <div className="flex gap-2 flex-wrap">
              {SORT_FIELDS.map(({ field, label }) => (
                <button
                  key={field}
                  onClick={() => onSort(field)}
                  className={sort?.field === field ? btnActive : btnIdle}
                >
                  {label}{sort?.field === field ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div>
            <p className={sectionLabel}>TIME RANGE</p>
            <div className="flex gap-2 flex-wrap">
              {TIME_RANGE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => onTimeRange(value)}
                  className={timeRange === value ? btnActive : btnIdle}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Hide statuses */}
          <div>
            <p className={sectionLabel}>HIDE</p>
            <div className="flex gap-2 flex-wrap">
              {HIDE_OPTIONS.map(({ status, label }) => (
                <button
                  key={status}
                  onClick={() => onToggleHide(status)}
                  className={hidden.has(status) ? btnActive : btnIdle}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Close */}
        <div className="px-5 py-3 border-t border-border">
          <button onClick={onClose} className="w-full font-pixel text-[10px] py-2 border border-border text-muted">
            DONE
          </button>
        </div>
      </div>
    </>
  )
}

// ── MobileJobList ─────────────────────────────────────────────────────────────
export interface MobileJobListProps {
  jobs: Job[]
  search: string
  onSearchChange: (s: string) => void
  sort: SortState | null
  onSort: (f: SortField) => void
  hidden: Set<JobStatus>
  onToggleHide: (s: JobStatus) => void
  timeRange: TimeRange
  onTimeRange: (r: TimeRange) => void
  onOpenDetail: (id: string) => void
  onDeleteJob: (id: string) => void
  page: number
  totalPages: number
  onPageChange: (p: number) => void
  totalCount: number
}

export default function MobileJobList({
  jobs,
  search,
  onSearchChange,
  sort,
  onSort,
  hidden,
  onToggleHide,
  timeRange,
  onTimeRange,
  onOpenDetail,
  onDeleteJob,
  page,
  totalPages,
  onPageChange,
  totalCount,
}: MobileJobListProps) {
  const [filterOpen, setFilterOpen] = useState(false)
  const activeFilterCount = (sort ? 1 : 0) + hidden.size + (timeRange !== 'today' ? 1 : 0)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Search + filter bar */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 shrink-0">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="SEARCH..."
          className="flex-1 bg-transparent outline-none font-pixel text-[10px] text-primary placeholder-muted border-b border-border py-1"
          style={{ fontSize: '16px' }}
        />
        <button
          onClick={() => setFilterOpen(true)}
          className={`font-pixel text-[9px] px-2 py-1 border shrink-0 transition-none ${activeFilterCount > 0 ? 'border-secondary text-secondary' : 'border-border text-muted'}`}
        >
          FILTER{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {/* Count line */}
      <div className="px-4 py-1.5 shrink-0">
        <span className="font-pixel text-[9px] text-muted">{totalCount} APPLICATIONS</span>
      </div>

      {/* Job rows */}
      <div className="flex-1 overflow-y-auto">
        {jobs.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <span className="font-pixel text-[10px] text-muted">NO ENTRIES</span>
          </div>
        ) : (
          jobs.map((job) => (
            <MobileJobRow
              key={job.id}
              job={job}
              onOpenDetail={onOpenDetail}
              onDeleteJob={onDeleteJob}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-2 border-t border-border shrink-0">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="font-pixel text-[10px] px-3 py-1 border border-border text-muted disabled:opacity-30"
          >
            ←
          </button>
          <span className="font-pixel text-[10px] text-muted">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="font-pixel text-[10px] px-3 py-1 border border-border text-muted disabled:opacity-30"
          >
            →
          </button>
        </div>
      )}

      {/* Filter sheet */}
      {filterOpen && (
        <FilterSheet
          sort={sort}
          onSort={onSort}
          hidden={hidden}
          onToggleHide={onToggleHide}
          timeRange={timeRange}
          onTimeRange={onTimeRange}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  )
}
