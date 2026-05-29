import { useState, useEffect, useRef, useCallback } from 'react'
import { isSfxMuted, playDialogueTick, playDialogueConfirm, startRain, playThunder } from '@/lib/sfx'
import RainOverlay from './RainOverlay'
import ResumeStormOverlay from './ResumeStormOverlay'
import HeartwaveOverlay from './HeartwaveOverlay'
import ResumeTimePassingOverlay from './ResumeTimePassingOverlay'

export interface DialogueLine {
  speaker?: string
  text: string
}

export type DialogueWeather = 'rainThunder' | 'resumeStorm' | 'heartwave' | 'resumeTimePassing'

export interface DialogueSceneProps {
  lines: DialogueLine[]
  onComplete: () => void
  audioSrc?: string
  fadeIn?: boolean
  weather?: DialogueWeather
  /** Called with the index of the line just advanced to (0-based). */
  onLineAdvance?: (lineIndex: number) => void
}

const DIALOGUE_STYLE = `
@keyframes dialogue-fadein {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes dialogue-cursor-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
@keyframes dialogue-prompt-pulse {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}
@keyframes dialogue-lightning {
  0%   { opacity: 0; }
  5%   { opacity: 0.18; }
  10%  { opacity: 0.02; }
  16%  { opacity: 0.12; }
  30%  { opacity: 0.06; }
  100% { opacity: 0; }
}
`
if (typeof document !== 'undefined' && !document.getElementById('dialogue-keyframes')) {
  const el = document.createElement('style')
  el.id = 'dialogue-keyframes'
  el.textContent = DIALOGUE_STYLE
  document.head.appendChild(el)
}

const CHAR_INTERVAL_MS = 35
const TICK_EVERY = 2

// Build a randomised thunder timeline for the duration of the scene.
// Returns array of { delay: ms, intensity: 0-1 }
function buildThunderTimeline(durationMs: number) {
  const events: { delay: number; intensity: number }[] = []
  // First strike after 2–5s, then every 6–18s
  let t = 2000 + Math.random() * 3000
  while (t < durationMs - 2000) {
    events.push({ delay: t, intensity: 0.5 + Math.random() * 0.5 })
    t += 6000 + Math.random() * 12000
  }
  return events
}

const SCENE_DURATION_MS = 120_000 // generous upper bound for timeline generation

export default function DialogueScene({
  lines,
  onComplete,
  audioSrc,
  fadeIn = false,
  weather,
  onLineAdvance,
}: DialogueSceneProps) {
  const [lineIndex, setLineIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [streaming, setStreaming] = useState(true)
  const [lightning, setLightning] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const thunderTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const currentLine = lines[lineIndex]
  const displayedText = currentLine.text.slice(0, charIndex)
  const isLastLine = lineIndex === lines.length - 1


  // Rain + thunder setup
  useEffect(() => {
    if (weather !== 'rainThunder') return
    const stopRain = startRain()
    const timeline = buildThunderTimeline(SCENE_DURATION_MS)
    thunderTimers.current = timeline.map(({ delay, intensity }) =>
      setTimeout(() => {
        playThunder(intensity)
        // Flash fires at the same moment as the thunder crack
        setLightning(true)
        setTimeout(() => setLightning(false), 2000)
      }, delay)
    )
    return () => {
      stopRain()
      thunderTimers.current.forEach(clearTimeout)
    }
  }, [weather])

  // Reset and start streaming whenever the line changes
  useEffect(() => {
    setCharIndex(0)
    setStreaming(true)
  }, [lineIndex])

  useEffect(() => {
    if (!streaming) return
    intervalRef.current = setInterval(() => {
      setCharIndex(prev => {
        const next = prev + 1
        const ch = currentLine.text[prev]
        if (ch && ch !== ' ' && next % TICK_EVERY === 0) {
          playDialogueTick()
        }
        if (next >= currentLine.text.length) {
          clearInterval(intervalRef.current!)
          setStreaming(false)
          return currentLine.text.length
        }
        return next
      })
    }, CHAR_INTERVAL_MS)
    return () => clearInterval(intervalRef.current!)
  }, [streaming, currentLine.text])

  // Optional ambient audio
  useEffect(() => {
    if (!audioSrc) return
    const audio = new Audio(audioSrc)
    audio.volume = isSfxMuted() ? 0 : 0.8
    audio.play().catch(() => {})
    audioRef.current = audio
    return () => { audio.pause(); audio.src = '' }
  }, [audioSrc])

  const advance = useCallback(() => {
    playDialogueConfirm()
    if (streaming) {
      clearInterval(intervalRef.current!)
      setCharIndex(currentLine.text.length)
      setStreaming(false)
      return
    }
    if (isLastLine) {
      onComplete()
    } else {
      const nextIndex = lineIndex + 1
      onLineAdvance?.(nextIndex)
      setLineIndex(nextIndex)
    }
  }, [streaming, isLastLine, lineIndex, currentLine.text.length, onComplete, onLineAdvance])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [advance])

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-end justify-center pb-16 px-6"
      style={{
        fontFamily: '"Press Start 2P", monospace',
        animation: fadeIn ? 'dialogue-fadein 0.4s ease-in forwards' : undefined,
      }}
      onClick={advance}
    >
      {/* Weather */}
      {weather === 'rainThunder' && <RainOverlay />}
      {weather === 'resumeStorm' && <ResumeStormOverlay />}
      {weather === 'heartwave' && <HeartwaveOverlay />}
      {weather === 'resumeTimePassing' && <ResumeTimePassingOverlay />}

      {/* Lightning flash overlay */}
      {lightning && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: '#888', animation: 'dialogue-lightning 2.0s ease-out forwards' }}
        />
      )}

      <div className="w-full max-w-lg flex flex-col gap-2" style={{ zIndex: 1 }}>
        {/* Speaker label */}
        {currentLine.speaker && (
          <div className="text-[9px] text-secondary tracking-widest px-1">
            {currentLine.speaker}
          </div>
        )}

        {/* Dialogue box */}
        <div className="border-2 border-primary bg-black p-5 min-h-[160px] flex flex-col justify-between gap-4">
          <p className="text-xs text-primary leading-relaxed">
            {displayedText}
            {streaming && (
              <span style={{ animation: 'dialogue-cursor-blink 0.6s step-start infinite' }}>▍</span>
            )}
          </p>

          {!streaming && (
            <div
              className="text-[9px] text-muted self-end"
              style={{ animation: 'dialogue-prompt-pulse 1.2s ease-in-out infinite' }}
            >
              {isLastLine ? '[ ENTER ] close' : '[ ENTER ] next'}
            </div>
          )}
        </div>

        {/* Line counter */}
        <div className="text-[9px] text-muted text-right px-1">
          {lineIndex + 1} / {lines.length}
        </div>
      </div>
    </div>
  )
}
