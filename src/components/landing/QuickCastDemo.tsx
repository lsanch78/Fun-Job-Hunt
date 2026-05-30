import { useEffect, useRef, useState } from 'react'
import { FileText, Clipboard } from 'pixelarticons/react'
import { playPageFlip, playSpellCast, playAiConsume, playAiDing } from '@/lib/sfx'

// ── Slot colors — mirrors QuickCast exactly ────────────────────────────────────
const SLOT_COLORS = {
  a: { border: 'var(--color-secondary)', text: 'var(--color-secondary)', label: 'A' },
  b: { border: '#22c55e',               text: '#22c55e',               label: 'B' },
  c: { border: '#f59e0b',               text: '#f59e0b',               label: 'C' },
} as const
type Slot = keyof typeof SLOT_COLORS

// ── Demo resume stubs ──────────────────────────────────────────────────────────
const DEMO_RESUMES: Record<Slot, { name: string; loaded: boolean }> = {
  a: { name: 'General',  loaded: true  },
  b: { name: 'Frontend', loaded: true  },
  c: { name: 'C',        loaded: false },
}

// ── Simulated AI outputs ───────────────────────────────────────────────────────
const COVER_LETTER = `Dear Hiring Manager,

I'm excited to apply for the Frontend Engineer role at Aperture Science. With 5+ years of React experience and a passion for pixel-perfect UIs, I believe I'd be a strong addition to your team.

In my last role at Initech, I led a redesign that reduced load time by 40% and boosted user retention. I thrive in fast-moving environments and enjoy shipping things that actually work.

I'd love to bring that same energy to Aperture Science.

Thank you for your consideration,
Luis`

const WHY_FIT = `Why I'm a great fit for Aperture Science:

• 5+ years of production React — I can hit the ground running
• Strong eye for UX — I care about what users actually experience
• Track record of shipping: led 3 major feature launches in 12 months
• Comfortable with ambiguity — startups move fast and so do I
• Passionate about the problem space — I use tools like this one daily`

// ── Simulated streaming ────────────────────────────────────────────────────────
function simulateStream(text: string, onToken: (t: string) => void, onDone: () => void): () => void {
  const words = text.split('')
  let i = 0
  let cancelled = false
  function tick() {
    if (cancelled) return
    // Vary chunk size 1-3 chars for a realistic feel
    const chunk = words.slice(i, i + 2).join('')
    onToken(chunk)
    i += 2
    if (i < words.length) {
      setTimeout(tick, 18 + Math.random() * 20)
    } else {
      onDone()
    }
  }
  setTimeout(tick, 80)
  return () => { cancelled = true }
}

