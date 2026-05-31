import { useEffect, useRef, useState, useMemo } from 'react'
import { isSfxMuted, playDialogueTick, playDialogueConfirm, startRain, playThunder } from '@/lib/sfx'
import introMp3 from '@/assets/music/1-intro.mp3'

if (typeof document !== 'undefined' && !document.getElementById('story-demo-keyframes')) {
  const el = document.createElement('style')
  el.id = 'story-demo-keyframes'
  el.textContent = `
@keyframes story-demo-fadein {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes story-demo-cursor {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
@keyframes story-demo-prompt {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}
@keyframes story-demo-lightning {
  0%   { opacity: 0; }
  5%   { opacity: 0.18; }
  10%  { opacity: 0.02; }
  16%  { opacity: 0.12; }
  30%  { opacity: 0.06; }
  100% { opacity: 0; }
}
@keyframes story-demo-rain {
  0%   { transform: translateY(-40px); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateY(460px); opacity: 0; }
}
@keyframes story-demo-scanlines {
  0%   { background-position: 0 0; }
  100% { background-position: 0 8px; }
}
@keyframes story-demo-sweep {
  0%   { top: -6px; opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
`
  document.head.appendChild(el)
}

// ── Script ─────────────────────────────────────────────────────────────────────
const DEMO_NAME = 'Hunter'

const BASE_LINES: { speaker: string; text: string }[] = [
  { speaker: 'Mysterious Voice', text: "Oh look what we have here." },
  { speaker: 'Mysterious Voice', text: "No one is going to call you back." },
  { speaker: 'Mysterious Voice', text: "Do you really think you're good enough for these roles?" },
  { speaker: 'Mysterious Voice', text: `You're one of 4 million other job hunters, what makes you so special?` },
  { speaker: 'Mysterious Voice', text: `What's your name anyways?` },
  { speaker: 'Mysterious Voice', text: `Come talk to me when you have more experience.` },
  { speaker: 'Mysterious Voice', text: `__NAME_LINE__` },
]

function buildLines(name: string) {
  return BASE_LINES.map(l =>
    l.text === '__NAME_LINE__'
      ? { ...l, text: `Get it, ${name || DEMO_NAME}? More experience? HAHA` }
      : l
  )
}

// ── Rain drops ─────────────────────────────────────────────────────────────────
const DROP_COUNT = 80
interface Drop { id: number; left: number; height: number; delay: number; duration: number; opacity: number; width: number }
function generateDrops(): Drop[] {
  return Array.from({ length: DROP_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    height: 10 + Math.random() * 20,
    delay: -(Math.random() * 3),
    duration: 1.0 + Math.random() * 1.0,
    opacity: 0.12 + Math.random() * 0.28,
    width: Math.random() < 0.5 ? 1 : 2,
  }))
}

const CHAR_MS = 28
const TICK_EVERY = 2

