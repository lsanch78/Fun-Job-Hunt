import { useEffect, useRef, useState } from 'react'
import { playSubmitBlip, playCloseBlip } from '@/lib/sfx'
import {
  FEEDBACK_TOPICS,
  MESSAGE_LIMIT,
  CONTACT_LIMIT,
  submitFeedback,
} from '@/services/feedbackService'
import type { FeedbackTopic, SubmitFeedbackResult } from '@/types'
import { T, labelClass, inputClass, textareaClass, ensureCrtStyles, crtTextShadow, crtBoxShadow, CRT_FONT } from '@/lib/crtTheme'

ensureCrtStyles()

interface FeedbackModalProps {
  userId: string
  onClose: () => void
}

type Status = 'idle' | 'sending' | 'success' | SubmitFeedbackResult

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
    const result = await submitFeedback({ userId, topic, contact, message })
    if (result === 'ok') {
      playSubmitBlip()
      setStatus('success')
    } else {
      setStatus(result)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
      style={{ perspective: '1200px' }}
      onClick={(e) => { if (e.target === e.currentTarget) { playCloseBlip(); onClose() } }}
    >
      <div
        className="crt-card flex flex-col w-[500px] max-w-[90vw]"
        style={{
          animation: 'console-boot 0.35s ease-out forwards, crt-flicker 8s steps(1, end) 0.35s infinite',
          fontFamily: '"VT323", monospace',
          background: '#000',
          border: `1px solid ${T.border}`,
          color: T.green,
          borderRadius: '12px',
          textShadow: crtTextShadow,
          transform: 'rotateX(2deg) rotateY(0deg)',
          transformStyle: 'preserve-3d',
          boxShadow: crtBoxShadow,
        }}
      >
        {/* ── Header ── */}
        <div className="px-4 py-2 flex items-center justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
          <span style={{ color: T.green, fontSize: CRT_FONT.sub, letterSpacing: '0.08em' }}>// FEEDBACK</span>
          <button
            onClick={() => { playCloseBlip(); onClose() }}
            style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, background: 'none', border: 'none', cursor: 'pointer' }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {status === 'success' ? (
          /* ── Success state ── */
          <div className="px-4 py-8 flex flex-col items-center gap-4">
            <span style={{ color: T.green, fontSize: CRT_FONT.sub, letterSpacing: '0.08em' }}>▶ SENT — THANKS!</span>
            <button
              onClick={() => { playCloseBlip(); onClose() }}
              className="px-4 py-1 hover:opacity-70 transition-none"
              style={{ color: T.greenDim, fontSize: CRT_FONT.btn, border: `1px solid ${T.border}` }}
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
                className="bg-transparent outline-none w-full px-1 py-0.5 leading-tight border-b"
                style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }}
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
                className={textareaClass}
                style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }}
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
                className={inputClass}
                style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }}
                value={contact}
                onChange={(e) => setContact(e.target.value.slice(0, CONTACT_LIMIT))}
                placeholder="email or @handle"
              />
            </div>

            {status === 'rate_limited' && (
              <div className="tracking-widest" style={{ color: '#ff4444', fontSize: CRT_FONT.chrome }}>
                ✕ LIMIT REACHED — TRY AGAIN TOMORROW
              </div>
            )}
            {status === 'error' && (
              <div className="tracking-widest" style={{ color: '#ff4444', fontSize: CRT_FONT.chrome }}>
                ✕ ERROR — TRY AGAIN
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1" style={{ borderTop: `1px solid ${T.border}` }}>
              <button
                onClick={() => { playCloseBlip(); onClose() }}
                className="px-3 py-0.5 hover:opacity-70 transition-none"
                style={{ color: T.greenDim, fontSize: CRT_FONT.btn, border: `1px solid ${T.border}` }}
              >
                CANCEL
              </button>
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || status === 'sending'}
                className="px-3 py-0.5 hover:opacity-80 transition-none disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: T.green, fontSize: CRT_FONT.btn, border: `1px solid ${T.green}` }}
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
