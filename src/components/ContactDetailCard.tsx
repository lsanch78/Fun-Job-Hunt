import { useState, useEffect, useRef } from 'react'
import type { MockContact } from '@/components/ContactList'
import { playBootBlip, playExitBlip, startTerminalHum, playConsoleBlip, playSaveBlip } from '@/lib/sfx'
import { T, labelClass, inputClass, textareaClass, ensureCrtStyles, crtTextShadow, crtBoxShadow, CRT_FONT } from '@/lib/crtTheme'

ensureCrtStyles()

interface ContactDetailCardProps {
  contacts: MockContact[]
  contactId: string
  onClose: () => void
  onChange: (updated: MockContact) => void
  fullScreen?: boolean
}

const LIMITS = {
  name:     100,
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
  fullScreen = false,
}: ContactDetailCardProps) {
  const currentIdx = contacts.findIndex((c) => c.id === contactId)
  const [localIdx, setLocalIdx] = useState(currentIdx === -1 ? 0 : currentIdx)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
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

  function update<K extends keyof MockContact>(key: K, val: MockContact[K]) {
    if (!contact) return
    onChange({ ...contact, [key]: val })
  }

  function handleSave() {
    if (saveState === 'saving') return
    setSaveState('saving')
    // Phase 1: UI-only — simulate a save delay, wire to DB in phase 2
    setTimeout(() => {
      playSaveBlip()
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1500)
    }, 300)
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
      {/* Name */}
      <div>
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
