import { useState, useEffect, useRef } from 'react'
import { playBootBlip, playExitBlip, playTutorialPage as playPage } from '@/lib/sfx'
import { T, ensureCrtStyles, crtTextShadow, crtBoxShadow, CRT_FONT } from '@/lib/crtTheme'
import { lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import type { TutorialStep } from '@/lib/tutorialSteps'

ensureCrtStyles()

// ── Arrow geometry ────────────────────────────────────────────────────────────

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

  const hw = cardW / 2
  const hh = cardH / 2

  let x1: number, y1: number
  if (dx === 0 && dy === 0) return null
  const absDx = Math.abs(dx), absDy = Math.abs(dy)
  if (absDx * hh > absDy * hw) {
    const sign = dx > 0 ? 1 : -1
    x1 = cardCx + sign * hw
    y1 = cardCy + dy * (sign * hw / dx)
  } else {
    const sign = dy > 0 ? 1 : -1
    y1 = cardCy + sign * hh
    x1 = cardCx + dx * (sign * hh / dy)
  }

  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return null
  const ux = dx / len, uy = dy / len

  const targetEdgeX = targetCx - ux * (rect.width / 2 + PAD)
  const targetEdgeY = targetCy - uy * (rect.height / 2 + PAD)

  return { x1, y1, x2: targetEdgeX, y2: targetEdgeY }
}

// ── Component ─────────────────────────────────────────────────────────────────

const SPOTLIGHT_PAD = 6

interface Props {
  steps: TutorialStep[]
  screen: string
  userId: string
  onDone: () => void
  compact?: boolean
}

export default function TutorialModal({ steps, screen, userId, onDone, compact = false }: Props) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => { playBootBlip() }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      const el = document.querySelector(`[data-tutorial="${steps[step].id}"]`)
      setRect(el ? el.getBoundingClientRect() : null)
    }, 50)
    return () => clearTimeout(id)
  }, [step, steps])

  useEffect(() => {
    function onResize() {
      const el = document.querySelector(`[data-tutorial="${steps[step].id}"]`)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [step, steps])

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
    lsSet(SK.tutorialSeen(userId, screen), true)
  }
  function handleNext() {
    if (step < steps.length - 1) { playPage('forward'); setStep((s) => s + 1) }
    else handleDone()
  }
  function handleBack() {
    if (step > 0) { playPage('back'); setStep((s) => s - 1) }
  }
  function handleSkip() { playExitBlip(); markSeen(); onDone() }
  function handleDone() { playExitBlip(); markSeen(); onDone() }

  const vw = window.innerWidth
  const vh = window.innerHeight

  const cardW = compact ? Math.min(vw - 24, 360) : 720
  const cardH = compact ? Math.min(vh - 80, 460) : 540

  const cardLeft = (vw - cardW) / 2
  const cardTop  = (vh - cardH) / 2
  const cardCx   = cardLeft + cardW / 2
  const cardCy   = cardTop  + cardH / 2

  const arrow = rect ? computeArrow(cardCx, cardCy, rect, cardW, cardH) : null
  const current = steps[step]

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
            {rect && (
              <rect
                x={rect.left - SPOTLIGHT_PAD}
                y={rect.top - SPOTLIGHT_PAD}
                width={rect.width + SPOTLIGHT_PAD * 2}
                height={rect.height + SPOTLIGHT_PAD * 2}
                fill="black"
              />
            )}
            <rect x={cardLeft} y={cardTop} width={cardW} height={cardH} fill="black" />
          </mask>
        </defs>

        <rect width="100%" height="100%" fill="rgba(0,0,0,0.74)" mask="url(#tutorial-mask)" />

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
            {(() => {
              const dx = arrow.x2 - arrow.x1
              const dy = arrow.y2 - arrow.y1
              const len = Math.sqrt(dx * dx + dy * dy)
              if (len === 0) return null
              const ux = dx / len, uy = dy / len
              const px = -uy, py = ux
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
            <div className="flex items-center gap-1">
              {steps.map((_: TutorialStep, i: number) => (
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
            <p style={{ color: T.greenDim, fontSize: CRT_FONT.label, letterSpacing: '0.1em' }}>
              STEP {step + 1} / {steps.length}
            </p>
            <p style={{ color: T.green, fontSize: CRT_FONT.title, letterSpacing: '0.1em' }}>
              {current.title}
            </p>
            <p style={{ color: T.greenDim, fontSize: CRT_FONT.sub, letterSpacing: '0.08em' }}>
              {current.subtitle}
            </p>
            <div style={{ height: 1, background: T.border, flexShrink: 0 }} />
            <div className="flex flex-col gap-2 overflow-hidden">
              {current.body.map((para: string, i: number) => (
                <p
                  key={i}
                  style={{
                    fontFamily: '"VT323", monospace',
                    fontSize: CRT_FONT.body,
                    color: i === 0 ? T.green : T.greenDim,
                    opacity: i === 0 ? 1 : 0.85,
                    lineHeight: 1.4,
                    whiteSpace: 'pre-line',
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
                padding: compact ? '6px 14px' : '1px 8px',
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
                    padding: compact ? '6px 14px' : '1px 8px',
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
                  padding: compact ? '6px 16px' : '1px 10px',
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                }}
              >
                {step < steps.length - 1 ? 'NEXT ▶' : 'DONE ✓'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
