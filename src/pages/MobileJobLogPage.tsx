import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Job, JobStatus } from '@/types'
import {
  readCache, writeCache, fetchJobs, insertJob, updateJob, deleteJobs,
  runAutoGhost, JOB_CAP,
} from '@/services/jobService'
import AppDetailCard from '@/components/AppDetailCard'
import MobileJobList, { type SortState, type TimeRange } from '@/components/MobileJobList'
import TutorialOverlay, { TUTORIAL_SEEN_KEY } from '@/components/TutorialOverlay'
import { registerTutorialTrigger, unregisterTutorialTrigger, broadcastTutorialActive } from '@/lib/tutorialBus'

// ── Shared helpers (mirrors JobLogPage, not exported from there) ──────────────
type SortField = 'company' | 'date' | 'status'

function emptyJob(): Job {
  return {
    id: crypto.randomUUID(),
    company: '',
    title: '',
    status: 'APPLIED',
    postingUrl: '',
    applicationDate: (() => {
      const d = new Date()
      return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
    })(),
    rating: 0,
    salary: '',
    committed: true,
    saving: false,
  }
}

const STATUS_ORDER: Record<JobStatus, number> = {
  OFFER: 0, INTERVIEW: 1, PHONE_SCREEN: 2, APPLIED: 3, WITHDRAWN: 4, REJECTED: 5, GHOSTED: 6,
}

function applyFilters(jobs: Job[], search: string, hidden: Set<JobStatus>, sort: SortState | null): Job[] {
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
  const [jobs, setJobs] = useState<Job[]>(() => userId ? readCache(userId) : [])
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

  // Quick-add overlay state
  const [addOpen, setAddOpen] = useState(false)
  const [newCompany, setNewCompany] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const updateTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Cleanup timers on unmount
  useEffect(() => {
    return () => { updateTimers.current.forEach((t) => clearTimeout(t)); updateTimers.current.clear() }
  }, [])

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
    const seen = (() => { try { return localStorage.getItem(TUTORIAL_SEEN_KEY) === 'true' } catch { return false } })()
    if (!seen) {
      const id = setTimeout(() => setShowTutorial(true), 800)
      return () => { clearTimeout(id); unregisterTutorialTrigger() }
    }
    return () => { unregisterTutorialTrigger() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load from cache then hydrate from DB
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchJobs(userId).then(async (dbJobs) => {
      if (cancelled) return
      const ghosted = await runAutoGhost(dbJobs)
      if (cancelled) return
      setJobs(ghosted)
      writeCache(userId, ghosted)
    })
    return () => { cancelled = true }
  }, [userId])

  // Scroll body lock when quick-add overlay is open
  useEffect(() => {
    if (addOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [addOpen])

  function handleJobChange(updated: Job) {
    setJobs((prev) => prev.map((j) => j.id === updated.id ? updated : j))
    if (userId) {
      const existing = updateTimers.current.get(updated.id)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => {
        updateTimers.current.delete(updated.id)
        updateJob(updated)
      }, 500)
      updateTimers.current.set(updated.id, timer)
    }
  }

  async function handleAdd() {
    if (!newCompany.trim() || !userId || adding) return
    setAdding(true)
    setAddError(null)
    const job: Job = { ...emptyJob(), company: newCompany.trim(), title: newTitle.trim() }
    const { error } = await insertJob(job, userId)
    if (error) {
      setAddError(error === 'job_cap_reached' ? `Job cap reached (${JOB_CAP})` : error)
      setAdding(false)
      return
    }
    setJobs((prev) => {
      const next = [job, ...prev]
      writeCache(userId, next)
      return next
    })
    setNewCompany('')
    setNewTitle('')
    setAddOpen(false)
    setAdding(false)
    // Open detail card so the user can fill in description/contacts/notes
    setDetailJobId(job.id)
  }

  async function handleDeleteJob(id: string) {
    await deleteJobs([id])
    setJobs((prev) => {
      const next = prev.filter((j) => j.id !== id)
      if (userId) writeCache(userId, next)
      return next
    })
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

  // Filter/sort/paginate
  const cutoff = getTimeRangeCutoff(timeRange)
  const rangeJobs = jobs.filter((j) => {
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

      {/* FAB — log new application */}
      <button
        onClick={() => { setAddOpen(true); setAddError(null) }}
        className="fixed bottom-[100px] right-4 z-[180] w-12 h-12 bg-primary text-bg font-pixel text-2xl flex items-center justify-center border-2 border-bg"
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
          onClose={() => setDetailJobId(null)}
          onChange={handleJobChange}
          fullScreen
        />
      )}

      {/* Tutorial overlay */}
      {showTutorial && (
        <TutorialOverlay onDone={() => setShowTutorial(false)} mobileMode />
      )}
    </div>
  )
}
