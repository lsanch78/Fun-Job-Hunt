import { useState, useEffect, useRef } from 'react'
import type { Job, Contact } from '@/types'
import { fetchJobDetails, updateJobDetails, JOB_LIMITS } from '@/services/jobService'
import { useAI } from '@/hooks/useAI'
import {
  fetchContactsForJob, fetchContacts, linkContactToJob,
  unlinkContactFromJob, insertContact, updateContact,
} from '@/services/contactService'
import { playBootBlip, playExitBlip, startTerminalHum, playConsoleBlip, playSaveBlip } from '@/lib/sfx'
import { T, labelClass, inputClass, textareaClass, ensureCrtStyles, crtTextShadow, crtBoxShadow, CRT_FONT } from '@/lib/crtTheme'
import ContactDetailModal from '@/components/ContactDetailModal'
import AiButton from '@/components/ai/AiButton'
import { createCheckoutSession } from '@/services/subscriptionService'

ensureCrtStyles()

// ── Types ─────────────────────────────────────────────────────────────────────
interface JobDetailModalProps {
  jobs: Job[]
  jobId: string
  userId: string | null
  onClose: () => void
  onChange: (updated: Job) => void
  fullScreen?: boolean
}

// ── ContactsPanel ─────────────────────────────────────────────────────────────