// ── Component ──────────────────────────────────────────────────────────────────
export default function StoryDemo({ mouse, index = 0, expanded = false, active = true }: { mouse: { x: number; y: number }; index?: number; expanded?: boolean; active?: boolean }) {
  const [revealed, setRevealed] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [streaming, setStreaming] = useState(false)
  const [lightning, setLightning] = useState(false)
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const [rainOpacity, setRainOpacity] = useState(1)
  const [inputName, setInputName] = useState('')
  const [playerName, setPlayerName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const LINES = buildLines(playerName)

  const drops = useMemo(generateDrops, [])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const thunderTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const lastClickRef = useRef(0)
  const startedRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 1800)
    return () => clearTimeout(t)
  }, [])

  const stopRainRef = useRef<(() => void) | null>(null)

  function startRainAndThunder() {
    if (stopRainRef.current) return // already running
    stopRainRef.current = startRain()
    let t = 2500 + Math.random() * 3000
    const timers: ReturnType<typeof setTimeout>[] = []
    while (t < 90_000) {
      const delay = t
      const intensity = 0.5 + Math.random() * 0.5
      timers.push(setTimeout(() => {
        playThunder(intensity)
        setLightning(true)
        setTimeout(() => setLightning(false), 2000)
      }, delay))
      t += 7000 + Math.random() * 12000
    }
    thunderTimers.current = timers
  }

  function stopRainAndThunder() {
    stopRainRef.current?.()
    stopRainRef.current = null
    thunderTimers.current.forEach(clearTimeout)
    thunderTimers.current = []
  }

  useEffect(() => {
    return () => stopRainAndThunder()
  }, [])

  // Fade out music when panel goes inactive
  useEffect(() => {
    if (active) return
    const audio = audioRef.current
    if (!audio || audio.paused) return
    const step = 50
    const duration = 800
    const initialVol = audio.volume
    let elapsed = 0
    const id = setInterval(() => {
      elapsed += step
      audio.volume = Math.max(0, initialVol * (1 - elapsed / duration))
      if (elapsed >= duration) { clearInterval(id); audio.pause(); audio.volume = initialVol }
    }, step)
    return () => clearInterval(id)
  }, [active])

  // Stream current line — only after user has started
  useEffect(() => {
    if (!started) return
    setCharIndex(0)
    setStreaming(true)
  }, [started, lineIndex])

  useEffect(() => {
    if (!streaming) return
    const text = LINES[lineIndex]?.text ?? ''
    intervalRef.current = setInterval(() => {
      setCharIndex(prev => {
        const next = prev + 1
        const ch = text[prev]
        if (ch && ch !== ' ' && next % TICK_EVERY === 0) playDialogueTick()
        if (next >= text.length) {
          clearInterval(intervalRef.current!)
          setStreaming(false)
          return text.length
        }
        return next
      })
    }, CHAR_MS)
    return () => clearInterval(intervalRef.current!)
  }, [streaming, lineIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const INPUT_LINE = 4
  const isInputLine = lineIndex === INPUT_LINE

  // Focus the name input once the prompt finishes streaming
  useEffect(() => {
    if (lineIndex === INPUT_LINE && !streaming) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [lineIndex, streaming])

  function fadeOutAudio() {
    const audio = audioRef.current
    const DURATION = 1800
    const STEP = 50
    // fade music
    if (audio && !audio.paused) {
      const initialVol = audio.volume
      let elapsed = 0
      const id = setInterval(() => {
        elapsed += STEP
        audio.volume = Math.max(0, initialVol * (1 - elapsed / DURATION))
        if (elapsed >= DURATION) { clearInterval(id); audio.pause(); audio.volume = initialVol }
      }, STEP)
    }
    // stop thunder immediately, fade rain visually
    stopRainAndThunder()
    const start = performance.now()
    function fadeRain(ts: number) {
      const t = Math.min((ts - start) / DURATION, 1)
      setRainOpacity(1 - t)
      if (t < 1) requestAnimationFrame(fadeRain)
    }
    requestAnimationFrame(fadeRain)
  }

  function startMusic() {
    if (startedRef.current) return
    startedRef.current = true
    startRainAndThunder()
    const audio = new Audio(introMp3)
    audio.volume = isSfxMuted() ? 0 : 0.55
    audio.play().catch(() => {})
    audioRef.current = audio
  }

  function handleClick() {
    if (done) return
    // on input line, only allow snap-to-full while streaming; input handles submission
    if (isInputLine && !streaming) return
    const now = Date.now()
    if (now - lastClickRef.current < 300) return
    lastClickRef.current = now

    if (!started) {
      startMusic()
      setStarted(true)
      return
    }

    playDialogueConfirm()

    // If still streaming — snap to full text
    if (streaming) {
      clearInterval(intervalRef.current!)
      setCharIndex(LINES[lineIndex].text.length)
      setStreaming(false)
      return
    }

    // On last line — fade out music + rain, then show done screen
    if (isLast) {
      fadeOutAudio()
      setDone(true)
      return
    }

    setLineIndex(l => l + 1)
  }

  function handleNameSubmit() {
    const name = inputName.trim()
    if (!name) return
    setPlayerName(name)
    playDialogueConfirm()
    setInputName('')
    setLineIndex(l => l + 1)
  }

  function handleReplay() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    stopRainAndThunder()
    startedRef.current = false
    setStarted(false)
    setRainOpacity(1)
    setDone(false)
    setLineIndex(0)
    setCharIndex(0)
    setInputName('')
    setPlayerName('')
  }

  const TILT_MAX = 3
  const depth = 1 + index * 0.4
  const rotX = -mouse.y * TILT_MAX * depth
  const rotY = mouse.x * TILT_MAX * depth

  const currentLine = LINES[lineIndex]
  const displayedText = currentLine?.text.slice(0, charIndex) ?? ''
  const isLast = lineIndex === LINES.length - 1

  return (
    <div
      style={{
        transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
        transition: 'transform 0.12s linear',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <div
        aria-hidden
        style={{ position: 'absolute', inset: 0, transform: 'translateZ(-60px)', background: 'var(--color-border)', opacity: 0.8 }}
      />

      <div
        className="border border-border bg-black font-pixel text-primary overflow-hidden select-none"
        style={{ transform: 'translateZ(0)', position: 'relative', height: expanded ? '840px' : '420px', transition: 'height 0.4s ease', cursor: 'pointer' }}
        onClick={handleClick}
      >
        {!revealed && (
          <div className="absolute left-0 w-full h-1.5 bg-secondary z-10"
            style={{ opacity: 0.7, animation: 'story-demo-sweep 0.6s linear infinite', top: '-6px' }} />
        )}

        {/* Rain */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1, opacity: rainOpacity, transition: 'none' }}>
          {drops.map(d => (
            <div key={d.id} style={{
              position: 'absolute', left: `${d.left}%`, top: 0,
              width: d.width, height: d.height,
              background: `hsl(0,0%,${55 + Math.floor(d.opacity * 100)}%)`,
              opacity: d.opacity,
              animation: `story-demo-rain ${d.duration}s ${d.delay}s linear infinite`,
            }} />
          ))}
        </div>

        {/* Lightning */}
        {lightning && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2, background: '#888', animation: 'story-demo-lightning 2.0s ease-out forwards' }} />
        )}

        {/* Content */}
        <div className="relative flex flex-col justify-end h-full" style={{ zIndex: 3, padding: '24px' }}>

          {/* Done screen */}
          {done && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6"
              style={{ animation: 'story-demo-fadein 0.6s ease-in forwards' }}>
              <div className="text-center">
                <p className="text-secondary text-2xl mb-4">★</p>
                <p className="text-[10px] text-primary tracking-widest mb-2">YOUR STORY AWAITS</p>
                <p className="text-[9px] text-muted leading-relaxed max-w-xs text-center">
                  Sign up to unlock your full story — cutscenes, original music, and a narrative that grows with your hunt.
                </p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleReplay() }}
                className="text-[9px] text-muted border border-border px-4 py-2 hover:border-secondary hover:text-secondary transition-none"
                style={{ cursor: 'pointer' }}
              >
                ↺ REPLAY
              </button>
            </div>
          )}

          {/* Click to start */}
          {!done && !started && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4"
              style={{ animation: 'story-demo-fadein 0.8s ease-in forwards' }}>
              <p className="text-[9px] text-muted tracking-widest"
                style={{ animation: 'story-demo-prompt 1.8s ease-in-out infinite' }}>
                ▶ CLICK TO START
              </p>
            </div>
          )}

          {/* Active scene */}
          {!done && started && (
            <div className="flex flex-col gap-3 w-full max-w-lg mx-auto">
              <div className="text-[9px] text-secondary tracking-widest px-1">{currentLine?.speaker}</div>

              <div className="border-2 border-primary bg-black p-5 flex flex-col justify-between gap-4" style={{ minHeight: '160px' }}>
                <p className="text-xs text-primary leading-relaxed">
                  {displayedText}
                  {streaming && <span style={{ animation: 'story-demo-cursor 0.6s step-start infinite' }}>▍</span>}
                </p>

                <div className="min-h-[28px] flex flex-col justify-end gap-2">
                  {/* Name input — shown on input line after prompt finishes */}
                  {isInputLine && !streaming && (
                    <>
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputName}
                        onChange={e => setInputName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleNameSubmit() } e.stopPropagation() }}
                        onClick={e => e.stopPropagation()}
                        maxLength={24}
                        placeholder="enter your name"
                        className="bg-transparent border border-primary text-primary text-xs px-3 py-2 outline-none placeholder:text-muted w-full"
                        style={{ fontFamily: '"Press Start 2P", monospace', caretColor: 'var(--color-primary)' }}
                      />
                      <button
                        onClick={e => { e.stopPropagation(); handleNameSubmit() }}
                        disabled={!inputName.trim()}
                        className="self-end text-[9px] text-muted border border-muted px-3 py-1 disabled:opacity-30"
                        style={{ cursor: 'pointer', animation: inputName.trim() ? 'story-demo-prompt 1.2s ease-in-out infinite' : undefined }}
                      >
                        [ ENTER ] confirm
                      </button>
                    </>
                  )}

                  {/* Advance prompt for all other lines */}
                  {!isInputLine && !streaming && (
                    <div className="text-[9px] text-muted self-end" style={{ animation: 'story-demo-prompt 1.2s ease-in-out infinite' }}>
                      {isLast ? '[ click ] finish' : '[ click ] next'}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[9px] text-muted text-right px-1">
                {lineIndex + 1} / {LINES.length}
              </div>
            </div>
          )}
        </div>

        {/* CRT scanlines */}
        {revealed && (
          <div className="absolute inset-0 pointer-events-none" style={{
            zIndex: 10,
            backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.14) 3px, rgba(0,0,0,0.14) 4px)',
            animation: 'story-demo-scanlines 0.3s linear infinite',
            mixBlendMode: 'multiply',
          }} />
        )}
      </div>
    </div>
  )
}
