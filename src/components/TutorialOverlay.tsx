import { useState, useEffect, useRef } from 'react'

// ── Step data ─────────────────────────────────────────────────────────────────

const TUTORIAL_SEEN_KEY = 'fjobhunt:tutorial_seen'

interface TutorialStep {
  id: string
  title: string        // pixel font header
  subtitle: string     // terminal font sub-label
  body: string[]       // terminal font paragraphs; index >0 = privacy/secondary note
}

const STEPS: TutorialStep[] = [
  {
    id: 'quickcast',
    title: 'QUICK CAST',
    subtitle: 'links · resumes',
    body: [
      'Add links for instant copy/paste during applications. Upload up to 3 resumes (A, B, C) for quick reference during your session.',
      'NOTE: Links and resumes are stored securely in the database. Best practices are applied — but if you prefer total privacy, remove personal details before saving.',
    ],
  },
  {
    id: 'music-player',
    title: 'MUSIC',
    subtitle: 'youtube player',
    body: [
      'Built-in YouTube player to stay in the zone. Hover to open the panel, paste any YouTube URL to queue it up.',
      'NOTE: Playlist URLs are stored in the database. Remove them anytime if you prefer.',
    ],
  },
  {
    id: 'workday-bar',
    title: 'WORKDAY',
    subtitle: 'time tracking · breaks',
    body: [
      'Punch in when you start your session, punch out when done. Break reminders fire automatically at scheduled intervals to keep you fresh.',
    ],
  },
  {
    id: 'job-rows',
    title: 'JOB LOG',
    subtitle: 'tracking rows',
    body: [
      'Tab through fields fast. Only Company + Title are required to submit — URL, Salary, Rating, Date, and Status are all optional.',
      'Use the [■] console icon on a row to open the full detail view. Enable DELETE MODE in the toolbar to remove entries.',
    ],
  },
  {
    id: 'navbar',
    title: 'NAVIGATION',
    subtitle: 'pages · settings',
    body: [
      'JOBS = tracker  ·  STATS = analytics  ·  STORY = career journey & rank progression.',
      'Theme switcher and account settings are in the avatar menu (top right). Press ? anytime to replay this tutorial.',
    ],
  },
]

// ── Sounds ────────────────────────────────────────────────────────────────────

function playNext() {
  try {
    const ctx = new AudioContext()
    ;[440, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.connect(gain); gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.06
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.035, t + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
      osc.start(t); osc.stop(t + 0.09)
    })
  } catch { /* blocked */ }
}

function playBack() {
  try {
    const ctx = new AudioContext()
    ;[660, 440].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.connect(gain); gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.06
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.035, t + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
      osc.start(t); osc.stop(t + 0.09)
    })
  } catch { /* blocked */ }
}

function playExit() {
  try {
    const ctx = new AudioContext()
    ;[
      { freq: 880, t: 0,    dur: 0.06, vol: 0.030 },
      { freq: 440, t: 0.07, dur: 0.05, vol: 0.028 },
      { freq: 220, t: 0.13, dur: 0.12, vol: 0.026 },
    ].forEach(({ freq, t, dur, vol }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + t)
      gain.gain.setValueAtTime(0, ctx.currentTime + t)
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + t + 0.005)
      gain.gain.setValueAtTime(vol, ctx.currentTime + t + dur - 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + dur + 0.01)
    })
  } catch { /* blocked */ }
}

// ── Arrow geometry ────────────────────────────────────────────────────────────

// Fixed card dimensions
const CARD_W = 638
const CARD_H = 488

// Given the card center and the spotlight rect midpoint, compute:
// - start point on the card edge (closest edge)
// - end point near the spotlight rect (with gap)
function computeArrow(
  cardCx: number, cardCy: number,
  rect: DOMRect,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const PAD = 10
  const targetCx = rect.left + rect.width / 2
  const targetCy = rect.top + rect.height / 2

  const dx = targetCx - cardCx
  const dy = targetCy - cardCy

  // Card half-dims
  const hw = CARD_W / 2
  const hh = CARD_H / 2

  // Find intersection of ray from card center to target with card border
  let x1: number, y1: number
  if (dx === 0 && dy === 0) return null
  const absDx = Math.abs(dx), absDy = Math.abs(dy)
  if (absDx * hh > absDy * hw) {
    // Hits left or right edge
    const sign = dx > 0 ? 1 : -1
    x1 = cardCx + sign * hw
    y1 = cardCy + dy * (sign * hw / dx)
  } else {
    // Hits top or bottom edge
    const sign = dy > 0 ? 1 : -1
    y1 = cardCy + sign * hh
    x1 = cardCx + dx * (sign * hh / dy)
  }

  // End point: on the near edge of the spotlight rect, with a small gap
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return null
  const ux = dx / len, uy = dy / len

  // Clamp endpoint to a point near the spotlight rect border
  const targetEdgeX = targetCx - ux * (rect.width / 2 + PAD)
  const targetEdgeY = targetCy - uy * (rect.height / 2 + PAD)

  return { x1, y1, x2: targetEdgeX, y2: targetEdgeY }
}

