import { useState, useEffect, useRef } from 'react'
import { playDialogueConfirm, playDialogueTick } from '@/lib/sfx'
import RainOverlay from './RainOverlay'
import type { DialogueWeather } from './DialogueScene'

export interface DialogueInputSceneProps {
  /** Label shown in the speaker slot above the box */
  speaker?: string
  /** The prompt text typed out character-by-character */
  prompt: string
  /** Placeholder for the text input */
  placeholder?: string
  /** Max character length for the answer */
  maxLength?: number
  weather?: DialogueWeather
  /** Called with the trimmed value when the player submits */
  onSubmit: (value: string) => void
}

const CHAR_INTERVAL_MS = 35
const TICK_EVERY = 2

export default function DialogueInputScene({
  speaker,
  prompt,
  placeholder = '...',
  maxLength = 32,
  weather,
  onSubmit,
}: DialogueInputSceneProps) {
  const [charIndex, setCharIndex] = useState(0)
  const [streaming, setStreaming] = useState(true)
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const displayedPrompt = prompt.slice(0, charIndex)

  // Stream the prompt text
  useEffect(() => {
    if (!streaming) return
    intervalRef.current = setInterval(() => {
      setCharIndex(prev => {
        const next = prev + 1
        const ch = prompt[prev]
        if (ch && ch !== ' ' && next % TICK_EVERY === 0) playDialogueTick()
        if (next >= prompt.length) {
          clearInterval(intervalRef.current!)
          setStreaming(false)
          return prompt.length
        }
        return next
      })
    }, CHAR_INTERVAL_MS)
    return () => clearInterval(intervalRef.current!)
  }, [streaming, prompt])

  // Focus input once prompt finishes streaming
  useEffect(() => {
    if (!streaming) inputRef.current?.focus()
  }, [streaming])

  // Skip streaming on click/space/enter while still streaming
  useEffect(() => {
    if (!streaming) return
    function skip(e: KeyboardEvent | MouseEvent) {
      if (e instanceof KeyboardEvent && e.key !== ' ' && e.key !== 'Enter') return
      clearInterval(intervalRef.current!)
      setCharIndex(prompt.length)
      setStreaming(false)
    }
    window.addEventListener('keydown', skip)
    window.addEventListener('click', skip)
    return () => {
      window.removeEventListener('keydown', skip)
      window.removeEventListener('click', skip)
    }
  }, [streaming, prompt.length])

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || submitted) return
    setSubmitted(true)
    playDialogueConfirm()
    onSubmit(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-end justify-center pb-16 px-6"
      style={{ fontFamily: '"Press Start 2P", monospace' }}
    >
      {weather === 'rainThunder' && <RainOverlay />}

      <div className="w-full max-w-lg flex flex-col gap-2" style={{ zIndex: 1 }}>
        {speaker && (
          <div className="text-[9px] text-secondary tracking-widest px-1">{speaker}</div>
        )}

        <div className="border-2 border-primary bg-black p-5 min-h-[160px] flex flex-col justify-between gap-4">
          <p className="text-xs text-primary leading-relaxed">
            {displayedPrompt}
            {streaming && (
              <span style={{ animation: 'dialogue-cursor-blink 0.6s step-start infinite' }}>▍</span>
            )}
          </p>

          {/* Fixed-height bottom slot — matches the [ ENTER ] next prompt height in DialogueScene */}
          <div className="min-h-[28px] flex flex-col justify-end gap-2">
            {!streaming && (
              <>
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={maxLength}
                  placeholder={placeholder}
                  disabled={submitted}
                  className="bg-transparent border border-primary text-primary text-xs px-3 py-2 outline-none placeholder:text-muted w-full"
                  style={{ fontFamily: '"Press Start 2P", monospace', caretColor: 'var(--color-primary)' }}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!value.trim() || submitted}
                  className="self-end text-[9px] text-muted border border-muted px-3 py-1 disabled:opacity-30"
                  style={{ animation: value.trim() && !submitted ? 'dialogue-prompt-pulse 1.2s ease-in-out infinite' : undefined }}
                >
                  [ ENTER ] confirm
                </button>
              </>
            )}
          </div>
        </div>

        {/* Spacer — matches the line counter row in DialogueScene so box sits at same height */}
        <div className="text-[9px] text-muted text-right px-1 invisible">0 / 0</div>
      </div>
    </div>
  )
}
