import { useState, useEffect, useRef } from 'react'
import type { Job } from '@/types'
import { fetchJobDetails, updateJobDetails, JOB_LIMITS } from '@/services/jobService'
import { playBootBlip, playExitBlip, startTerminalHum, playConsoleBlip, playSaveBlip } from '@/lib/sfx'

// ── Boot animation — injected once ───────────────────────────────────────────
const BOOT_STYLE = `
@keyframes console-boot {
  0%   { opacity: 0; transform: scaleY(0.04) scaleX(0.98); filter: brightness(4); }
  40%  { opacity: 1; transform: scaleY(1.08) scaleX(1);    filter: brightness(1.2); }
  60%  { opacity: 1; transform: scaleY(0.97) scaleX(1);    filter: brightness(1); }
  80%  { opacity: 1; transform: scaleY(1.01) scaleX(1);    filter: brightness(1); }
  100% { opacity: 1; transform: scaleY(1)    scaleX(1);    filter: brightness(1); }
}
@keyframes crt-flicker {
  0%   { filter: brightness(1)    opacity(1); }
  18%  { filter: brightness(1)    opacity(1); }
  19%  { filter: brightness(0.94) opacity(0.97); }
  20%  { filter: brightness(1)    opacity(1); }
  45%  { filter: brightness(1)    opacity(1); }
  46%  { filter: brightness(0.97) opacity(0.98); }
  47%  { filter: brightness(1.02) opacity(1); }
  48%  { filter: brightness(1)    opacity(1); }
  72%  { filter: brightness(1)    opacity(1); }
  73%  { filter: brightness(0.96) opacity(0.98); }
  74%  { filter: brightness(1)    opacity(1); }
  100% { filter: brightness(1)    opacity(1); }
}
.crt-card {
  position: relative;
  overflow: hidden;
}
/* CRT glass highlight — convex bulge reflection */
.crt-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 38%, rgba(57,255,20,0.04) 0%, rgba(255,255,255,0.015) 35%, transparent 65%);
  pointer-events: none;
  z-index: 10;
  border-radius: inherit;
}
/* Scanlines */
.crt-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.08) 2px,
    rgba(0,0,0,0.08) 4px
  );
  pointer-events: none;
  z-index: 11;
  border-radius: inherit;
}
`
if (typeof document !== 'undefined' && !document.getElementById('console-boot-keyframes')) {
  const el = document.createElement('style')
  el.id = 'console-boot-keyframes'
  el.textContent = BOOT_STYLE
  document.head.appendChild(el)
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface AppDetailCardProps {
  jobs: Job[]
  jobId: string
  onClose: () => void
  onChange: (updated: Job) => void
  fullScreen?: boolean
}

// Terminal palette — fixed regardless of app theme
const T = {
  green:     '#39ff14',
  greenDim:  '#23a80d',
  border:    '#2a2a2a',
  borderHi:  '#39ff14',
}

// ── Field components ──────────────────────────────────────────────────────────
const labelClass = 'text-[13px] tracking-widest uppercase mb-1 select-none'
const inputClass = 'bg-transparent outline-none text-lg w-full px-1 py-0.5 leading-tight border-b'
const textareaClass = `${inputClass} resize-none`

// ── AppDetailCard ─────────────────────────────────────────────────────────────
export default function AppDetailCard({ jobs, jobId, onClose, onChange, fullScreen = false }: AppDetailCardProps) {
  const currentIdx = jobs.findIndex((j) => j.id === jobId)
  const [localIdx, setLocalIdx] = useState(currentIdx === -1 ? 0 : currentIdx)
  const [page, setPage] = useState<1 | 2>(1)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const loadedIds = useRef<Set<string>>(new Set())
  const cardRef = useRef<HTMLDivElement>(null)

  const job = jobs[localIdx] ?? jobs[0]

  function handleClose() {
    playExitBlip()
    onClose()
  }

  // Boot blip + terminal hum on mount
  useEffect(() => {
    playBootBlip()
    const stopHum = startTerminalHum()
    return stopHum
  }, [])

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Reset to page 1 when navigating jobs
  useEffect(() => {
    setPage(1)
  }, [localIdx])

  // Lazy-load detail fields when a job is focused for the first time
  useEffect(() => {
    if (!job || loadedIds.current.has(job.id)) return
    // Skip if all detail fields are already populated (e.g. previously saved in session)
    if (job.description !== undefined && job.contacts !== undefined && job.notes !== undefined) {
      loadedIds.current.add(job.id)
      return
    }
    setDetailsLoading(true)
    fetchJobDetails(job.id).then((details) => {
      setDetailsLoading(false)
      if (!details) return
      loadedIds.current.add(job.id)
      onChange({
        ...job,
        description: details.description ?? '',
        contacts:    details.contacts ?? '',
        notes:       details.notes ?? '',
      })
    })
  }, [job?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset save state when navigating to a different job
  useEffect(() => {
    setSaveState('idle')
  }, [localIdx])

  function goJob(dir: -1 | 1) {
    playConsoleBlip(dir === 1 ? 'forward' : 'back')
    setLocalIdx((prev) => Math.max(0, Math.min(jobs.length - 1, prev + dir)))
  }

  function goPage(dir: -1 | 1) {
    const next = page + dir
    if (next === 1 || next === 2) {
      playConsoleBlip(dir === 1 ? 'forward' : 'back')
      setPage(next as 1 | 2)
    }
  }

  function update<K extends keyof Job>(key: K, val: Job[K]) {
    if (!job) return
    onChange({ ...job, [key]: val })
  }

  async function handleSave() {
    if (!job || saveState === 'saving') return
    setSaveState('saving')
    setSaveError(null)
    const { error } = await updateJobDetails(job.id, {
      description: job.description ?? null,
      contacts:    job.contacts ?? null,
      notes:       job.notes ?? null,
    })
    if (error) {
      setSaveError(error)
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 2000)
    } else {
      playSaveBlip()
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1500)
    }
  }

  if (!job) return null

  const hasPrevJob = localIdx > 0
  const hasNextJob = localIdx < jobs.length - 1

  if (fullScreen) {
    return (
      <div className="crt-card fixed inset-0 z-[200] flex flex-col" style={{
        animation: 'console-boot 0.35s ease-out forwards, crt-flicker 8s steps(1, end) 0.35s infinite',
        fontFamily: '"VT323", monospace',
        background: '#000',
        border: '1px solid #2a2a2a',
        color: '#39ff14',
        textShadow: '0 0 4px rgba(57,255,20,0.25)',
        boxShadow: '0 0 8px 1px rgba(57,255,20,0.35), inset 0 0 10px 2px rgba(57,255,20,0.06)',
      }}>
        {/* ── Top bar ── */}
        <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
          <button onClick={() => goJob(-1)} disabled={!hasPrevJob} className="disabled:opacity-20 disabled:cursor-not-allowed leading-none px-1 text-base" style={{ color: T.greenDim }} title="Previous application">◀</button>
          <span className="text-base tracking-wide truncate flex-1 text-center leading-tight" style={{ color: T.green }}>
            {job.company || '—'}
            {job.title ? <span style={{ color: T.greenDim }}> — {job.title}</span> : null}
          </span>
          <button onClick={() => goJob(1)} disabled={!hasNextJob} className="disabled:opacity-20 disabled:cursor-not-allowed leading-none px-1 text-base" style={{ color: T.greenDim }} title="Next application">▶</button>
          <span className="text-[13px] ml-2 select-none flex-shrink-0" style={{ color: T.greenDim }}>{page} / 2</span>
          <button onClick={handleClose} className="w-10 h-10 text-lg flex items-center justify-center ml-1 flex-shrink-0 hover:opacity-60" style={{ color: T.greenDim }} title="Close (Esc)">✕</button>
        </div>
        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {page === 1 ? (
            <>
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Company</div>
                <input className={inputClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: '16px' }} value={job.company} maxLength={JOB_LIMITS.company} onChange={(e) => update('company', e.target.value)} placeholder="Company name" />
              </div>
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Job Title</div>
                <input className={inputClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: '16px' }} value={job.title} maxLength={JOB_LIMITS.title} onChange={(e) => update('title', e.target.value)} placeholder="Role / position" />
              </div>
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Job Description</div>
                <textarea className={textareaClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: '16px' }} rows={4} maxLength={JOB_LIMITS.description} value={job.description ?? ''} onChange={(e) => update('description', e.target.value)} placeholder="Paste or summarize the job description…" />
              </div>
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Contacts</div>
                <textarea className={textareaClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: '16px' }} rows={3} maxLength={JOB_LIMITS.contacts} value={job.contacts ?? ''} onChange={(e) => update('contacts', e.target.value)} placeholder="Recruiter, hiring manager, referral…" />
              </div>
            </>
          ) : (
            <>
              <div className="text-sm tracking-wide pb-2 select-none" style={{ color: T.greenDim, borderBottom: `1px solid ${T.border}` }}>
                {job.company || '—'}{job.title ? ` — ${job.title}` : ''}
              </div>
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Notes</div>
                <textarea className={textareaClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: '16px' }} rows={14} maxLength={JOB_LIMITS.notes} value={job.notes ?? ''} onChange={(e) => update('notes', e.target.value)} placeholder={['Interview rounds…', 'Culture impressions…', 'Source / how you found it…', 'Resume version used…', 'Anything else…'].join('\n')} />
              </div>
            </>
          )}
        </div>
        {/* ── Page nav ── */}
        <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderTop: `1px solid ${T.border}` }}>
          <button onClick={() => goPage(-1)} disabled={page === 1} className="text-[15px] px-3 py-1.5 disabled:opacity-30 disabled:cursor-not-allowed transition-none hover:opacity-70" style={{ color: T.greenDim, border: `1px solid ${T.border}` }}>← PREV</button>
          <button onClick={handleSave} disabled={saveState === 'saving' || detailsLoading} className="text-[15px] px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-none hover:opacity-80" style={{ color: saveState === 'saved' ? T.green : saveState === 'error' ? '#ff4444' : T.greenDim, border: `1px solid ${saveState === 'saved' ? T.green : saveState === 'error' ? '#ff4444' : T.border}` }} title={saveState === 'error' && saveError ? saveError : 'Save detail fields to database'}>
            {saveState === 'saving' ? '…' : saveState === 'saved' ? '✓ SAVED' : saveState === 'error' ? '✕ ERR' : 'SAVE'}
          </button>
          <button onClick={() => goPage(1)} disabled={page === 2} className="text-[15px] px-3 py-1.5 disabled:opacity-30 disabled:cursor-not-allowed transition-none hover:opacity-70" style={{ color: T.greenDim, border: `1px solid ${T.border}` }}>NEXT →</button>
        </div>
      </div>
    )
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
      style={{ perspective: '1200px' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      {/* Card */}
      <div
        ref={cardRef}
        className="crt-card flex flex-col w-[650px] max-w-[90vw] max-h-[85vh]"
        style={{
          animation: 'console-boot 0.35s ease-out forwards, crt-flicker 8s steps(1, end) 0.35s infinite',
          fontFamily: '"VT323", monospace',
          background: '#000',
          border: '1px solid #2a2a2a',
          color: '#39ff14',
          borderRadius: '12px',
          textShadow: '0 0 4px rgba(57,255,20,0.25)',
          // Subtle 3D warp: card bows outward slightly like a convex CRT screen
          transform: 'rotateX(2deg) rotateY(0deg)',
          transformStyle: 'preserve-3d',
          boxShadow: [
            // tight outer ring to separate from backdrop
            '0 0 0 1px #111',
            // phosphor border glow
            '0 0 8px 1px rgba(57,255,20,0.35)',
            '0 0 28px 4px rgba(57,255,20,0.15)',
            // heavy inset vignette — corners dark, center bright, sells the bulge
            'inset 0 0 60px 30px rgba(0,0,0,0.70)',
            'inset 0 0 10px 2px rgba(57,255,20,0.06)',
          ].join(', '),
        }}
      >
        {/* ── Top bar ── */}
        <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
          {/* Job prev/next */}
          <button
            onClick={() => goJob(-1)}
            disabled={!hasPrevJob}
            className="disabled:opacity-20 disabled:cursor-not-allowed leading-none px-1 text-base"
            style={{ color: T.greenDim }}
            title="Previous application"
          >
            ◀
          </button>

          {/* Title */}
          <span className="text-base tracking-wide truncate flex-1 text-center leading-tight" style={{ color: T.green }}>
            {job.company || '—'}
            {job.title ? <span style={{ color: T.greenDim }}> — {job.title}</span> : null}
          </span>

          <button
            onClick={() => goJob(1)}
            disabled={!hasNextJob}
            className="disabled:opacity-20 disabled:cursor-not-allowed leading-none px-1 text-base"
            style={{ color: T.greenDim }}
            title="Next application"
          >
            ▶
          </button>

          {/* Page indicator */}
          <span className="text-[13px] ml-2 select-none flex-shrink-0" style={{ color: T.greenDim }}>
            {page} / 2
          </span>

          {/* Close */}
          <button
            onClick={handleClose}
            className="text-base ml-2 leading-none flex-shrink-0 hover:opacity-60"
            style={{ color: T.greenDim }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {page === 1 ? (
            <>
              {/* Company */}
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Company</div>
                <input
                  className={inputClass}
                  style={{ color: T.green, borderColor: T.border, caretColor: T.green }}
                  value={job.company}
                  maxLength={JOB_LIMITS.company}
                  onChange={(e) => update('company', e.target.value)}
                  placeholder="Company name"
                />
              </div>

              {/* Title */}
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Job Title</div>
                <input
                  className={inputClass}
                  style={{ color: T.green, borderColor: T.border, caretColor: T.green }}
                  value={job.title}
                  maxLength={JOB_LIMITS.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="Role / position"
                />
              </div>

              {/* Description */}
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Job Description</div>
                <textarea
                  className={textareaClass}
                  style={{ color: T.green, borderColor: T.border, caretColor: T.green }}
                  rows={4}
                  maxLength={JOB_LIMITS.description}
                  value={job.description ?? ''}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Paste or summarize the job description…"
                />
              </div>

              {/* Contacts */}
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Contacts</div>
                <textarea
                  className={textareaClass}
                  style={{ color: T.green, borderColor: T.border, caretColor: T.green }}
                  rows={3}
                  maxLength={JOB_LIMITS.contacts}
                  value={job.contacts ?? ''}
                  onChange={(e) => update('contacts', e.target.value)}
                  placeholder="Recruiter, hiring manager, referral…"
                />
              </div>
            </>
          ) : (
            <>
              {/* Context header */}
              <div className="text-sm tracking-wide pb-2 select-none" style={{ color: T.greenDim, borderBottom: `1px solid ${T.border}` }}>
                {job.company || '—'}
                {job.title ? ` — ${job.title}` : ''}
              </div>

              {/* Notes */}
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Notes</div>
                <textarea
                  className={textareaClass}
                  style={{ color: T.green, borderColor: T.border, caretColor: T.green }}
                  rows={14}
                  maxLength={JOB_LIMITS.notes}
                  value={job.notes ?? ''}
                  onChange={(e) => update('notes', e.target.value)}
                  placeholder={[
                    'Interview rounds…',
                    'Culture impressions…',
                    'Source / how you found it…',
                    'Resume version used…',
                    'Anything else…',
                  ].join('\n')}
                />
              </div>
            </>
          )}
        </div>

        {/* ── Page nav ── */}
        <div className="px-4 py-2 flex items-center justify-between flex-shrink-0" style={{ borderTop: `1px solid ${T.border}` }}>
          <button
            onClick={() => goPage(-1)}
            disabled={page === 1}
            className="text-[15px] px-2 py-0.5 disabled:opacity-30 disabled:cursor-not-allowed transition-none hover:opacity-70"
            style={{ color: T.greenDim, border: `1px solid ${T.border}` }}
          >
            ← PREV
          </button>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saveState === 'saving' || detailsLoading}
            className="text-[15px] px-3 py-0.5 disabled:opacity-40 disabled:cursor-not-allowed transition-none hover:opacity-80"
            style={{
              color:  saveState === 'saved' ? T.green : saveState === 'error' ? '#ff4444' : T.greenDim,
              border: `1px solid ${saveState === 'saved' ? T.green : saveState === 'error' ? '#ff4444' : T.border}`,
            }}
            title={saveState === 'error' && saveError ? saveError : 'Save detail fields to database'}
          >
            {saveState === 'saving' ? '…' : saveState === 'saved' ? '✓ SAVED' : saveState === 'error' ? '✕ ERR' : 'SAVE'}
          </button>

          <button
            onClick={() => goPage(1)}
            disabled={page === 2}
            className="text-[15px] px-2 py-0.5 disabled:opacity-30 disabled:cursor-not-allowed transition-none hover:opacity-70"
            style={{ color: T.greenDim, border: `1px solid ${T.border}` }}
          >
            NEXT →
          </button>
        </div>
      </div>
    </div>
  )
}
