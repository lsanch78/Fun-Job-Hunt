import { useEffect, useRef, useState, useMemo } from 'react'
import { isSfxMuted, playDialogueTick, playDialogueConfirm, startRain, playThunder } from '@/lib/sfx'
import introMp3 from '@/assets/music/1-intro.mp3'

// ── Keyframes injected once ────────────────────────────────────────────────────
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
  100% { transform: translateY(100%); opacity: 0; }
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

// ── Scene script — mirrors 1-Intro.tsx exactly ─────────────────────────────────
type Step =
  | { kind: 'lines'; lines: { speaker: string; text: string }[] }
  | { kind: 'input'; speaker: string; prompt: string; placeholder: string }
  | { kind: 'lines-fn'; lines: (name: string) => { speaker: string; text: string }[] }

const STEPS: Step[] = [
  {
    kind: 'lines',
    lines: [
      { speaker: 'Mysterious Voice', text: "Oh look what we have here." },
      { speaker: 'Mysterious Voice', text: 'No one is going to call you back.' },
      { speaker: 'Mysterious Voice', text: "Do you really think you're good enough for these roles?" },
      { speaker: 'Mysterious Voice', text: "You're one of 4 million other job hunters, what makes you so special?" },
    ],
  },
  {
    kind: 'input',
    speaker: 'Mysterious Voice',
    prompt: "What's your name anyways?",
    placeholder: 'enter your name',
  },
  {
    kind: 'lines-fn',
    lines: (name) => [
      { speaker: 'Mysterious Voice', text: 'Come talk to me when you have more experience.' },
      { speaker: 'Mysterious Voice', text: `Get it, ${name}? More experience? HAHA` },
    ],
  },
]

// ── Rain drops — generated once ───────────────────────────────────────────────
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

const CHAR_MS = 35
const TICK_EVERY = 2

