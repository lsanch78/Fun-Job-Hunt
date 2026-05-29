import { useState, useEffect, useRef } from 'react'
import { isSfxMuted, playCreditsBlip } from '@/lib/sfx'
import { supabase } from '@/lib/supabase'
import { fetchJobs } from '@/services/jobService'
import type { Job } from '@/types'
import middleMp3 from '@/assets/music/6-movement.mp3'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScrollingTextCutsceneProps {
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

// ── Midgame text builder ──────────────────────────────────────────────────────

const SCROLL_DURATION = 38000

function buildLines(jobs: Job[]): string[] {
  const total      = jobs.length
  const applied    = jobs.filter(j => j.status === 'APPLIED').length
  const screens    = jobs.filter(j => j.status === 'PHONE_SCREEN').length
  const interviews = jobs.filter(j => j.status === 'INTERVIEW').length
  const offers     = jobs.filter(j => j.status === 'OFFER').length
  const rejected   = jobs.filter(j => j.status === 'REJECTED').length
  const ghosted    = jobs.filter(j => j.status === 'GHOSTED').length
  const totalLabel = total > 0 ? String(total) : 'dozens of'
  const responseRate = total > 0
    ? Math.round(((screens + interviews + offers) / total) * 100)
    : null

  return [
    `You've sent ${totalLabel} applications into the void.`,
    '',
    ...(total > 0 ? [
      'BY THE NUMBERS',
      '',
      ...(applied    > 0 ? [`${applied} still waiting`] : []),
      ...(screens    > 0 ? [`${screens} phone screen${screens === 1 ? '' : 's'}`] : []),
      ...(interviews > 0 ? [`${interviews} interview${interviews === 1 ? '' : 's'}`] : []),
      ...(offers     > 0 ? [`${offers} offer${offers === 1 ? '' : 's'}`] : []),
      ...(rejected   > 0 ? [`${rejected} rejection${rejected === 1 ? '' : 's'}`] : []),
      ...(ghosted    > 0 ? [`${ghosted} ghost${ghosted === 1 ? '' : 'ed you'}`] : []),
      '',
      ...(responseRate !== null ? [`${responseRate}% response rate`, ''] : []),
    ] : []),
    "These numbers are not a reflection of your worth, they are a reflection of the work you're willing to put in.",
    '— F Job Hunt —',
  ]
}

export function Movement({ onComplete }: { onComplete: () => void }) {
  const [jobs, setJobs] = useState<Job[] | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setJobs([]); return }
      fetchJobs(user.id).then(setJobs)
    })
  }, [])

  if (jobs === null) return null

  return (
    <ScrollingTextCutscene
      lines={buildLines(jobs)}
      audioSrc={middleMp3}
      duration={SCROLL_DURATION}
      onComplete={onComplete}
      continueLabel="KEEP GOING  →"
      fadeIn
    />
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScrollingTextCutscene({
  lines,
  audioSrc,
  duration,
  onComplete,
  continueLabel = 'CONTINUE  →',
  fadeIn = false,
}: ScrollingTextCutsceneProps) {
  const [scrollDone, setScrollDone] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Skip on Enter or Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        playCreditsBlip()
        onComplete()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onComplete])

  // Play audio on mount
  useEffect(() => {
    if (!audioSrc) return
    const audio = new Audio(audioSrc)
    audioRef.current = audio
    if (!isSfxMuted()) {
      audio.volume = 0.8
      audio.play().catch(() => {})
    }
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
