import { useState, useRef, useEffect } from 'react'
import { playThud, playDeleteBump, playSelectClick, playTrash } from '@/lib/sfx'
import { Trash } from 'pixelarticons/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { XP } from '@/config/game'
import XpTracker from '@/components/XpTracker'
import { useXp } from '@/services/xpService'
import type { Job, JobStatus } from '@/types'
import { JOB_CAP } from '@/services/jobService'
import { useJobList } from '@/hooks/useJobList'
import AppDetailCard from '@/components/AppDetailCard'
import TutorialOverlay from '@/components/TutorialOverlay'
import { JOB_LOG_STEPS } from '@/lib/tutorialSteps'
import { registerTutorialTrigger, unregisterTutorialTrigger, broadcastTutorialActive } from '@/lib/tutorialBus'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import { JobRow, type JobRowHandle } from '@/components/joblog/JobRow'
import { useColumns } from '@/components/joblog/useColumns'
import { ColumnHeader } from '@/components/joblog/ColumnHeader'
import { ColumnContextMenu } from '@/components/joblog/ColumnContextMenu'

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

  const { xp, bumpXp } = useXp(userId)

  // ── Job list state — all mutations go through the hook ──────────────────────
  const {
    jobs,
    committedCount,
    onDraftChange,
    onCommit,
    updateJobDetails,
    deleteJobs,
    pendingFocusIdRef,
  } = useJobList(userId, bumpXp)

  // ── UI-only state (rendering concerns, not job-list state) ──────────────────
  const [popups, setPopups] = useState<XpPopup[]>([])
  const [search, setSearch] = useState('')
  const [hidden, setHidden] = useState<Set<JobStatus>>(new Set())
  const [sort, setSort] = useState<SortState | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>(() => lsGet<string>(SK.timeRange, 'today') as TimeRange)
  const [page, setPage] = useState(1)
  const [deleteMode, setDeleteMode] = useState(false)
  const [detailJobId, setDetailJobId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showTutorial, setShowTutorial] = useState(false)
  const columns = useColumns()
  const PAGE_SIZE = 30
  const popupCounter = useRef(0)
  const rowHandlesRef = useRef<Map<string, JobRowHandle>>(new Map())
  const lastCheckedIdxRef = useRef<number | null>(null)

  // Auto-focus newly created draft rows (pendingFocusIdRef is written by the hook)
  useEffect(() => {
    if (pendingFocusIdRef.current) {
      rowHandlesRef.current.get(pendingFocusIdRef.current)?.focusFirstInput()
      pendingFocusIdRef.current = null
    }
  }, [jobs]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── XP popup ─────────────────────────────────────────────────────────────────

  function spawnPopup(mega: boolean, x: number, y: number, label?: string) {
    const id = ++popupCounter.current
    setPopups((prev) => [...prev, { id, mega, x, y, label }])
    setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== id)), 1400)
  }

  // ── Draft-change handler — adds workday punch-in signal on top of hook ───────

  function handleDraftChange(draft: Job) {
    // Signal WorkdayBar that the user is actively typing in a job row.
    // This is a rendering/interaction concern; mobile intentionally omits it.
    window.dispatchEvent(new Event('fjobhunt:job-input'))
    onDraftChange(draft)
  }

  // ── Commit handler — hook owns state; page owns pixel position + sound ───────

  function handleCommit(committed: Job, rowEl: HTMLTableRowElement | null) {
    const rect = rowEl?.getBoundingClientRect()
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2

    const newCount = onCommit(committed, rowEl)

    if (newCount === null) {
      // Job cap reached — hook did nothing; show error popup
      spawnPopup(false, x, y, `✕ ${JOB_CAP} APP LIMIT — export or delete old entries`)
      return
    }

    const mega = newCount % 10 === 0
    playThud(mega)
    spawnPopup(mega, x, y)
  }

  // ── Derived display values ───────────────────────────────────────────────────

  const todayStr = (() => {
    const d = new Date()
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
  })()
  const todayCount = jobs.filter((j) => j.committed && j.applicationDate === todayStr).length

  function handleTimeRange(r: TimeRange) {
    setTimeRange(r)
    lsSet(SK.timeRange, r)
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
    if (!userId) return () => { unregisterTutorialTrigger() }
    const seen = lsGet<boolean>(SK.tutorialSeen(userId, 'job-log'), false)
    if (!seen) {
      const id = setTimeout(() => setShowTutorial(true), 800)
      return () => { clearTimeout(id); unregisterTutorialTrigger() }
    }
    return () => { unregisterTutorialTrigger() }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 min-h-[100px]">
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
          <XpTracker xp={xp} />
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
        {columns.menu && (() => {
          const { menu, visibleCols, cols } = columns
          const visIdx = visibleCols.findIndex((c) => c.key === menu.key)
          return (
            <ColumnContextMenu
              x={menu.x}
              y={menu.y}
              isFirst={visIdx === 0}
              isLast={visIdx === visibleCols.length - 1}
              activeKey={menu.key}
              allCols={cols}
              onClose={columns.closeMenu}
              onMoveLeft={() => columns.moveLeft(menu.key)}
              onMoveRight={() => columns.moveRight(menu.key)}
              onHide={() => columns.hide(menu.key)}
              onToggleCol={columns.toggleVisible}
              onReset={columns.reset}
            />
          )
        })()}

        <table className="border-collapse text-xs" style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
          <colgroup>
            {deleteMode && <col style={{ width: 24 }} />}
            <col style={{ width: 28 }} />
            {columns.visibleCols.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
            <col style={{ width: 32 }} />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-primary text-left select-none">
              {deleteMode && <th className="px-2 py-2" scope="col"><span className="sr-only">Delete</span></th>}
              <th className="px-2 py-2 w-6" scope="col"><span className="sr-only">Details</span></th>
              <ColumnHeader columns={columns} />
              {/* Commit-hint col */}
              <th className="px-2 py-2 w-8" scope="col"><span className="sr-only">Save status</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleJobs.map((job, idx) => {
              const visibleCols = columns.visibleCols
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
          userId={userId}
          onClose={() => setDetailJobId(null)}
          onChange={handleDraftChange}
        />
      )}

      {/* Tutorial overlay */}
      {showTutorial && userId && <TutorialOverlay steps={JOB_LOG_STEPS} screen="job-log" userId={userId} onDone={() => setShowTutorial(false)} />}

    </div>
  )
}
