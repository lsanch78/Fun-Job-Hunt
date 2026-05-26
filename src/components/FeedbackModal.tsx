import { useEffect, useRef, useState } from 'react'
import { isSfxMuted } from '@/lib/sfx'
import {
  FEEDBACK_TOPICS,
  MESSAGE_LIMIT,
  CONTACT_LIMIT,
  submitFeedback,
  type FeedbackTopic,
} from '@/services/feedbackService'

function playSubmitBlip() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(440, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  } catch { /* blocked */ }
}

function playCloseBlip() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(440, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.04, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)
  } catch { /* blocked */ }
}

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
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) { playCloseBlip(); onClose() } }}
    >
      <div className="bg-surface border border-border w-full max-w-sm flex flex-col">

        {/* Header */}
        <div className="bg-bg border-b border-border px-3 py-2 flex items-center justify-between">
          <span className="font-pixel text-[9px] tracking-widest text-primary">FEEDBACK</span>
          <button
            onClick={() => { playCloseBlip(); onClose() }}
            className="font-pixel text-[9px] text-muted hover:text-primary leading-none"
            title="Close"
          >
            ✕
          </button>
        </div>

        {status === 'success' ? (
          <div className="px-4 py-8 flex flex-col items-center gap-3">
            <span className="font-pixel text-[9px] text-primary tracking-wider">▶ SENT — THANKS!</span>
            <button
              onClick={() => { playCloseBlip(); onClose() }}
              className="mt-2 font-pixel text-[9px] border border-border text-muted px-4 py-1 hover:border-primary hover:text-primary transition-none"
            >
              CLOSE
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4">

            {/* Topic */}
            <div className="flex flex-col gap-1">
              <label className="font-pixel text-[8px] text-muted tracking-wider">TOPIC</label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value as FeedbackTopic)}
                className="bg-bg border border-border text-text font-pixel text-[9px] px-2 py-1.5 focus:outline-none focus:border-primary transition-none"
              >
                {FEEDBACK_TOPICS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Message */}
            <div className="flex flex-col gap-1">
              <label className="font-pixel text-[8px] text-muted tracking-wider">
                MESSAGE <span className="text-muted opacity-60">({message.length}/{MESSAGE_LIMIT})</span>
              </label>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_LIMIT))}
                rows={5}
                placeholder="Describe your feedback..."
                className="bg-bg border border-border text-text text-xs px-2 py-1.5 resize-none focus:outline-none focus:border-primary transition-none placeholder:text-muted placeholder:opacity-40"
              />
            </div>

            {/* Contact */}
            <div className="flex flex-col gap-1">
              <label className="font-pixel text-[8px] text-muted tracking-wider">
                CONTACT <span className="opacity-50">(optional)</span>
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value.slice(0, CONTACT_LIMIT))}
                placeholder="email or @handle"
                className="bg-bg border border-border text-text text-xs px-2 py-1.5 focus:outline-none focus:border-primary transition-none placeholder:text-muted placeholder:opacity-40"
              />
            </div>

            {status === 'error' && (
              <p className="font-pixel text-[8px] text-red-400 tracking-wider">ERROR — TRY AGAIN</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-1">
              <button
                onClick={() => { playCloseBlip(); onClose() }}
                className="font-pixel text-[9px] border border-border text-muted px-3 py-1 hover:border-secondary hover:text-secondary transition-none"
              >
                CANCEL
              </button>
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || status === 'sending'}
                className="font-pixel text-[9px] border border-primary text-primary px-3 py-1 hover:bg-primary hover:text-bg transition-none disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {status === 'sending' ? '▶ SENDING...' : '▶ SEND'}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