function ContactsPanel({ jobId, jobTitle, jobCompany, userId }: { jobId: string; jobTitle: string; jobCompany: string; userId: string | null }) {
  const [linked, setLinked] = useState<Contact[]>([])
  const [all, setAll] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [picking, setPicking] = useState(false)
  const [search, setSearch] = useState('')
  const [cardContact, setCardContact] = useState<Contact | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    fetchContactsForJob(jobId).then((contacts) => {
      setLinked(contacts)
      setLoading(false)
    })
  }, [jobId])

  useEffect(() => {
    if (picking && userId) {
      fetchContacts(userId).then(setAll)
      setTimeout(() => searchRef.current?.focus(), 50)
    }
    if (!picking) setSearch('')
  }, [picking, userId])

  function openNewCard() {
    if (!userId) return
    setCardContact({
      id: `new-${Date.now()}`,
      userId,
      name: '',
      lastInteractionAt: null,
      commExp: 0,
      lastCommAt: null,
      createdAt: new Date().toISOString(),
    })
  }

  async function handleCardSave(contact: Contact, _pendingJobIds?: string[]) {
    if (!userId) return
    // New contact — insert then link
    if (contact.id.startsWith('new-')) {
      const { data, error } = await insertContact({
        userId,
        name: contact.name,
        company: contact.company,
        linkedin: contact.linkedin,
        github: contact.github,
        twitter: contact.twitter,
        discord: contact.discord,
        email: contact.email,
        notes: contact.notes,
        lastInteractionAt: contact.lastInteractionAt,
        commExp: 0,
        lastCommAt: null,
      }, userId)
      if (error) { console.error('[ContactsPanel] insertContact failed:', error); return }
      if (data) {
        await linkContactToJob(data.id, jobId)
        setLinked((prev) => [...prev, data])
      }
    } else {
      // Existing contact being edited — just update
      await updateContact(contact)
      setLinked((prev) => prev.map((c) => c.id === contact.id ? contact : c))
    }
    setCardContact(null)
  }

  async function handleLink(contact: Contact) {
    const { error } = await linkContactToJob(contact.id, jobId)
    if (!error) {
      setLinked((prev) => [...prev, contact])
      setPicking(false)
    }
  }

  async function handleUnlink(contactId: string) {
    const { error } = await unlinkContactFromJob(contactId, jobId)
    if (!error) setLinked((prev) => prev.filter((c) => c.id !== contactId))
  }

  const linkedIds = new Set(linked.map((c) => c.id))
  const filtered = all.filter(
    (c) => !linkedIds.has(c.id) && (
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company?.toLowerCase().includes(search.toLowerCase())
    )
  )

  const panelStyle = { fontSize: CRT_FONT.body, color: T.green }
  const dimStyle   = { fontSize: CRT_FONT.sub,  color: T.greenDim }
  const btnStyle   = { fontSize: CRT_FONT.btn, color: T.greenDim, border: `1px solid ${T.border}` }

  return (
    <div className="flex flex-col gap-2">
      <div className={labelClass} style={{ color: T.greenDim }}>Contacts</div>

      {/* Linked contacts list */}
      {loading ? (
        <span style={dimStyle}>loading…</span>
      ) : linked.length === 0 ? (
        <span style={dimStyle}>no contacts linked</span>
      ) : (
        <div className="flex flex-wrap gap-1 overflow-y-auto" style={{ maxHeight: '4rem' }}>
          {linked.map((c) => (
            <div key={c.id} className="flex items-center gap-1 group px-1.5 py-0.5" style={{ border: `1px solid ${T.border}` }}>
              <button
                onClick={() => setCardContact(c)}
                className="flex items-baseline gap-1 min-w-0 text-left hover:opacity-80 transition-none"
                title="Edit contact"
              >
                <span style={panelStyle}>{c.name}</span>
                {c.company && <span style={dimStyle}>@ {c.company}</span>}
              </button>
              <button
                onClick={() => handleUnlink(c.id)}
                className="opacity-0 group-hover:opacity-100 transition-none hover:opacity-60 leading-none"
                style={dimStyle}
                title="Unlink contact"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {!picking && (
        <div className="flex gap-2 mt-1">
          <button onClick={() => setPicking(true)} className="px-2 py-0.5 transition-none hover:opacity-80" style={btnStyle}>
            + LINK EXISTING
          </button>
          <button onClick={openNewCard} className="px-2 py-0.5 transition-none hover:opacity-80" style={btnStyle}>
            + NEW CONTACT
          </button>
        </div>
      )}

      {/* Pick existing */}
      {picking && (
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="relative">
            <input
              ref={searchRef}
              className={inputClass}
              style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }}
              placeholder="search contacts… (Esc to close)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setPicking(false) } }}
            />
            <div
              className="absolute left-0 right-0 top-full z-10 flex flex-col overflow-y-auto"
              style={{ background: T.bg, border: `1px solid ${T.border}`, maxHeight: '160px' }}
            >
              {filtered.length === 0 ? (
                <span className="px-1 py-0.5" style={dimStyle}>no matches</span>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleLink(c)}
                    className="text-left px-1 py-0.5 hover:opacity-70 transition-none flex gap-2 items-baseline"
                    style={panelStyle}
                  >
                    <span>{c.name}</span>
                    {c.company && <span style={dimStyle}>@ {c.company}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
          <button onClick={() => setPicking(false)} className="px-2 py-0.5 transition-none hover:opacity-80 self-start" style={btnStyle}>
            CANCEL
          </button>
        </div>
      )}

      {/* ContactDetailModal — new or edit */}
      {cardContact && (
        <ContactDetailModal
          contacts={cardContact.id.startsWith('new-') ? [cardContact] : linked}
          contactId={cardContact.id}
          onClose={() => setCardContact(null)}
          onChange={(updated) => {
            setCardContact(updated)
            if (!updated.id.startsWith('new-')) {
              setLinked((prev) => prev.map((c) => c.id === updated.id ? updated : c))
            }
          }}
          onSave={handleCardSave}
          userId={userId}
          lockedJob={{ id: jobId, title: jobTitle, company: jobCompany }}
        />
      )}
    </div>
  )
}

// ── JobDetailModal ────────────────────────────────────────────────────────────
const CLEAN_JD_SYSTEM = `You are a text formatting assistant. Clean up and reformat job description text. Preserve ALL original content exactly — do not add, remove, or rephrase anything. Fix only whitespace, indentation, inconsistent bullet points, and stray characters. Output plain text with clean structure.`

export default function JobDetailModal({ jobs, jobId, userId, onClose, onChange, fullScreen = false }: JobDetailModalProps) {
  const currentIdx = jobs.findIndex((j) => j.id === jobId)
  const [localIdx, setLocalIdx] = useState(currentIdx === -1 ? 0 : currentIdx)
  const [page, setPage] = useState<1 | 2>(1)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiLimitHit, setAiLimitHit] = useState(false)
  const loadedIds = useRef<Set<string>>(new Set())
  const cardRef = useRef<HTMLDivElement>(null)
  const ai = useAI()

  const job = jobs[localIdx] ?? jobs[0]

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
      if (e.key === 'Enter') { handleSave(true); return }
      if (e.key === 'ArrowRight') { e.preventDefault(); goPage(1) }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPage(-1) }
      if (e.key === 'ArrowUp')    { e.preventDefault(); goJob(-1) }
      if (e.key === 'ArrowDown')  { e.preventDefault(); goJob(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, page, localIdx])

  useEffect(() => { setPage(1) }, [localIdx])

  useEffect(() => {
    if (!job || loadedIds.current.has(job.id)) return
    if (job.description !== undefined && job.notes !== undefined) {
      loadedIds.current.add(job.id)
      return
    }
    setDetailsLoading(true)
    fetchJobDetails(job.id).then((details) => {
      setDetailsLoading(false)
      if (!details) return
      loadedIds.current.add(job.id)
      onChange({ ...job, description: details.description ?? '', notes: details.notes ?? '' })
    })
  }, [job?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSaveState('idle') }, [localIdx])

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

  async function handleSave(closeAfter = false) {
    if (!job || saveState === 'saving') return
    setSaveState('saving')
    setSaveError(null)
    const { error } = await updateJobDetails(job.id, {
      description: job.description ?? null,
      notes:       job.notes       ?? null,
    })
    if (error) {
      setSaveError(error)
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 2000)
    } else {
      if (closeAfter) {
        handleClose()
      } else {
        playSaveBlip()
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 1500)
      }
    }
  }

  if (!job) return null

  const topBar = (
    <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
      <span className="tracking-wide truncate flex-1 text-center leading-tight" style={{ color: T.green, fontSize: CRT_FONT.sub }}>
        <span className="mr-2 select-none" style={{ color: T.greenDim, fontSize: CRT_FONT.sub }}>↑</span>
        {job.company || '—'}
        {job.title ? <span style={{ color: T.greenDim }}> — {job.title}</span> : null}
        <span className="ml-2 select-none" style={{ color: T.greenDim, fontSize: CRT_FONT.chrome }}>({jobs.length - localIdx}/{jobs.length})</span>
        <span className="ml-2 select-none" style={{ color: T.greenDim, fontSize: CRT_FONT.sub }}>↓</span>
      </span>
      <button onClick={handleClose} className="ml-2 leading-none flex-shrink-0 hover:opacity-60" style={{ color: T.greenDim, fontSize: CRT_FONT.btn }} title="Close (Esc)">✕</button>
    </div>
  )

  const page1 = (
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
      <ContactsPanel jobId={job.id} jobTitle={job.title} jobCompany={job.company} userId={userId} />
      <div className="flex-1 flex flex-col min-h-0">
        <div className={labelClass} style={{ color: T.greenDim }}>Notes</div>
        <textarea className={textareaClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body, flex: 1, resize: 'none' }} maxLength={JOB_LIMITS.notes} value={job.notes ?? ''} onChange={(e) => update('notes', e.target.value)} placeholder={['Interview rounds…','Culture impressions…','Source / how you found it…','Resume version used…','Anything else…'].join('\n')} />
      </div>
    </div>
  )

  function handleCleanJD() {
    const raw = job.description ?? ''
    if (!raw.trim()) return
    setAiError(null)
    setAiLimitHit(false)
    ai.run({
      system: CLEAN_JD_SYSTEM,
      prompt: raw,
      onComplete: (cleaned) => update('description', cleaned),
      onError: (msg) => {
        const isLimit = msg.includes('Monthly limit') || msg.includes('limit reached')
        setAiLimitHit(isLimit)
        if (!isLimit) setAiError(msg)
      },
    })
  }

  const page2 = (
    <>
      <div className="tracking-wide pb-2 select-none flex-shrink-0" style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, borderBottom: `1px solid ${T.border}` }}>
        {job.company || '—'}{job.title ? ` — ${job.title}` : ''}
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className={labelClass} style={{ color: T.greenDim }}>Job Description</div>
          <AiButton
            label="CLEAN JD"
            phase={ai.phase}
            dots={ai.dots}
            onClick={handleCleanJD}
            disabled={ai.phase !== 'idle' || !job.description?.trim()}
            title={ai.phase === 'generating' ? 'Generating…' : ai.phase === 'ready' ? 'Done!' : 'Use AI to clean up formatting'}
          />
        </div>
        {aiLimitHit && (
          <div className="mb-1 flex items-center gap-2" style={{ fontSize: CRT_FONT.chrome }}>
            <span style={{ color: T.warn }}>// MONTHLY LIMIT REACHED</span>
            <button
              onClick={() => createCheckoutSession().catch(() => {})}
              className="px-2 py-0.5 transition-none hover:opacity-80"
              style={{ color: T.warn, border: `1px solid ${T.warn}`, fontSize: CRT_FONT.chrome }}
            >
              UPGRADE — $8/mo
            </button>
          </div>
        )}
        {aiError && (
          <div className="mb-1 truncate" style={{ fontSize: CRT_FONT.chrome, color: '#ff4444' }}>{aiError}</div>
        )}
        <textarea className={textareaClass} style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body, flex: 1, resize: 'none' }} maxLength={JOB_LIMITS.description} value={job.description ?? ''} onChange={(e) => update('description', e.target.value)} placeholder="Paste or summarize the job description…" />
      </div>
    </>
  )

  const pageNav = (
    <div className="px-4 py-2 flex items-center justify-between flex-shrink-0" style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="w-20">
        {page === 2 && <button onClick={() => goPage(-1)} className="px-2 py-0.5 transition-none hover:opacity-70" style={{ color: T.greenDim, fontSize: CRT_FONT.btn, border: `1px solid ${T.border}` }}>← FRONT</button>}
      </div>
      <button
        onClick={() => handleSave(true)}
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
        {page === 1 && <button onClick={() => goPage(1)} className="px-2 py-0.5 transition-none hover:opacity-70" style={{ color: T.greenDim, fontSize: CRT_FONT.btn, border: `1px solid ${T.border}` }}>BACK →</button>}
      </div>
    </div>
  )

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
        {topBar}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {page === 1 && page1}
          {page === 2 && page2}
        </div>
        {pageNav}
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
        {topBar}
        <div className="flex-1 flex flex-col overflow-y-auto px-4 py-4 gap-4">
          {page === 1 && page1}
          {page === 2 && page2}
        </div>
        {pageNav}
      </div>
    </div>
  )
}