// ── Component ─────────────────────────────────────────────────────────────────

const SPOTLIGHT_PAD = 6

interface Props {
  onDone: () => void
}

export default function TutorialOverlay({ onDone }: Props) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Read target element rect whenever step changes
  useEffect(() => {
    const id = setTimeout(() => {
      const el = document.querySelector(`[data-tutorial="${STEPS[step].id}"]`)
      setRect(el ? el.getBoundingClientRect() : null)
    }, 50)
    return () => clearTimeout(id)
  }, [step])

  // Re-read on resize
  useEffect(() => {
    function onResize() {
      const el = document.querySelector(`[data-tutorial="${STEPS[step].id}"]`)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [step])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { handleSkip(); return }
      if (
        e.key === 'ArrowRight' || e.key === 'ArrowDown' ||
        e.key === 'Enter'      || e.key === ' '
      ) { e.preventDefault(); handleNext(); return }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); handleBack(); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  function markSeen() {
    try { localStorage.setItem(TUTORIAL_SEEN_KEY, 'true') } catch { /* ignore */ }
  }
  function handleNext() {
    if (step < STEPS.length - 1) { playNext(); setStep((s) => s + 1) }
    else handleDone()
  }
  function handleBack() {
    if (step > 0) { playBack(); setStep((s) => s - 1) }
  }
  function handleSkip() { playExit(); markSeen(); onDone() }
  function handleDone() { playExit(); markSeen(); onDone() }

  const vw = window.innerWidth
  const vh = window.innerHeight

  // Card is always centered
  const cardLeft = (vw - CARD_W) / 2
  const cardTop  = (vh - CARD_H) / 2
  const cardCx   = cardLeft + CARD_W / 2
  const cardCy   = cardTop  + CARD_H / 2

  const arrow = rect ? computeArrow(cardCx, cardCy, rect) : null

  const current = STEPS[step]

  return (
    <>
      {/* ── SVG: backdrop + spotlight + arrow ── */}
      <svg
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 9999, width: '100vw', height: '100vh' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="tutorial-mask">
            <rect width="100%" height="100%" fill="white" />
            {/* Spotlight hole */}
            {rect && (
              <rect
                x={rect.left - SPOTLIGHT_PAD}
                y={rect.top - SPOTLIGHT_PAD}
                width={rect.width + SPOTLIGHT_PAD * 2}
                height={rect.height + SPOTLIGHT_PAD * 2}
                fill="black"
              />
            )}
            {/* Card hole — keep card area unmasked so card is always visible */}
            <rect x={cardLeft} y={cardTop} width={CARD_W} height={CARD_H} fill="black" />
          </mask>
        </defs>

        {/* Dark overlay */}
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.74)" mask="url(#tutorial-mask)" />

        {/* Dashed spotlight border */}
        {rect && (
          <rect
            x={rect.left - SPOTLIGHT_PAD}
            y={rect.top - SPOTLIGHT_PAD}
            width={rect.width + SPOTLIGHT_PAD * 2}
            height={rect.height + SPOTLIGHT_PAD * 2}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="1"
            strokeDasharray="4 2"
          />
        )}

        {/* Arrow from card edge to spotlight */}
        {arrow && (
          <>
            <line
              x1={arrow.x1} y1={arrow.y1}
              x2={arrow.x2} y2={arrow.y2}
              stroke="var(--color-primary)"
              strokeWidth="1"
              strokeDasharray="5 3"
              opacity="0.7"
            />
            {/* Arrowhead: small filled triangle at x2,y2 pointing toward target */}
            {(() => {
              const dx = arrow.x2 - arrow.x1
              const dy = arrow.y2 - arrow.y1
              const len = Math.sqrt(dx * dx + dy * dy)
              if (len === 0) return null
              const ux = dx / len, uy = dy / len
              const px = -uy, py = ux // perpendicular
              const size = 6
              const tip = { x: arrow.x2, y: arrow.y2 }
              const b1  = { x: arrow.x2 - ux * size + px * size * 0.45, y: arrow.y2 - uy * size + py * size * 0.45 }
              const b2  = { x: arrow.x2 - ux * size - px * size * 0.45, y: arrow.y2 - uy * size - py * size * 0.45 }
              return (
                <polygon
                  points={`${tip.x},${tip.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`}
                  fill="var(--color-primary)"
                  opacity="0.8"
                />
              )
            })()}
          </>
        )}
      </svg>

      {/* ── Card — always centered ── */}
      <div
        ref={cardRef}
        className="fixed flex flex-col"
        style={{
          zIndex: 10000,
          width:  CARD_W,
          height: CARD_H,
          top:    cardTop,
          left:   cardLeft,
          background: 'var(--color-bg)',
          border: '1px solid var(--color-primary)',
          color:  'var(--color-primary)',
          boxShadow: '0 0 0 1px var(--color-bg), 0 0 12px 3px color-mix(in srgb, var(--color-primary) 30%, transparent)',
        }}
      >
        {/* Header bar — pixel font */}
        <div
          className="px-5 py-2 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <span className="font-pixel text-[7px] tracking-widest text-muted">
            TUTORIAL
          </span>
          {/* Step dots */}
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  width: 5, height: 5,
                  background: i === step ? 'var(--color-primary)' : 'var(--color-border)',
                }}
              />
            ))}
          </div>
          <button
            onClick={handleSkip}
            className="font-pixel text-[7px] text-muted hover:text-primary leading-none"
            title="Skip (Esc)"
          >
            ESC
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-4 pb-2 flex flex-col gap-3 flex-1 min-h-0">
          {/* Step counter — pixel font, small */}
          <p className="font-pixel text-[7px] text-muted tracking-widest">
            STEP {step + 1} / {STEPS.length}
          </p>

          {/* Title — pixel font */}
          <p className="font-pixel text-[10px] tracking-widest leading-relaxed" style={{ color: 'var(--color-secondary)' }}>
            {current.title}
          </p>

          {/* Subtitle — terminal font, muted */}
          <p className="font-terminal text-lg tracking-widest text-muted leading-none">
            {current.subtitle}
          </p>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--color-border)', flexShrink: 0 }} />

          {/* Body paragraphs — terminal font */}
          <div className="flex flex-col gap-2 overflow-hidden">
            {current.body.map((para, i) => (
              <p
                key={i}
                className="font-terminal leading-snug"
                style={{
                  fontSize: '1.05rem',
                  color: i === 0 ? 'var(--color-primary)' : 'var(--color-muted)',
                  opacity: i === 0 ? 1 : 0.8,
                  lineHeight: 1.4,
                }}
              >
                {para}
              </p>
            ))}
          </div>
        </div>

        {/* Footer — pixel font buttons */}
        <div
          className="px-5 py-3 flex items-center gap-2 shrink-0"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            onClick={handleSkip}
            className="font-pixel text-[7px] tracking-widest hover:opacity-70"
            style={{
              color: 'var(--color-muted)',
              border: '1px solid var(--color-border)',
              padding: '3px 7px',
            }}
          >
            SKIP
          </button>

          <p className="font-terminal text-sm text-muted ml-1 leading-none hidden sm:block">
            space / enter
          </p>

          <div className="ml-auto flex items-center gap-1">
            {step > 0 && (
              <button
                onClick={handleBack}
                className="font-pixel text-[7px] tracking-widest hover:opacity-70"
                style={{
                  color: 'var(--color-muted)',
                  border: '1px solid var(--color-border)',
                  padding: '3px 7px',
                }}
              >
                ◀ BACK
              </button>
            )}
            <button
              onClick={handleNext}
              className="font-pixel text-[7px] tracking-widest hover:opacity-80"
              style={{
                color: 'var(--color-bg)',
                background: 'var(--color-primary)',
                padding: '3px 9px',
              }}
            >
              {step < STEPS.length - 1 ? 'NEXT ▶' : 'DONE ✓'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export { TUTORIAL_SEEN_KEY }
