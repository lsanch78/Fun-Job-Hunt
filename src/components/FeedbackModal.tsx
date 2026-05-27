import { useEffect, useRef, useState } from 'react'
import { playSubmitBlip, playCloseBlip } from '@/lib/sfx'
import {
  FEEDBACK_TOPICS,
  MESSAGE_LIMIT,
  CONTACT_LIMIT,
  submitFeedback,
  type FeedbackTopic,
} from '@/services/feedbackService'

// ── CRT styles — injected once (mirrors AppDetailCard) ───────────────────────
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
.crt-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 38%, rgba(57,255,20,0.04) 0%, rgba(255,255,255,0.015) 35%, transparent 65%);
  pointer-events: none;
  z-index: 10;
  border-radius: inherit;
}
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

// Terminal palette
const T = {
  green:    '#39ff14',
  greenDim: '#23a80d',
  border:   '#2a2a2a',
}

const labelClass = 'text-[13px] tracking-widest uppercase mb-1 select-none'
const inputClass = 'bg-transparent outline-none w-full px-1 py-0.5 leading-tight border-b'
const textareaClass = `${inputClass} resize-none`

interface FeedbackModalProps {
  userId: string
  onClose: () => void
}

type Status = 'idle' | 'sending' | 'success' | 'error'

export default function FeedbackModal({ userId, onClose }: FeedbackModalProps) {
  const [topic, setTopic] = useState<FeedbackTopic>('User Interface')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { playCloseBlip(); onClose() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit() {
    if (!message.trim() || status === 'sending') return
    setStatus('sending')
    const ok = await submitFeedback({ userId, topic, contact, message })
    if (ok) {
      playSubmitBlip()
      setStatus('success')
    } else {
      setStatus('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
      style={{ perspective: '1200px' }}
      onClick={(e) => { if (e.target === e.currentTarget) { playCloseBlip(); onClose() } }}
    >
      <div
        className="crt-card flex flex-col w-[420px] max-w-[90vw]"
        style={{
          animation: 'console-boot 0.35s ease-out forwards, crt-flicker 8s steps(1, end) 0.35s infinite',
          fontFamily: '"VT323", monospace',
          background: '#000',
          border: `1px solid ${T.border}`,
          color: T.green,
          borderRadius: '12px',
          textShadow: '0 0 4px rgba(57,255,20,0.25)',
          transform: 'rotateX(2deg) rotateY(0deg)',
          transformStyle: 'preserve-3d',
          boxShadow: [
            '0 0 0 1px #111',
            '0 0 8px 1px rgba(57,255,20,0.35)',
            '0 0 28px 4px rgba(57,255,20,0.15)',
            'inset 0 0 60px 30px rgba(0,0,0,0.70)',
            'inset 0 0 10px 2px rgba(57,255,20,0.06)',
          ].join(', '),
        }}
      >
        {/* ── Header ── */}
        <div className="px-4 py-2 flex items-center justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
          <span className="text-base tracking-widest" style={{ color: T.green }}>FEEDBACK</span>
          <button
            onClick={() => { playCloseBlip(); onClose() }}
            className="text-base leading-none hover:opacity-60"
            style={{ color: T.greenDim }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {status === 'success' ? (
          /* ── Success state ── */
          <div className="px-4 py-8 flex flex-col items-center gap-4">
            <span className="text-lg tracking-wider" style={{ color: T.green }}>▶ SENT — THANKS!</span>
            <button
              onClick={() => { playCloseBlip(); onClose() }}
              className="text-[15px] px-4 py-1 hover:opacity-70 transition-none"
              style={{ color: T.greenDim, border: `1px solid ${T.border}` }}
            >
              CLOSE
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <div className="flex flex-col gap-4 px-4 py-4">

            {/* Topic */}
            <div>
              <div className={labelClass} style={{ color: T.greenDim }}>Topic</div>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value as FeedbackTopic)}
                className="bg-transparent outline-none w-full px-1 py-0.5 leading-tight border-b text-lg"
                style={{ color: T.green, borderColor: T.border, caretColor: T.green }}
              >
                {FEEDBACK_TOPICS.map((t) => (
                  <option key={t} value={t} style={{ background: '#000', color: T.green }}>{t}</option>
                ))}
              </select>
            </div>

            {/* Message */}
            <div>
              <div className={labelClass} style={{ color: T.greenDim }}>
                Message <span style={{ opacity: 0.5 }}>({message.length}/{MESSAGE_LIMIT})</span>
              </div>
              <textarea
                ref={textareaRef}
                className={textareaClass + ' text-lg'}
                style={{ color: T.green, borderColor: T.border, caretColor: T.green }}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_LIMIT))}
                rows={5}
                placeholder="Describe your feedback…"
              />
            </div>

            {/* Contact */}
            <div>
              <div className={labelClass} style={{ color: T.greenDim }}>
                Contact <span style={{ opacity: 0.5 }}>(optional)</span>
              </div>
              <input
                type="text"
                className={inputClass + ' text-lg'}
                style={{ color: T.green, borderColor: T.border, caretColor: T.green }}
                value={contact}
                onChange={(e) => setContact(e.target.value.slice(0, CONTACT_LIMIT))}
                placeholder="email or @handle"
              />
            </div>

            {status === 'error' && (
              <div className="text-[13px] tracking-widest" style={{ color: '#ff4444' }}>
                ✕ ERROR — TRY AGAIN
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1" style={{ borderTop: `1px solid ${T.border}` }}>
              <button
                onClick={() => { playCloseBlip(); onClose() }}
                className="text-[15px] px-3 py-0.5 hover:opacity-70 transition-none"
                style={{ color: T.greenDim, border: `1px solid ${T.border}` }}
              >
                CANCEL
              </button>
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || status === 'sending'}
                className="text-[15px] px-3 py-0.5 hover:opacity-80 transition-none disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: T.green, border: `1px solid ${T.green}` }}
              >
                {status === 'sending' ? '▶ SENDING…' : '▶ SEND'}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
