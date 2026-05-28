import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { JobStatus } from '@/types'
import AppDetailCard from '@/components/AppDetailCard'
import MobileJobList, { type SortState, type TimeRange } from '@/components/MobileJobList'
import MobileScratchPad from '@/components/MobileScratchPad'
import TutorialOverlay, { TUTORIAL_SEEN_KEY } from '@/components/TutorialOverlay'
import { registerTutorialTrigger, unregisterTutorialTrigger, broadcastTutorialActive } from '@/lib/tutorialBus'
import { useJobList } from '@/hooks/useJobList'

// ── Shared filter helpers ─────────────────────────────────────────────────────
type SortField = 'company' | 'date' | 'status'

const STATUS_ORDER: Record<JobStatus, number> = {
  OFFER: 0, INTERVIEW: 1, PHONE_SCREEN: 2, APPLIED: 3, WITHDRAWN: 4, REJECTED: 5, GHOSTED: 6,
}

function applyFilters(jobs: import('@/types').Job[], search: string, hidden: Set<JobStatus>, sort: SortState | null): import('@/types').Job[] {
  const q = search.trim().toLowerCase()
  let visible = jobs.filter((j) => {
    if (hidden.has(j.status)) return false
    if (q && !j.company.toLowerCase().includes(q) && !j.title.toLowerCase().includes(q)) return false
    return true
  })
  if (sort) {
    visible.sort((a, b) => {
      let cmp = 0
      if (sort.field === 'company') cmp = a.company.localeCompare(b.company)
      if (sort.field === 'date')    cmp = a.applicationDate.localeCompare(b.applicationDate)
      if (sort.field === 'status')  cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }
  return visible
}

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

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MobileJobLogPage({
  userId,
}: {
  userId: string | null
  userName?: string | null
}) {
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Job list state — all mutations go through the hook ──────────────────────
  const { jobs, onDraftChange, addJob, deleteJobs } = useJobList(userId)

  // ── UI-only state ───────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)
  const [hidden, setHidden] = useState<Set<JobStatus>>(new Set())
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const saved = localStorage.getItem(TIME_RANGE_KEY)
    return (saved as TimeRange | null) ?? 'today'
  })
  const [page, setPage] = useState(1)
  const [detailJobId, setDetailJobId] = useState<string | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [showScratchPad, setShowScratchPad] = useState(false)

  // Quick-add overlay state
  const [addOpen, setAddOpen] = useState(false)
  const [newCompany, setNewCompany] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  // Broadcast tutorial active state to NavBar
  useEffect(() => { broadcastTutorialActive(showTutorial) }, [showTutorial])

  // Open tutorial if navigated here with ?tutorial=1
  useEffect(() => {
    if (searchParams.get('tutorial') === '1') {
      setShowTutorial(true)
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Register tutorial trigger + auto-show on first visit
  useEffect(() => {
    registerTutorialTrigger(() => setShowTutorial(true))
    if (!userId) return () => { unregisterTutorialTrigger() }
    const seen = (() => { try { return localStorage.getItem(TUTORIAL_SEEN_KEY(userId)) === 'true' } catch { return false } })()
    if (!seen) {
      const id = setTimeout(() => setShowTutorial(true), 800)
      return () => { clearTimeout(id); unregisterTutorialTrigger() }
    }
    return () => { unregisterTutorialTrigger() }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll body lock when quick-add overlay is open
  useEffect(() => {
    if (addOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [addOpen])

  async function handleAdd() {
    if (!newCompany.trim() || adding) return
    setAdding(true)
    setAddError(null)
    const { error } = await addJob(newCompany, newTitle)
    if (error) {
      setAddError(error)
      setAdding(false)
      return
    }
    // Find the newly added job (it's prepended to jobs by the hook) to open its detail card
    const newJobId = jobs[0]?.id ?? null
    setNewCompany('')
    setNewTitle('')
    setAddOpen(false)
    setAdding(false)
    if (newJobId) setDetailJobId(newJobId)
  }

  async function handleDeleteJob(id: string) {
    await deleteJobs([id])
  }

  function handleTimeRange(r: TimeRange) {
    setTimeRange(r)
    localStorage.setItem(TIME_RANGE_KEY, r)
  }

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

  // Filter/sort/paginate — committed jobs only on mobile (no draft row in the list)
  const committedJobs = jobs.filter((j) => j.committed)
  const cutoff = getTimeRangeCutoff(timeRange)
  const rangeJobs = committedJobs.filter((j) => {
    if (cutoff === null) return true
    if (timeRange === 'today') return j.applicationDate === cutoff
    return j.applicationDate >= cutoff
  })
  const filteredJobs = applyFilters(rangeJobs, search, hidden, sort)

  const filterKey = `${search}|${[...hidden].sort().join(',')}|${sort?.field ?? ''}|${sort?.dir ?? ''}|${timeRange}`
  useEffect(() => { setPage(1) }, [filterKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const PAGE_SIZE = 30
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedJobs = filteredJobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const detailJob = detailJobId ? jobs.find((j) => j.id === detailJobId) ?? null : null

  return (
    <div className="h-full bg-bg font-pixel text-primary flex flex-col overflow-hidden">
      <MobileJobList
        jobs={pagedJobs}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSort={cycleSort}
        hidden={hidden}
        onToggleHide={toggleHide}
        timeRange={timeRange}
        onTimeRange={handleTimeRange}
        onOpenDetail={(id) => setDetailJobId(id)}
        onDeleteJob={handleDeleteJob}
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        totalCount={filteredJobs.length}
      />

      {/* FAB — scratchpad */}
      <button
        onClick={() => setShowScratchPad(true)}
        className="fixed bottom-[124px] right-4 z-[180] w-12 h-12 bg-surface text-primary flex items-center justify-center border-2 border-primary"
        title="Open scratchpad"
        aria-label="Open scratchpad"
      >
        <svg width="20" height="20" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1.5" y="1.5" width="9" height="9" rx="0.5" />
          <line x1="3.5" y1="4" x2="8.5" y2="4" />
          <line x1="3.5" y1="6" x2="8.5" y2="6" />
          <line x1="3.5" y1="8" x2="6.5" y2="8" />
        </svg>
      </button>

      {/* FAB — log new application */}
      <button
        onClick={() => { setAddOpen(true); setAddError(null) }}
        className="fixed bottom-16 right-4 z-[180] w-12 h-12 bg-primary text-bg font-pixel text-2xl flex items-center justify-center border-2 border-bg"
        title="Log new application"
        aria-label="Add new job"
      >
        +
      </button>

      {/* Quick-add overlay */}
      {addOpen && (
        <div className="fixed inset-0 z-[190] bg-black/80 flex flex-col justify-end">
          <div className="bg-surface border-t border-border px-6 pt-5 pb-8 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[10px] tracking-widest text-primary">NEW APPLICATION</span>
              <button onClick={() => setAddOpen(false)} className="font-pixel text-xs text-muted w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-pixel text-[9px] text-muted tracking-widest">COMPANY *</label>
              <input
                autoFocus
                className="bg-transparent border-b border-border outline-none text-primary font-pixel text-xs py-2 w-full"
                style={{ fontSize: '16px' }}
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="Company name"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-pixel text-[9px] text-muted tracking-widest">JOB TITLE</label>
              <input
                className="bg-transparent border-b border-border outline-none text-primary font-pixel text-xs py-2 w-full"
                style={{ fontSize: '16px' }}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Role / position"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            {addError && (
              <span className="font-pixel text-[9px] text-warning">{addError}</span>
            )}
            <button
              onClick={handleAdd}
              disabled={!newCompany.trim() || adding}
              className="border border-primary text-primary font-pixel text-[10px] py-3 disabled:opacity-40 disabled:cursor-not-allowed mt-1"
            >
              {adding ? 'ADDING...' : '+ LOG APPLICATION'}
            </button>
          </div>
        </div>
      )}

      {/* AppDetailCard — full-screen on mobile */}
      {detailJobId && detailJob && (
        <AppDetailCard
          jobs={jobs}
          jobId={detailJobId}
          userId={userId}
          onClose={() => setDetailJobId(null)}
          onChange={onDraftChange}
          fullScreen
        />
      )}

      {/* Scratchpad overlay */}
      {showScratchPad && (
        <MobileScratchPad userId={userId} onClose={() => setShowScratchPad(false)} />
      )}

      {/* Tutorial overlay */}
      {showTutorial && userId && (
        <TutorialOverlay userId={userId} onDone={() => setShowTutorial(false)} mobileMode />
      )}
    </div>
  )
}