// ── AI ready keyframe (injected once) ─────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('demo-qc-ai-style')) {
  const el = document.createElement('style')
  el.id = 'demo-qc-ai-style'
  el.textContent = `
@keyframes demo-qc-ai-shine {
  0%   { box-shadow: none; border-color: rgba(88,28,135,0.4); }
  50%  { box-shadow: 0 0 6px 1px rgba(107,33,168,0.22), inset 0 0 8px 1px rgba(88,28,135,0.06);
         border-color: rgba(126,34,206,0.65); }
  100% { box-shadow: none; border-color: rgba(88,28,135,0.4); }
}
.demo-qc-ai-ready { animation: demo-qc-ai-shine 2.5s ease-in-out infinite; }
@keyframes demo-scanlines-scroll {
  0%   { background-position: 0 0; }
  100% { background-position: 0 8px; }
}
@keyframes demo-scanline-sweep {
  0%   { top: -6px; opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
`
  document.head.appendChild(el)
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function QuickCastDemo({ mouse }: { mouse: { x: number; y: number } }) {
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null)
  const [aiPhase, setAiPhase] = useState<'idle' | 'generating' | 'ready'>('idle')
  const [aiDots, setAiDots] = useState(0)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiMode, setAiMode] = useState<'cover_letter' | 'why_fit' | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 1600)
    return () => clearTimeout(t)
  }, [])

  // Dots animation while generating
  useEffect(() => {
    if (aiPhase !== 'generating') return
    const id = setInterval(() => setAiDots(d => (d + 1) % 3), 500)
    return () => clearInterval(id)
  }, [aiPhase])

  const statusLabel =
    aiPhase === 'generating' ? `GEN${'.'.repeat(aiDots + 1)}${'  '.repeat(2 - aiDots)}`
    : aiPhase === 'ready'    ? '● READY'
    :                          '● ON'

  function handleSlotClick(slot: Slot) {
    if (!DEMO_RESUMES[slot].loaded) return
    playPageFlip()
    setActiveSlot(prev => prev === slot ? null : slot)
    setAiResult(null)
    setAiMode(null)
  }

  function triggerGenerate(mode: 'cover_letter' | 'why_fit') {
    if (aiPhase === 'generating') return
    setMenuOpen(false)
    setAiResult(null)
    setAiMode(mode)
    setActiveSlot(null)
    setAiPhase('generating')
    setAiDots(0)
    playAiConsume()

    const text = mode === 'cover_letter' ? COVER_LETTER : WHY_FIT
    cancelRef.current?.()
    let accumulated = ''
    cancelRef.current = simulateStream(
      text,
      token => { accumulated += token; setAiResult(accumulated) },
      () => { setAiPhase('ready'); playAiDing() }
    )
  }

  function handleAiClick() {
    if (aiPhase === 'generating') { cancelRef.current?.(); setAiPhase('idle'); return }
    if (aiPhase === 'ready' || aiResult) {
      // toggle output panel
      setActiveSlot(prev => prev === null && aiResult ? null : null)
      setAiMode(prev => prev)
      // just show result — it's already visible below
      return
    }
    setMenuOpen(p => !p)
  }

  // Tilt
  const TILT_MAX = 3
  const rotX = -mouse.y * TILT_MAX
  const rotY = mouse.x * TILT_MAX

  const hotbarBtn = (active: boolean, extra = '') =>
    `w-20 h-20 flex flex-col items-center justify-center gap-1 leading-none border transition-none cursor-pointer select-none ${
      active ? 'border-primary text-primary' : 'border-border text-muted hover:border-primary hover:text-primary'
    } ${extra}`

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
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'translateZ(-20px)',
          background: 'var(--color-border)',
          opacity: 0.5,
        }}
      />

      {/* panel face */}
      <div
        className="border border-border bg-bg font-pixel text-primary overflow-hidden"
        style={{ transform: 'translateZ(0)', position: 'relative' }}
      >
        {/* loading sweep */}
        {!revealed && (
          <div
            className="absolute left-0 w-full h-1.5 bg-secondary z-10"
            style={{ opacity: 0.7, animation: 'demo-scanline-sweep 0.6s linear infinite', top: '-6px' }}
          />
        )}

        {/* ── Label ──────────────────────────────────────────────── */}
        <div className="px-6 pt-3 pb-1">
          <span className="text-[9px] text-dim tracking-widest select-none">QUICK CAST</span>
        </div>

        {/* ── Hotbar ─────────────────────────────────────────────── */}
        <div className="px-6 pb-4 flex items-end gap-6 justify-center">

          {/* Resume slots A B C */}
          <div className="flex items-end gap-1.5">
            {(Object.keys(SLOT_COLORS) as Slot[]).map(slot => {
              const { border, text, label } = SLOT_COLORS[slot]
              const demo = DEMO_RESUMES[slot]
              const isActive = activeSlot === slot
              return (
                <div key={slot} className="relative group">
                  <button
                    onClick={() => handleSlotClick(slot)}
                    title={demo.loaded ? `${demo.name} — click to preview` : `Upload Resume ${label}`}
                    className={[
                      'w-20 h-20 flex flex-col items-center justify-center gap-1 leading-none border transition-none select-none',
                      demo.loaded ? 'cursor-pointer' : 'cursor-default opacity-50',
                    ].join(' ')}
                    style={{
                      borderColor: demo.loaded ? (isActive ? 'var(--color-primary)' : border) : 'var(--color-border)',
                      color:       demo.loaded ? (isActive ? 'var(--color-primary)' : text) : 'var(--color-muted)',
                    }}
                  >
                    <FileText width={32} height={32} />
                    <span className="font-pixel text-[7px] tracking-widest leading-none">
                      {demo.loaded ? demo.name.slice(0, 10) : label}
                    </span>
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface border border-border font-pixel text-[8px] text-primary px-2 py-1 whitespace-nowrap pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-none">
                    {demo.loaded ? demo.name : `UPLOAD RESUME ${label}`}
                  </div>
                </div>
              )
            })}
          </div>

          {/* AI button */}
          <div className="relative">
            <button
              onClick={handleAiClick}
              onContextMenu={e => { e.preventDefault(); if (aiPhase !== 'generating') setMenuOpen(p => !p) }}
              title={aiPhase === 'generating' ? 'Generating… click to cancel' : 'AI Resume Assistant · right-click for quick generate'}
              className={[
                hotbarBtn(false),
                aiPhase === 'ready' ? 'demo-qc-ai-ready' : '',
              ].join(' ')}
            >
              <span className="font-pixel leading-none font-bold tracking-tight" style={{ fontSize: 24 }}>AI</span>
              <span
                className="font-pixel text-[7px] tracking-widest leading-none"
                style={{ color: aiPhase === 'generating' ? '#22c55e' : aiPhase === 'ready' ? '#7e22ce' : '#22c55e' }}
              >
                {statusLabel}
              </span>
            </button>

            {/* Quick-generate menu */}
            {menuOpen && (
              <div className="absolute bottom-full mb-2 right-0 z-50 bg-surface border border-border font-pixel text-xs flex flex-col w-56">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-[9px] tracking-widest text-muted">QUICK GENERATE</span>
                  <button onClick={() => setMenuOpen(false)} className="text-muted hover:text-primary text-[9px]">✕</button>
                </div>
                <div className="px-3 py-2 flex flex-col gap-1">
                  {([
                    ['cover_letter', 'COVER LETTER'],
                    ['why_fit',      'WHY WORK HERE?'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => triggerGenerate(mode)}
                      className="text-left text-muted border border-border text-[9px] px-2 py-1.5 font-pixel hover:border-primary hover:text-primary transition-none flex items-center gap-1.5"
                    >
                      <Clipboard width={10} height={10} className="shrink-0" />
                      + {label}
                    </button>
                  ))}
                  <p className="text-[8px] text-muted mt-1 leading-relaxed">
                    Reads your resume + clipboard job description
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Output panel ────────────────────────────────────────── */}
        {(aiResult || activeSlot) && (
          <div className="border-t border-border bg-surface">
            {/* Resume preview stub */}
            {activeSlot && !aiResult && (
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] tracking-widest" style={{ color: SLOT_COLORS[activeSlot].text }}>
                    RESUME {activeSlot.toUpperCase()} — {DEMO_RESUMES[activeSlot].name}
                  </span>
                  <button onClick={() => setActiveSlot(null)} className="text-muted hover:text-primary text-[9px]">✕</button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {['Luis Buenrostro · Frontend Engineer', 'React · TypeScript · Node · Tailwind', '5 yrs exp · Open to opportunities'].map(line => (
                    <div key={line} className="h-2 bg-border rounded-sm" style={{ width: `${55 + Math.random() * 35}%`, opacity: 0.7 }}>
                      <span className="sr-only">{line}</span>
                    </div>
                  ))}
                  <div className="mt-2 text-[9px] text-muted tracking-widest">[ UPLOAD YOUR OWN PDF TO SEE IT HERE ]</div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => { setActiveSlot(null); triggerGenerate('cover_letter') }}
                    className="text-[9px] px-3 py-1.5 border border-secondary text-secondary hover:border-primary hover:text-primary transition-none flex items-center gap-1"
                  >
                    <Clipboard width={9} height={9} /> COVER LETTER
                  </button>
                  <button
                    onClick={() => { setActiveSlot(null); triggerGenerate('why_fit') }}
                    className="text-[9px] px-3 py-1.5 border border-border text-muted hover:border-primary hover:text-primary transition-none flex items-center gap-1"
                  >
                    <Clipboard width={9} height={9} /> WHY FIT?
                  </button>
                </div>
              </div>
            )}

            {/* AI output */}
            {aiResult && (
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] tracking-widest text-muted">
                    {aiMode === 'cover_letter' ? 'COVER LETTER' : 'WHY WORK HERE?'}
                    {aiPhase === 'generating' && <span className="text-secondary ml-2 animate-pulse">● STREAMING</span>}
                  </span>
                  <div className="flex gap-2">
                    {aiPhase === 'ready' && (
                      <button
                        onClick={() => { playSpellCast(); navigator.clipboard.writeText(aiResult).catch(() => {}) }}
                        className="text-[9px] px-2 py-0.5 border border-border text-muted hover:border-primary hover:text-primary transition-none"
                      >
                        COPY
                      </button>
                    )}
                    <button
                      onClick={() => { setAiResult(null); setAiMode(null); setAiPhase('idle') }}
                      className="text-muted hover:text-primary text-[9px]"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <pre className="body-text text-primary text-sm leading-relaxed whitespace-pre-wrap overflow-y-auto" style={{ maxHeight: '220px', fontFamily: 'VT323, monospace' }}>
                  {aiResult}
                  {aiPhase === 'generating' && <span className="text-secondary animate-pulse">▌</span>}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* hint row */}
        {!aiResult && !activeSlot && (
          <div className="px-6 py-2 border-t border-border flex items-center justify-between">
            <span className="text-[9px] text-muted tracking-widest">CLICK A RESUME · RIGHT-CLICK AI</span>
            <span className="text-[9px] text-muted tracking-widest">READS YOUR RESUME + JD</span>
          </div>
        )}

        {/* CRT scanline overlay */}
        {revealed && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)',
              animation: 'demo-scanlines-scroll 0.3s linear infinite',
              mixBlendMode: 'multiply',
            }}
          />
        )}
      </div>
    </div>
  )
}
