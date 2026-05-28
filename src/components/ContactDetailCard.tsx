import { useState, useEffect, useRef } from 'react'
import type { Contact } from '@/types'
import { updateContact, fetchJobsForContact, fetchAllJobsForUser, linkContactToJob, unlinkContactFromJob } from '@/services/contactService'
import { playBootBlip, playExitBlip, startTerminalHum, playConsoleBlip, playSaveBlip } from '@/lib/sfx'
import { T, labelClass, inputClass, textareaClass, ensureCrtStyles, crtTextShadow, crtBoxShadow, CRT_FONT } from '@/lib/crtTheme'

ensureCrtStyles()

interface JobOption { id: string; title: string; company: string }

interface ContactDetailCardProps {
  contacts: Contact[]
  contactId: string
  onClose: () => void
  onChange: (updated: Contact) => void
  onSave?: (contact: Contact, pendingJobIds: string[]) => Promise<void>
  userId?: string | null
  lockedJob?: JobOption
  fullScreen?: boolean
}

// ── JobsPanel ─────────────────────────────────────────────────────────────────

interface JobsPanelProps {
  contactId: string
  userId?: string | null
  lockedJob?: JobOption
  onPendingChange?: (jobs: JobOption[]) => void
}

function JobsPanel({ contactId, userId, lockedJob, onPendingChange }: JobsPanelProps) {
  const [linked, setLinked] = useState<JobOption[]>([])
  const [all, setAll] = useState<JobOption[]>([])
  const [loading, setLoading] = useState(true)
  const [picking, setPicking] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const isNew = contactId.startsWith('new-')

  useEffect(() => {
    if (isNew) {
      // Pre-populate with lockedJob if coming from AppDetailCard
      const initial = lockedJob ? [lockedJob] : []
      setLinked(initial)
      onPendingChange?.(initial)
      setLoading(false)
      return
    }
    setLoading(true)
    fetchJobsForContact(contactId).then((jobs) => {
      setLinked(jobs)
      setLoading(false)
    })
  }, [contactId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (picking && userId) {
      fetchAllJobsForUser(userId).then(setAll)
      setTimeout(() => searchRef.current?.focus(), 50)
    }
    if (!picking) setSearch('')
  }, [picking, userId])

  function addLinked(job: JobOption) {
    setLinked((prev) => {
      const next = [...prev, job]
      onPendingChange?.(next)
      return next
    })
    setPicking(false)
  }

  function removeLinked(jobId: string) {
    setLinked((prev) => {
      const next = prev.filter((j) => j.id !== jobId)
      onPendingChange?.(next)
      return next
    })
  }

  async function handleLink(job: JobOption) {
    if (isNew) { addLinked(job); return }
    const { error } = await linkContactToJob(contactId, job.id)
    if (!error) addLinked(job)
  }

  async function handleUnlink(jobId: string) {
    if (isNew) { removeLinked(jobId); return }
    // lockedJob is always read-only — can't unlink from the panel it was opened from
    if (lockedJob && jobId === lockedJob.id) return
    const { error } = await unlinkContactFromJob(contactId, jobId)
    if (!error) removeLinked(jobId)
  }

  const linkedIds = new Set(linked.map((j) => j.id))
  const filtered = all.filter(
    (j) => !linkedIds.has(j.id) && (
      !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.company.toLowerCase().includes(search.toLowerCase())
    )
  )

  const panelStyle = { fontSize: CRT_FONT.body, color: T.green }
  const dimStyle   = { fontSize: CRT_FONT.sub,  color: T.greenDim }
  const btnStyle   = { fontSize: CRT_FONT.btn, color: T.greenDim, border: `1px solid ${T.border}` }

  return (
    <div className="flex flex-col gap-2">
      <div className={labelClass} style={{ color: T.greenDim }}>Linked Jobs</div>

      {loading ? (
        <span style={dimStyle}>loading…</span>
      ) : linked.length === 0 ? (
        <span style={dimStyle}>no jobs linked</span>
      ) : (
        <div className="flex flex-col gap-1">
          {linked.map((j) => {
            const isLocked = lockedJob?.id === j.id
            return (
              <div key={j.id} className="flex items-center justify-between gap-2 group">
                <span style={panelStyle} className="truncate flex-1">
                  {j.title} <span style={dimStyle}>@ {j.company}</span>
                </span>
                {!isLocked && (
                  <button
                    onClick={() => handleUnlink(j.id)}
                    className="opacity-0 group-hover:opacity-100 transition-none hover:opacity-60"
                    style={dimStyle}
                    title="Unlink job"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!picking && !lockedJob && (
        <div className="flex gap-2 mt-1">
          <button onClick={() => setPicking(true)} className="px-2 py-0.5 transition-none hover:opacity-80" style={btnStyle}>
            + LINK JOB
          </button>
        </div>
      )}

      {picking && (
        <div className="flex flex-col gap-1.5 mt-1">
          <input
            ref={searchRef}
            className={inputClass}
            style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }}
            placeholder="search jobs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-col max-h-[120px] overflow-y-auto">
            {filtered.length === 0 ? (
              <span style={dimStyle}>no matches</span>
            ) : (
              filtered.map((j) => (
                <button
                  key={j.id}
                  onClick={() => handleLink(j)}
                  className="text-left px-1 py-0.5 hover:opacity-70 transition-none flex gap-2 items-baseline"
                  style={panelStyle}
                >
                  <span>{j.title}</span>
                  <span style={dimStyle}>@ {j.company}</span>
                </button>
              ))
            )}
          </div>
          <button onClick={() => setPicking(false)} className="px-2 py-0.5 transition-none hover:opacity-80 self-start" style={btnStyle}>
            CANCEL
          </button>
        </div>
      )}
    </div>
  )
}

const LIMITS = {
  name:     100,
  company:  100,
  linkedin: 200,
  github:   100,
  twitter:  100,
  discord:  100,
  email:    200,
  notes:    1000,
} as const

export default function ContactDetailCard({
  contacts,
  contactId,
  onClose,
  onChange,
  onSave,
  userId,
  lockedJob,
  fullScreen = false,
}: ContactDetailCardProps) {
  const currentIdx = contacts.findIndex((c) => c.id === contactId)
  const [localIdx, setLocalIdx] = useState(currentIdx === -1 ? 0 : currentIdx)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [pendingJobIds, setPendingJobIds] = useState<string[]>(lockedJob ? [lockedJob.id] : [])
  const cardRef = useRef<HTMLDivElement>(null)

  const contact = contacts[localIdx] ?? contacts[0]

  function handleClose() {
    playExitBlip()
    onClose()
  }

  useEffect(() => {
    playBootBlip()
    const stopHum = startTerminalHum()
    return stopHum
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { handleClose(); return }
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (e.key === 'ArrowUp')   { e.preventDefault(); goContact(-1) }
      if (e.key === 'ArrowDown') { e.preventDefault(); goContact(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [localIdx, onClose])

  useEffect(() => {
    setSaveState('idle')
  }, [localIdx])

  function goContact(dir: -1 | 1) {
    playConsoleBlip(dir === 1 ? 'forward' : 'back')
    setLocalIdx((prev) => Math.max(0, Math.min(contacts.length - 1, prev + dir)))
  }

  function update<K extends keyof Contact>(key: K, val: Contact[K]) {
    if (!contact) return
    onChange({ ...contact, [key]: val })
  }

  async function handleSave() {
    if (saveState === 'saving' || !contact) return
    setSaveState('saving')
    if (onSave) {
      await onSave(contact, pendingJobIds)
      playSaveBlip()
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1500)
    } else {
      const { error } = await updateContact(contact)
      if (!error) {
        playSaveBlip()
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 1500)
      } else {
        setSaveState('idle')
      }
    }
  }

  if (!contact) return null

  const topBar = (
    <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
      <span className="tracking-wide truncate flex-1 text-center leading-tight select-none" style={{ color: T.green, fontSize: CRT_FONT.sub }}>
        <span className="mr-2" style={{ color: T.greenDim, fontSize: CRT_FONT.sub }}>↑</span>
        {contact.name || '—'}
        <span className="ml-2" style={{ color: T.greenDim, fontSize: CRT_FONT.chrome }}>
          ({contacts.length - localIdx}/{contacts.length})
        </span>
        <span className="ml-2" style={{ color: T.greenDim, fontSize: CRT_FONT.sub }}>↓</span>
      </span>
      <button
        onClick={handleClose}
        className="ml-2 leading-none flex-shrink-0 hover:opacity-60"
        style={{ color: T.greenDim, fontSize: CRT_FONT.btn }}
        title="Close (Esc)"
      >
        ✕
      </button>
    </div>
  )

  const body = (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
      {/* Jobs panel — multi-link */}
      <JobsPanel
        contactId={contact.id}
        userId={userId}
        lockedJob={lockedJob}
        onPendingChange={contact.id.startsWith('new-') ? (jobs) => setPendingJobIds(jobs.map((j) => j.id)) : undefined}
      />

      {/* Name + Company */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className={labelClass} style={{ color: T.greenDim }}>Name</div>
          <input
            className={inputClass}
            style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }}
            value={contact.name}
            maxLength={LIMITS.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Full name"
          />
        </div>
        <div className="flex-1">
          <div className={labelClass} style={{ color: T.greenDim }}>Company</div>
          <input
            className={inputClass}
            style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }}
            value={contact.company ?? ''}
            maxLength={LIMITS.company}
            onChange={(e) => update('company', e.target.value || undefined)}
            placeholder="Where they work"
          />
        </div>
      </div>

      {/* Socials row */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className={labelClass} style={{ color: T.greenDim }}>LinkedIn</div>
          <input
            className={inputClass}
            style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }}
            value={contact.linkedin ?? ''}
            maxLength={LIMITS.linkedin}
            onChange={(e) => update('linkedin', e.target.value || undefined)}
            placeholder="username or URL"
          />
        </div>
        <div className="flex-1">
          <div className={labelClass} style={{ color: T.greenDim }}>GitHub</div>
          <input
            className={inputClass}
            style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }}
            value={contact.github ?? ''}
            maxLength={LIMITS.github}
            onChange={(e) => update('github', e.target.value || undefined)}
            placeholder="username or URL"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <div className={labelClass} style={{ color: T.greenDim }}>Twitter</div>
          <input
            className={inputClass}
            style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }}
            value={contact.twitter ?? ''}
            maxLength={LIMITS.twitter}
            onChange={(e) => update('twitter', e.target.value || undefined)}
            placeholder="username or URL"
          />
        </div>
        <div className="flex-1">
          <div className={labelClass} style={{ color: T.greenDim }}>Discord</div>
          <input
            className={inputClass}
            style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }}
            value={contact.discord ?? ''}
            maxLength={LIMITS.discord}
            onChange={(e) => update('discord', e.target.value || undefined)}
            placeholder="username#0000"
          />
        </div>
      </div>

      <div>
        <div className={labelClass} style={{ color: T.greenDim }}>Email</div>
        <input
          type="email"
          className={inputClass}
          style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }}
          value={contact.email ?? ''}
          maxLength={LIMITS.email}
          onChange={(e) => update('email', e.target.value || undefined)}
          placeholder="email@example.com"
        />
      </div>

      {/* Notes */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className={labelClass} style={{ color: T.greenDim }}>Notes</div>
        <textarea
          className={textareaClass}
          style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body, flex: 1, resize: 'none' }}
          rows={5}
          maxLength={LIMITS.notes}
          value={contact.notes ?? ''}
          onChange={(e) => update('notes', e.target.value || undefined)}
          placeholder={'How you met…\nTopics to bring up…\nThings they mentioned…'}
        />
      </div>
    </div>
  )

  const footer = (
    <div className="px-4 py-2 flex items-center justify-center flex-shrink-0" style={{ borderTop: `1px solid ${T.border}` }}>
      <button
        onClick={handleSave}
        disabled={saveState === 'saving'}
        className="px-3 py-0.5 disabled:opacity-40 disabled:cursor-not-allowed transition-none hover:opacity-80"
        style={{
          fontSize: CRT_FONT.btn,
          color:  saveState === 'saved' ? T.green : T.greenDim,
          border: `1px solid ${saveState === 'saved' ? T.green : T.border}`,
        }}
      >
        {saveState === 'saving' ? '…' : saveState === 'saved' ? '✓ SAVED' : 'SAVE'}
      </button>
    </div>
  )

  if (fullScreen) {
    return (
      <div
        className="crt-card fixed inset-0 z-[200] flex flex-col"
        style={{
          animation: 'console-boot 0.35s ease-out forwards, crt-flicker 8s steps(1, end) 0.35s infinite',
          fontFamily: '"VT323", monospace',
          background: '#000',
          border: '1px solid #2a2a2a',
          color: '#39ff14',
          textShadow: crtTextShadow,
          boxShadow: '0 0 8px 1px rgba(57,255,20,0.35), inset 0 0 10px 2px rgba(57,255,20,0.06)',
        }}
      >
        {topBar}
        {body}
        {footer}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
      style={{ perspective: '1200px' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        ref={cardRef}
        className="crt-card flex flex-col w-[620px] max-w-[90vw]"
        style={{
          height: 'min(92vh, 680px)',
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
        {topBar}
        {body}
        {footer}
      </div>
    </div>
  )
}
