import { useState, useEffect, useRef } from 'react'
import { isSfxMuted, playCreditsBlip } from '@/lib/sfx'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CutsceneProps {
  /** Lines of text to scroll. Empty string = spacer row. */
  lines: string[]
  /** Path to an audio file to play on mount (e.g. '/congratulations.mp3'). Optional. */
  audioSrc?: string
  /** Total scroll duration in ms. */
  duration: number
  /** Called when the user clicks the continue button. */
  onComplete: () => void
  /** Label for the continue button. Defaults to 'CONTINUE →'. */
  continueLabel?: string
  /** If true, the overlay fades in from black on mount. Defaults to false. */
  fadeIn?: boolean
}

// ── Keyframes (injected once) ─────────────────────────────────────────────────

const CUTSCENE_STYLE = `
@keyframes cutscene-scroll {
  0%   { transform: translateY(0); }
  100% { transform: translateY(-100%); }
}
@keyframes cutscene-pulse {
  0%, 100% { box-shadow: 0 0 0 0 #f5c51866; }
  50%       { box-shadow: 0 0 0 16px #f5c51800; }
}
@keyframes cutscene-fadein {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
`
if (typeof document !== 'undefined' && !document.getElementById('cutscene-keyframes')) {
  const el = document.createElement('style')
  el.id = 'cutscene-keyframes'
  el.textContent = CUTSCENE_STYLE
  document.head.appendChild(el)
}

// ── Line classifier ───────────────────────────────────────────────────────────

function lineClasses(line: string): string {
  if (line === '')
    return 'h-3'
  if (line.startsWith('>'))
    return 'text-xs text-green-400 leading-relaxed text-center'
  if (line === line.toUpperCase() && line.length > 0 && !/[a-z]/.test(line))
    return 'text-[10px] text-secondary tracking-widest border-b border-gray-700 pb-2 leading-relaxed text-center'
  return 'text-xs text-gray-300 leading-relaxed text-center'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Cutscene({
  lines,
  audioSrc,
  duration,
  onComplete,
  continueLabel = 'CONTINUE  →',
  fadeIn = false,
}: CutsceneProps) {
  const [scrollDone, setScrollDone] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Play audio on mount
  useEffect(() => {
    if (!audioSrc) return
    const audio = new Audio(audioSrc)
    audio.volume = isSfxMuted() ? 0 : 0.8
    audio.play().catch(() => {})
    audioRef.current = audio
    return () => { audio.pause(); audio.src = '' }
  }, [audioSrc])

  // Show continue button when scroll is visually done
  useEffect(() => {
    const t = setTimeout(() => setScrollDone(true), duration - 6000)
    return () => clearTimeout(t)
  }, [duration])

  return (
    <div
      className="fixed inset-0 z-50 bg-black overflow-hidden flex flex-col items-center"
      style={{
        fontFamily: '"Press Start 2P", monospace',
        animation: fadeIn ? 'cutscene-fadein 1.2s ease-in forwards' : undefined,
      }}
    >
      {/* Top + bottom fade masks */}
      <div
        className="absolute inset-x-0 top-0 h-32 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, black 40%, transparent)' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-32 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to top, black 40%, transparent)' }}
      />

      {/* Scrolling text block */}
      <div
        className="w-full max-w-4xl flex flex-col gap-5 px-8"
        style={{
          animation: `cutscene-scroll ${duration}ms linear forwards`,
          paddingTop: '100vh',
          paddingBottom: '0',
        }}
      >
        {lines.map((line, i) => (
          <div key={i} className={lineClasses(line)}>
            {line}
          </div>
        ))}
      </div>

      {/* Continue button */}
      {scrollDone && (
        <button
          onClick={() => { playCreditsBlip(); onComplete() }}
          className="absolute bottom-12 text-xs text-[#f5c518] border border-[#f5c518] px-6 py-3 hover:bg-[#f5c51822] transition-none z-20"
          style={{ animation: 'cutscene-pulse 2s ease-in-out infinite' }}
        >
          {continueLabel}
        </button>
      )}
    </div>
  )
}