// ── Component ──────────────────────────────────────────────────────────────────
export default function StoryDemo({ mouse }: { mouse: { x: number; y: number } }) {
  const [revealed, setRevealed] = useState(false)
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [lineIndex, setLineIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [streaming, setStreaming] = useState(false)
  const [lightning, setLightning] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [inputSubmitted, setInputSubmitted] = useState(false)
  const [playerName, setPlayerName] = useState('')

  const drops = useMemo(generateDrops, [])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const thunderTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const pressCount = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 1800)
    return () => clearTimeout(t)
  }, [])

  // Resolve current step + line
  const currentStep = STEPS[stepIndex] as Step | undefined
  const currentLines: { speaker: string; text: string }[] = (() => {
    if (!currentStep) return []
    if (currentStep.kind === 'lines') return currentStep.lines
    if (currentStep.kind === 'lines-fn') return currentStep.lines(playerName)
    return []
  })()
  const currentLine = currentLines[lineIndex]
  const isInputStep = currentStep?.kind === 'input'
  const isLastLine = !isInputStep && lineIndex === currentLines.length - 1
  const displayedText = isInputStep
    ? (currentStep as Extract<Step, { kind: 'input' }>).prompt.slice(0, charIndex)
    : currentLine?.text.slice(0, charIndex) ?? ''
  const currentSpeaker = isInputStep
    ? (currentStep as Extract<Step, { kind: 'input' }>).speaker
    : currentLine?.speaker

  // Start rain + thunder when scene starts
  useEffect(() => {
    if (!started) return
    const stopRain = startRain()
    // Thunder events
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
    return () => { stopRain(); timers.forEach(clearTimeout) }
  }, [started])

  // Stream text char by char whenever step/line changes
  useEffect(() => {
    if (!started) return
    setCharIndex(0)
    setStreaming(true)
  }, [started, stepIndex, lineIndex])

  useEffect(() => {
    if (!streaming) return
    const text = isInputStep
      ? (currentStep as Extract<Step, { kind: 'input' }>).prompt
      : currentLine?.text ?? ''

    intervalRef.current = setInterval(() => {
      setCharIndex(prev => {
        const next = prev + 1
        const ch = text[prev]
        if (ch && ch !== ' ' && next % TICK_EVERY === 0) playDialogueTick()
        if (next >= text.length) {
          clearInterval(intervalRef.current!)
          setStreaming(false)
          if (isInputStep) setTimeout(() => inputRef.current?.focus(), 50)
          return text.length
        }
        return next
      })
    }, CHAR_MS)
    return () => clearInterval(intervalRef.current!)
  }, [streaming, stepIndex, lineIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  function startMusic() {
    if (pressCount.current > 0) return
    pressCount.current = 1
    const audio = new Audio(introMp3)
    audio.volume = isSfxMuted() ? 0 : 0.55
    audio.play().catch(() => {})
    audioRef.current = audio
  }

  function handleStart() {
    startMusic()
    setStarted(true)
  }

  function advance() {
    if (!started) return
    playDialogueConfirm()
    if (streaming) {
      clearInterval(intervalRef.current!)
      const text = isInputStep
        ? (currentStep as Extract<Step, { kind: 'input' }>).prompt
        : currentLine?.text ?? ''
      setCharIndex(text.length)
      setStreaming(false)
      if (isInputStep) setTimeout(() => inputRef.current?.focus(), 50)
      return
    }
    if (isInputStep) return // handled by submit
    if (isLastLine) {
      // Advance to next step
      if (stepIndex >= STEPS.length - 1) {
        audioRef.current?.pause()
        setDone(true)
      } else {
        setStepIndex(s => s + 1)
        setLineIndex(0)
      }
    } else {
      setLineIndex(l => l + 1)
    }
  }

  function handleInputSubmit() {
    const trimmed = inputValue.trim()
    if (!trimmed || inputSubmitted) return
    setInputSubmitted(true)
    setPlayerName(trimmed)
    playDialogueConfirm()
    setTimeout(() => {
      setStepIndex(s => s + 1)
      setLineIndex(0)
      setInputValue('')
      setInputSubmitted(false)
    }, 200)
  }

  // Keyboard handler — only active after scene has started
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!started) return
      if (isInputStep && !streaming) return // let input field handle it
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started, streaming, stepIndex, lineIndex, isInputStep, isLastLine]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tilt
  const TILT_MAX = 3
  const rotX = -mouse.y * TILT_MAX
  const rotY = mouse.x * TILT_MAX

  return (
    <div
      style={{
        transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
        transition: 'transform 0.12s linear',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        position: 'relative',
      }}
    >
      {/* depth shadow */}
      <div
        aria-hidden
        style={{ position: 'absolute', inset: 0, transform: 'translateZ(-20px)', background: 'var(--color-border)', opacity: 0.5 }}
      />

      {/* CRT panel */}
      <div
        className="border border-border bg-black font-pixel text-primary overflow-hidden"
        style={{ transform: 'translateZ(0)', position: 'relative', minHeight: '340px', cursor: started && !done ? 'pointer' : 'default' }}
        onClick={() => { if (started && !done && (!isInputStep || streaming)) advance() }}
      >
        {/* loading sweep */}
        {!revealed && (
          <div className="absolute left-0 w-full h-1.5 bg-secondary z-10"
            style={{ opacity: 0.7, animation: 'story-demo-sweep 0.6s linear infinite', top: '-6px' }} />
        )}

        {/* Rain */}
        {started && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
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
        )}

        {/* Lightning flash */}
        {lightning && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2, background: '#888', animation: 'story-demo-lightning 2.0s ease-out forwards' }} />
        )}

        {/* ── Content ─────────────────────────────────────────────── */}
        <div className="relative flex flex-col justify-end h-full" style={{ zIndex: 3, minHeight: '340px', padding: '24px' }}>

          {/* Title screen — before start */}
          {!started && !done && (
            <div className="flex-1 flex flex-col items-center justify-center gap-8"
              style={{ animation: 'story-demo-fadein 0.6s ease-in forwards' }}>
              <div className="text-center">
                <p className="text-[9px] text-secondary tracking-widest mb-4">CHAPTER 1</p>
                <h2 className="text-xl text-primary mb-2">DESTITUTE JOB SEEKER</h2>
                <p className="text-[9px] text-muted tracking-widest">— AN ORIGINAL STORY —</p>
              </div>
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={e => { e.stopPropagation(); handleStart() }}
                  className="px-8 py-3 border border-primary text-primary text-xs hover:bg-primary hover:text-bg transition-colors"
                  style={{ animation: 'story-demo-prompt 1.8s ease-in-out infinite' }}
                >
                  ▶ START STORY DEMO
                </button>
                <p className="text-[8px] text-muted text-center max-w-xs leading-relaxed">
                  ♪ Features all original music composed for the hunt
                </p>
              </div>
            </div>
          )}

          {/* Done screen */}
          {done && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6"
              style={{ animation: 'story-demo-fadein 0.6s ease-in forwards' }}>
              <div className="text-center">
                <p className="text-secondary text-2xl mb-4">★</p>
                <p className="text-[10px] text-primary tracking-widest mb-2">YOUR STORY AWAITS</p>
                <p className="body-text text-muted text-sm leading-relaxed max-w-xs text-center">
                  Sign up to unlock your full story — cutscenes, original music, and a narrative that grows with your hunt.
                </p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setDone(false); setStarted(false); setStepIndex(0); setLineIndex(0); setPlayerName(''); pressCount.current = 0 }}
                className="text-[9px] text-muted border border-border px-4 py-2 hover:border-secondary hover:text-secondary transition-none"
              >
                ↺ REPLAY
              </button>
            </div>
          )}

          {/* Active scene */}
          {started && !done && (
            <div className="flex flex-col gap-3 w-full max-w-lg mx-auto">
              {/* Speaker */}
              {currentSpeaker && (
                <div className="text-[9px] text-secondary tracking-widest px-1">{currentSpeaker}</div>
              )}

              {/* Dialogue box */}
              <div className="border-2 border-primary bg-black p-5 flex flex-col justify-between gap-4" style={{ minHeight: '160px' }}>
                <p className="text-xs text-primary leading-relaxed">
                  {displayedText}
                  {streaming && <span style={{ animation: 'story-demo-cursor 0.6s step-start infinite' }}>▍</span>}
                </p>

                <div className="min-h-[28px] flex flex-col justify-end gap-2">
                  {/* Input step — name entry */}
                  {isInputStep && !streaming && (
                    <>
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInputSubmit() } e.stopPropagation() }}
                        onClick={e => e.stopPropagation()}
                        maxLength={24}
                        placeholder="enter your name"
                        disabled={inputSubmitted}
                        className="bg-transparent border border-primary text-primary text-xs px-3 py-2 outline-none placeholder:text-muted w-full"
                        style={{ fontFamily: '"Press Start 2P", monospace', caretColor: 'var(--color-primary)' }}
                      />
                      <button
                        onClick={e => { e.stopPropagation(); handleInputSubmit() }}
                        disabled={!inputValue.trim() || inputSubmitted}
                        className="self-end text-[9px] text-muted border border-muted px-3 py-1 disabled:opacity-30"
                        style={{ animation: inputValue.trim() && !inputSubmitted ? 'story-demo-prompt 1.2s ease-in-out infinite' : undefined }}
                      >
                        [ ENTER ] confirm
                      </button>
                    </>
                  )}

                  {/* Advance prompt */}
                  {!isInputStep && !streaming && (
                    <div className="text-[9px] text-muted self-end"
                      style={{ animation: 'story-demo-prompt 1.2s ease-in-out infinite' }}>
                      {isLastLine && stepIndex >= STEPS.length - 1 ? '[ ENTER ] finish' : '[ ENTER ] next'}
                    </div>
                  )}
                </div>
              </div>

              {/* Line counter */}
              <div className="text-[9px] text-muted text-right px-1">
                {isInputStep ? '?' : `${lineIndex + 1} / ${currentLines.length}`}
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
