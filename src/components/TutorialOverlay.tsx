import { useState, useEffect, useRef } from 'react'
import { playBootBlip, playExitBlip, playTutorialPage as playPage } from '@/lib/sfx'
import { T, ensureCrtStyles, crtTextShadow, crtBoxShadow, CRT_FONT } from '@/lib/crtTheme'
import { lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'

ensureCrtStyles()

// Kept for backward compat — callers (JobLogPage, MobileJobLogPage) read with raw localStorage
export const TUTORIAL_SEEN_KEY = SK.tutorialSeen

// ── Step data ─────────────────────────────────────────────────────────────────

interface TutorialStep {
  id: string
  title: string        // pixel font header
  subtitle: string     // terminal font sub-label
  body: string[]       // terminal font paragraphs; index >0 = privacy/secondary note
}

const MOBILE_STEPS: TutorialStep[] = [
  {
    id: 'navbar',
    title: 'WELCOME',
    subtitle: 'mobile companion',
    body: [
      'Welcome to the mobile companion of FJobhunt. Use this to access your job history on the go or quickly log new applications you just applied to.',
      'This is meant to be a companion to the full FJobhunt experience on desktop — for quick reference, jotting down notes for yourself, or tracking applications to edit later.',
    ],
  },
  {
    id: 'job-rows',
    title: 'JOB LOG',
    subtitle: 'tap · add · filter',
    body: [
      'Tap any row to open the full detail view. Use the + button to log a new application fast. The ⋮ menu on each row lets you delete entries.',
      'Use the FILTER button to sort and filter by time range or status. Everything syncs automatically to your account.',
    ],
  },
]

const STEPS: TutorialStep[] = [
  {
    id: 'navbar',
    title: 'WELCOME',
    subtitle: 'new user detected',
    body: [
      "Welcome to Fun Job Hunt! Press Space Bar to go through this short tutorial. It's designed to get you up to speed quickly, so you can start tracking your job applications and career progress with ease. Let's dive in!",
    ],
  },
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
    subtitle: 'time tracking',
    body: [
      'Time tracking is automatic — your session starts the moment you interact with the app and stops after 60 minutes of inactivity. No punching in or out required.',
      'NOTE: The bar shows TRACKING while active and IDLE after 15 minutes without interaction.',
    ],
  },
  {
    id: 'job-rows',
    title: 'JOB LOG',
    subtitle: 'tracking rows',
    body: [
      'Tab through fields fast. Only Company + Title are required to submit — URL, Salary, Rating, Date, and Status are all optional. Columns are fully customizable — show, hide, and reorder them to match exactly how you like to track jobs.',
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
  {
    id: 'ai-assistant',
    title: 'AI ASSISTANT',
    subtitle: 'claude haiku · ready to use',
    body: [
      'The AI button opens a resume assistant powered by Claude Haiku — fast, capable, and perfect for resume tailoring, cover letter bullets, and interview prep. Everybody gets 5 free uses a month, no setup required.',
      'PRO TIP: Premium users get unlimited use for 8$/month. Tech savvy? Add your own ChatGPT or Claude API key in Settings to choose your model and stretch your dollar further.',
    ],
  },
  {
    id: 'journal',
    title: 'SCRATCHPAD',
    subtitle: 'journal · daily checklist',
    body: [
      'A persistent workspace at the bottom of the screen. The NOTES tab is a free-form journal for thoughts, prep notes, and reminders. The CHECKLIST tab is a drag-to-reorder daily task list — add items, check them off, and clear completed ones anytime.',
      'NOTE: Drag the handle to resize the panel. Your notes and checklist sync automatically to your account.',
    ],
  },
]



// ── Arrow geometry ────────────────────────────────────────────────────────────

// Given the card center and the spotlight rect midpoint, compute:
// - start point on the card edge (closest edge)
// - end point near the spotlight rect (with gap)
function computeArrow(
  cardCx: number, cardCy: number,
  rect: DOMRect,
  cardW: number, cardH: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const PAD = 10
  const targetCx = rect.left + rect.width / 2
  const targetCy = rect.top + rect.height / 2

  const dx = targetCx - cardCx
  const dy = targetCy - cardCy

  // Card half-dims
  const hw = cardW / 2
  const hh = cardH / 2

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
  userId: string
  mobileMode?: boolean
}

export default function TutorialOverlay({ onDone, userId, mobileMode = false }: Props) {
  const activeSteps = mobileMode ? MOBILE_STEPS : STEPS
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Play boot sound on mount
  useEffect(() => { playBootBlip() }, [])

  // Read target element rect whenever step changes
  useEffect(() => {
    const id = setTimeout(() => {
      const el = document.querySelector(`[data-tutorial="${activeSteps[step].id}"]`)
      setRect(el ? el.getBoundingClientRect() : null)
    }, 50)
    return () => clearTimeout(id)
  }, [step])

  // Re-read on resize
  useEffect(() => {
    function onResize() {
      const el = document.querySelector(`[data-tutorial="${activeSteps[step].id}"]`)
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
    lsSet(SK.tutorialSeen(userId), true)
  }
  function handleNext() {
    if (step < activeSteps.length - 1) { playPage('forward'); setStep((s) => s + 1) }
    else handleDone()
  }
  function handleBack() {
    if (step > 0) { playPage('back'); setStep((s) => s - 1) }
  }
  function handleSkip() { playExitBlip(); markSeen(); onDone() }
  function handleDone() { playExitBlip(); markSeen(); onDone() }

  const vw = window.innerWidth
  const vh = window.innerHeight

  // Responsive card dimensions
  const cardW = mobileMode ? Math.min(vw - 24, 360) : 720
  const cardH = mobileMode ? Math.min(vh - 80, 460) : 540

  // Card is always centered
  const cardLeft = (vw - cardW) / 2
  const cardTop  = (vh - cardH) / 2
  const cardCx   = cardLeft + cardW / 2
  const cardCy   = cardTop  + cardH / 2

  const arrow = rect ? computeArrow(cardCx, cardCy, rect, cardW, cardH) : null

  const current = activeSteps[step]

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
            <rect x={cardLeft} y={cardTop} width={cardW} height={cardH} fill="black" />
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
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 10000, pointerEvents: 'none' }}>
      <div
        ref={cardRef}
        className="crt-card flex flex-col"
        style={{
          pointerEvents: 'auto',
          width:  cardW,
          height: cardH,
          fontFamily: '"VT323", monospace',
          background: T.bg,
          border: `1px solid ${T.border}`,
          color: T.green,
          borderRadius: '8px',
          textShadow: crtTextShadow,
          animation: 'console-boot 0.35s ease-out forwards, crt-flicker 8s steps(1,end) 0.35s infinite',
          boxShadow: crtBoxShadow,
        }}
      >
        {/* Header bar */}
        <div
          className="px-5 py-2 flex items-center justify-between shrink-0"
          style={{ borderBottom: `1px solid ${T.border}` }}
        >
          <span style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, letterSpacing: '0.1em' }}>
            // TUTORIAL
          </span>
          {/* Step dots */}
          <div className="flex items-center gap-1">
            {activeSteps.map((_, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  width: 5, height: 5,
                  background: i === step ? T.green : T.border,
                }}
              />
            ))}
          </div>
          <button
            onClick={handleSkip}
            style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"VT323", monospace' }}
            title="Skip (Esc)"
          >
            ESC
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-4 pb-2 flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
          {/* Step counter */}
          <p style={{ color: T.greenDim, fontSize: CRT_FONT.label, letterSpacing: '0.1em' }}>
            STEP {step + 1} / {activeSteps.length}
          </p>

          {/* Title */}
          <p style={{ color: T.green, fontSize: CRT_FONT.title, letterSpacing: '0.1em' }}>
            {current.title}
          </p>

          {/* Subtitle */}
          <p style={{ color: T.greenDim, fontSize: CRT_FONT.sub, letterSpacing: '0.08em' }}>
            {current.subtitle}
          </p>

          {/* Divider */}
          <div style={{ height: 1, background: T.border, flexShrink: 0 }} />

          {/* Body paragraphs */}
          <div className="flex flex-col gap-2 overflow-hidden">
            {current.body.map((para, i) => (
              <p
                key={i}
                style={{
                  fontFamily: '"VT323", monospace',
                  fontSize: CRT_FONT.body,
                  color: i === 0 ? T.green : T.greenDim,
                  opacity: i === 0 ? 1 : 0.85,
                  lineHeight: 1.4,
                }}
              >
                {para}
              </p>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex items-center gap-2 shrink-0"
          style={{ borderTop: `1px solid ${T.border}` }}
        >
          <button
            onClick={handleSkip}
            style={{
              fontFamily: '"VT323", monospace',
              fontSize: CRT_FONT.btn,
              color: T.greenDim,
              background: 'transparent',
              border: `1px solid ${T.border}`,
              padding: mobileMode ? '6px 14px' : '1px 8px',
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            SKIP
          </button>

          <p style={{ fontFamily: '"VT323", monospace', fontSize: CRT_FONT.btn, color: T.greenDim, marginLeft: '4px' }} className="hidden sm:block">
            space / enter
          </p>

          <div className="ml-auto flex items-center gap-1">
            {step > 0 && (
              <button
                onClick={handleBack}
                style={{
                  fontFamily: '"VT323", monospace',
                  fontSize: CRT_FONT.btn,
                  color: T.greenDim,
                  background: 'transparent',
                  border: `1px solid ${T.border}`,
                  padding: mobileMode ? '6px 14px' : '1px 8px',
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                }}
              >
                ◀ BACK
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                fontFamily: '"VT323", monospace',
                fontSize: CRT_FONT.btn,
                color: T.bg,
                background: T.green,
                border: `1px solid ${T.green}`,
                padding: mobileMode ? '6px 16px' : '1px 10px',
                cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              {step < activeSteps.length - 1 ? 'NEXT ▶' : 'DONE ✓'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}

