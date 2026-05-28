import { useState, useEffect, useRef } from 'react'
import type { Job } from '@/types'
import { fetchJobDetails, updateJobDetails, JOB_LIMITS } from '@/services/jobService'
import { playBootBlip, playExitBlip, startTerminalHum, playConsoleBlip, playSaveBlip } from '@/lib/sfx'
import { T, labelClass, inputClass, textareaClass, ensureCrtStyles, crtTextShadow, crtBoxShadow, CRT_FONT } from '@/lib/crtTheme'

ensureCrtStyles()

// ── Types ─────────────────────────────────────────────────────────────────────
interface AppDetailCardProps {
  jobs: Job[]
  jobId: string
  onClose: () => void
  onChange: (updated: Job) => void
  fullScreen?: boolean
}

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

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { handleClose(); return }
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (e.key === 'ArrowRight') { e.preventDefault(); goPage(1) }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPage(-1) }
      if (e.key === 'ArrowUp')    { e.preventDefault(); goJob(-1) }
      if (e.key === 'ArrowDown')  { e.preventDefault(); goJob(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, page, localIdx])

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



  if (fullScreen) {
    return (
      <div className="crt-card fixed inset-0 z-[200] flex flex-col" style={{
        animation: 'console-boot 0.35s ease-out forwards, crt-flicker 8s steps(1, end) 0.35s infinite',
        fontFamily: '"VT323", monospace',
        background: '#000',
        border: '1px solid #2a2a2a',
        color: '#39ff14',
        textShadow: crtTextShadow,
        boxShadow: '0 0 8px 1px rgba(57,255,20,0.35), inset 0 0 10px 2px rgba(57,255,20,0.06)',
      }}>
        {/* ── Top bar ── */}
        <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
          <span className="tracking-wide truncate flex-1 text-center leading-tight" style={{ color: T.green, fontSize: CRT_FONT.btn }}>
            {job.company || '—'}
            {job.title ? <span style={{ color: T.greenDim }}> — {job.title}</span> : null}
            <span className="ml-2 select-none" style={{ color: T.greenDim, fontSize: CRT_FONT.chrome }}>[{localIdx + 1}/{jobs.length}]</span>
          </span>
          <button onClick={handleClose} className="w-10 h-10 flex items-center justify-center ml-1 flex-shrink-0 hover:opacity-60" style={{ color: T.greenDim, fontSize: CRT_FONT.btn }} title="Close (Esc)">✕</button>
        </div>
        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {page === 1 && (
            <div className="flex-1 flex flex-col min-h-0 gap-4">
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Company</div>
                <input className={inputClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }} value={job.company} maxLength={JOB_LIMITS.company} onChange={(e) => update('company', e.target.value)} placeholder="Company name" />
              </div>
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Job Title</div>
                <input className={inputClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }} value={job.title} maxLength={JOB_LIMITS.title} onChange={(e) => update('title', e.target.value)} placeholder="Role / position" />
              </div>
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Contacts</div>
                <textarea className={textareaClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }} rows={3} maxLength={JOB_LIMITS.contacts} value={job.contacts ?? ''} onChange={(e) => update('contacts', e.target.value)} placeholder="Recruiter, hiring manager, referral…" />
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <div className={labelClass} style={{ color: T.greenDim }}>Notes</div>
                <textarea className={textareaClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body, flex: 1, resize: 'none' }} maxLength={JOB_LIMITS.notes} value={job.notes ?? ''} onChange={(e) => update('notes', e.target.value)} placeholder={['Interview rounds…', 'Culture impressions…', 'Source / how you found it…', 'Resume version used…', 'Anything else…'].join('\n')} />
              </div>
            </div>
          )}
          {page === 2 && (
            <>
              <div className="tracking-wide pb-2 select-none" style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, borderBottom: `1px solid ${T.border}` }}>
                {job.company || '—'}{job.title ? ` — ${job.title}` : ''}
              </div>
              <div className="flex-1 flex flex-col">
                <div className={labelClass} style={{ color: T.greenDim }}>Job Description</div>
                <textarea className={textareaClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body, flex: 1 }} rows={16} maxLength={JOB_LIMITS.description} value={job.description ?? ''} onChange={(e) => update('description', e.target.value)} placeholder="Paste or summarize the job description…" />
              </div>
            </>
          )}
        </div>
        {/* ── Page nav ── */}
        <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="w-20">
            {page === 2 && <button onClick={() => goPage(-1)} className="px-3 py-1.5 transition-none hover:opacity-70" style={{ color: T.greenDim, fontSize: CRT_FONT.btn, border: `1px solid ${T.border}` }}>← FRONT</button>}
          </div>
          <button onClick={handleSave} disabled={saveState === 'saving' || detailsLoading} className="px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-none hover:opacity-80" style={{ fontSize: CRT_FONT.btn, color: saveState === 'saved' ? T.green : saveState === 'error' ? '#ff4444' : T.greenDim, border: `1px solid ${saveState === 'saved' ? T.green : saveState === 'error' ? '#ff4444' : T.border}` }} title={saveState === 'error' && saveError ? saveError : 'Save detail fields to database'}>
            {saveState === 'saving' ? '…' : saveState === 'saved' ? '✓ SAVED' : saveState === 'error' ? '✕ ERR' : 'SAVE'}
          </button>
          <div className="w-20 flex justify-end">
            {page === 1 && <button onClick={() => goPage(1)} className="px-3 py-1.5 transition-none hover:opacity-70" style={{ color: T.greenDim, fontSize: CRT_FONT.btn, border: `1px solid ${T.border}` }}>BACK →</button>}
          </div>
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
        className="crt-card flex flex-col w-[750px] max-w-[90vw]"
        style={{
          height: 'min(92vh, 780px)',
          animation: 'console-boot 0.35s ease-out forwards, crt-flicker 8s steps(1, end) 0.35s infinite',
          fontFamily: '"VT323", monospace',
          background: '#000',
          border: '1px solid #2a2a2a',
          color: '#39ff14',
          borderRadius: '12px',
          textShadow: crtTextShadow,
          transform: 'rotateX(2deg) rotateY(0deg)',
          transformStyle: 'preserve-3d',
          boxShadow: crtBoxShadow,
        }}
      >
        {/* ── Top bar ── */}
        <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
          {/* Title */}
          <span className="tracking-wide truncate flex-1 text-center leading-tight" style={{ color: T.green, fontSize: CRT_FONT.btn }}>
            {job.company || '—'}
            {job.title ? <span style={{ color: T.greenDim }}> — {job.title}</span> : null}
            <span className="ml-2 select-none" style={{ color: T.greenDim, fontSize: CRT_FONT.chrome }}>[{localIdx + 1}/{jobs.length}]</span>
          </span>

          {/* Close */}
          <button
            onClick={handleClose}
            className="ml-2 leading-none flex-shrink-0 hover:opacity-60"
            style={{ color: T.greenDim, fontSize: CRT_FONT.btn }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* ── Body — fixed height so all pages are the same size ── */}
        <div className="flex-1 flex flex-col overflow-y-auto px-4 py-4 gap-4">
          {page === 1 && (
            <div className="flex-1 flex flex-col min-h-0 gap-4">
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Company</div>
                <input className={inputClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }} value={job.company} maxLength={JOB_LIMITS.company} onChange={(e) => update('company', e.target.value)} placeholder="Company name" />
              </div>
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Job Title</div>
                <input className={inputClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }} value={job.title} maxLength={JOB_LIMITS.title} onChange={(e) => update('title', e.target.value)} placeholder="Role / position" />
              </div>
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>URL</div>
                <input className={inputClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }} value={job.postingUrl} maxLength={JOB_LIMITS.postingUrl} onChange={(e) => update('postingUrl', e.target.value)} placeholder="https://…" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className={labelClass} style={{ color: T.greenDim }}>Status</div>
                  <select
                    className="bg-transparent outline-none w-full px-1 py-0.5 leading-tight border-b appearance-none cursor-pointer"
                    style={{ color: T.green, borderColor: T.border, fontSize: CRT_FONT.body }}
                    value={job.status}
                    onChange={(e) => update('status', e.target.value as import('@/types').JobStatus)}
                  >
                    {(['APPLIED','PHONE_SCREEN','INTERVIEW','OFFER','REJECTED','GHOSTED','WITHDRAWN'] as const).map((s) => (
                      <option key={s} value={s} style={{ background: T.bg, color: T.green }}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <div className={labelClass} style={{ color: T.greenDim }}>Date Applied</div>
                  <input type="date" className={inputClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body, colorScheme: 'dark' }} value={job.applicationDate} onChange={(e) => update('applicationDate', e.target.value)} />
                </div>
              </div>
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Rating (0–5)</div>
                <div className="flex gap-2 mt-1">
                  {[0,1,2,3,4,5].map((n) => (
                    <button key={n} onClick={() => update('rating', n)} style={{ fontFamily: '"VT323", monospace', fontSize: CRT_FONT.body, color: job.rating === n ? T.bg : T.greenDim, background: job.rating === n ? T.green : 'transparent', border: `1px solid ${job.rating === n ? T.green : T.border}`, padding: '0 8px', cursor: 'pointer' }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className={labelClass} style={{ color: T.greenDim }}>Contacts</div>
                <textarea className={textareaClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }} rows={2} maxLength={JOB_LIMITS.contacts} value={job.contacts ?? ''} onChange={(e) => update('contacts', e.target.value)} placeholder="Recruiter, hiring manager, referral…" />
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <div className={labelClass} style={{ color: T.greenDim }}>Notes</div>
                <textarea className={textareaClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body, flex: 1, resize: 'none' }} maxLength={JOB_LIMITS.notes} value={job.notes ?? ''} onChange={(e) => update('notes', e.target.value)} placeholder={['Interview rounds…','Culture impressions…','Source / how you found it…','Resume version used…','Anything else…'].join('\n')} />
              </div>
            </div>
          )}

          {page === 2 && (
            <>
              <div className="tracking-wide pb-2 select-none flex-shrink-0" style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, borderBottom: `1px solid ${T.border}` }}>
                {job.company || '—'}{job.title ? ` — ${job.title}` : ''}
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <div className={labelClass} style={{ color: T.greenDim }}>Job Description</div>
                <textarea className={textareaClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body, flex: 1, resize: 'none' }} maxLength={JOB_LIMITS.description} value={job.description ?? ''} onChange={(e) => update('description', e.target.value)} placeholder="Paste or summarize the job description…" />
              </div>
            </>
          )}
        </div>

        {/* ── Page nav ── */}
        <div className="px-4 py-2 flex items-center justify-between flex-shrink-0" style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="w-20">
            {page === 2 && (
              <button onClick={() => goPage(-1)} className="px-2 py-0.5 transition-none hover:opacity-70" style={{ color: T.greenDim, fontSize: CRT_FONT.btn, border: `1px solid ${T.border}` }}>
                ← FRONT
              </button>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saveState === 'saving' || detailsLoading}
            className="px-3 py-0.5 disabled:opacity-40 disabled:cursor-not-allowed transition-none hover:opacity-80"
            style={{
              fontSize: CRT_FONT.btn,
              color:  saveState === 'saved' ? T.green : saveState === 'error' ? '#ff4444' : T.greenDim,
              border: `1px solid ${saveState === 'saved' ? T.green : saveState === 'error' ? '#ff4444' : T.border}`,
            }}
            title={saveState === 'error' && saveError ? saveError : 'Save detail fields to database'}
          >
            {saveState === 'saving' ? '…' : saveState === 'saved' ? '✓ SAVED' : saveState === 'error' ? '✕ ERR' : 'SAVE'}
          </button>

          <div className="w-20 flex justify-end">
            {page === 1 && (
              <button onClick={() => goPage(1)} className="px-2 py-0.5 transition-none hover:opacity-70" style={{ color: T.greenDim, fontSize: CRT_FONT.btn, border: `1px solid ${T.border}` }}>
                BACK →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
