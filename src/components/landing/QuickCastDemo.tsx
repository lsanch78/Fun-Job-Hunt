import { useEffect, useRef, useState } from 'react'
import { FileText } from 'pixelarticons/react'
import { playSpellCast, playAiConsume, playAiDing, playDialogueConfirm } from '@/lib/sfx'

// ── Keyframes ─────────────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('qcd-keyframes')) {
  const el = document.createElement('style')
  el.id = 'qcd-keyframes'
  el.textContent = `
@keyframes qcd-sweep  { 0% { top:-6px;opacity:1 } 100% { top:100%;opacity:0 } }
@keyframes qcd-scans  { 0% { background-position:0 0 } 100% { background-position:0 8px } }
@keyframes qcd-blink  { 0%,100%{opacity:1}50%{opacity:0} }
@keyframes qcd-prompt { 0%,100%{opacity:.5}50%{opacity:1} }
@keyframes qcd-shine  {
  0%   { box-shadow:none; border-color:rgba(88,28,135,.4); }
  50%  { box-shadow:0 0 6px 1px rgba(107,33,168,.22); border-color:rgba(126,34,206,.65); }
  100% { box-shadow:none; border-color:rgba(88,28,135,.4); }
}
@keyframes qcd-select {
  0%   { width:0; }
  100% { width:100%; }
}
@keyframes qcd-rightclick {
  0%   { opacity:0; transform:scale(.95) translateY(4px); }
  100% { opacity:1; transform:scale(1)  translateY(0); }
}
/* Pixel cursor — crisp 2-colour bitmap via box-shadow, no anti-aliasing */
.qcd-cursor {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
`
  document.head.appendChild(el)
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const LINKEDIN_URL = 'linkedin.com/in/j-doe'
const PORTFOLIO_URL = 'jdoe.dev'

const JD_SHORT = `Boring Lasers Corp. is seeking a passionate Laser Operations Specialist to join our world-class boredom team. You will operate laser equipment in a boring yet precise manner.`
const JD_FULL = `${JD_SHORT}

RESPONSIBILITIES
• Operate industrial boring lasers with minimal enthusiasm
• Attend mandatory synergy alignment meetings (bi-weekly)
• Maintain detailed spreadsheets tracking laser boredom metrics
• Collaborate cross-functionally with the Dullness Task Force
• Perform other duties as assigned (and then some)

QUALIFICATIONS
• 3–5 years boring laser experience preferred
• Proficiency in Microsoft Excel and general disengagement
• Ability to remain seated for prolonged periods
• Strong written and verbal monotony skills
• Bachelor's degree in Applied Boredom or equivalent`

const COVER_LETTER = `Dear Hiring Manager,

I'm thrilled to apply for the Laser Operations Specialist role at Boring Lasers Corp.

While the role sounds impressively dull, I bring 5+ years of precision and a deep commitment to keeping things thoroughly unexciting. My previous work at Initech involved operating equipment with zero enthusiasm and attending an average of 14 synergy meetings per week.

I am fluent in monotony, proficient in spreadsheets, and capable of remaining seated for hours on end.

Thank you for your consideration,
J. Doe`

// ── Phases ────────────────────────────────────────────────────────────────────
type Phase =
  | 'idle'        // 0 — pre-start, prompt shown
  | 'linkedin'    // 1 — pasting linkedin
  | 'portfolio'   // 2 — pasting portfolio
  | 'scroll'      // 3 — scroll to JD + select text
  | 'ai'          // 4 — right-clicking AI button
  | 'generating'  // 5 — streaming output
  | 'submit'      // 6 — scroll to submit button + click
  | 'done'        // 7 — done screen

// ── Mock pointer ──────────────────────────────────────────────────────────────
// px coordinates relative to the panel's top-left corner
interface PointerPos { x: number; y: number }

// Pixel-art cursor: 11×16 drawn with a div grid (pure CSS, no SVG anti-aliasing)
// Each cell is 2×2px. Pattern is a classic Windows-style arrow.
const CURSOR_PIXELS = [
  [1,0,0,0,0,0],
  [1,1,0,0,0,0],
  [1,2,1,0,0,0],
  [1,2,2,1,0,0],
  [1,2,2,2,1,0],
  [1,2,2,2,2,1],
  [1,2,2,1,1,0],
  [1,2,1,2,1,0],
  [1,1,0,1,2,1],
  [1,0,0,0,1,2],
  [0,0,0,0,0,1],
] // 0=transparent 1=black outline 2=white fill

function MockPointer({ pos, rightClick, clicking, visible }: { pos: PointerPos; rightClick?: boolean; clicking?: boolean; visible: boolean }) {
  const S = 3
  return (
    <div
      aria-hidden
      className="qcd-cursor"
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        zIndex: 99,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: visible
          ? 'left 0.5s cubic-bezier(.4,0,.2,1), top 0.5s cubic-bezier(.4,0,.2,1), opacity 0.15s'
          : 'opacity 0.15s',
      }}
    >
      {/* Pixel grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(6, ${S}px)`, lineHeight: 0 }}>
        {CURSOR_PIXELS.flatMap((row, ri) =>
          row.map((cell, ci) => (
            <div
              key={`${ri}-${ci}`}
              style={{
                width: S, height: S,
                background: clicking
                  ? (cell === 1 ? 'var(--color-primary)' : cell === 2 ? 'var(--color-secondary)' : 'transparent')
                  : (cell === 1 ? '#000' : cell === 2 ? '#fff' : 'transparent'),
              }}
            />
          ))
        )}
      </div>
      {/* Right-click flash */}
      {rightClick && (
        <div style={{
          position: 'absolute', top: 2, left: 2,
          width: 10, height: 10,
          border: `${S}px solid var(--color-secondary)`,
          opacity: 0, animation: 'qcd-shine 0.35s ease-out forwards',
        }} />
      )}
    </div>
  )
}

// ── Simulated streaming ───────────────────────────────────────────────────────
function simulateStream(text: string, onToken: (t: string) => void, onDone: () => void): () => void {
  let i = 0
  let cancelled = false
  function tick() {
    if (cancelled) return
    const chunk = text.slice(i, i + 8)
    onToken(chunk)
    i += 8
    if (i < text.length) setTimeout(tick, 6 + Math.random() * 6)
    else onDone()
  }
  setTimeout(tick, 80)
  return () => { cancelled = true }
}

// ── Measure element center relative to a container ───────────────────────────
function centerOf(el: HTMLElement | null, container: HTMLElement | null): PointerPos {
  if (!el || !container) return { x: 0, y: 0 }
  const er = el.getBoundingClientRect()
  const cr = container.getBoundingClientRect()
  return { x: er.left - cr.left + er.width / 2, y: er.top - cr.top + er.height / 2 }
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function QuickCastDemo({ mouse, index = 0 }: { mouse: { x: number; y: number }; index?: number }) {
  const [revealed, setRevealed] = useState(false)
  const [phase, setPhase]       = useState<Phase>('idle')
  const [linkedinVal, setLinkedinVal] = useState('')
  const [portfolioVal, setPortfolioVal] = useState('')
  const [aiResult, setAiResult]  = useState('')
  const [rightClick, setRightClick] = useState(false)
  const [menuOpen, setMenuOpen]  = useState(false)
  const [selectAnim, setSelectAnim] = useState(false)
  const [selectionTop, setSelectionTop] = useState(0)
  const [selectionHeight, setSelectionHeight] = useState(36)
  const [copiedLink, setCopiedLink] = useState<'linkedin' | 'portfolio' | null>(null)
  const [clicking, setClicking] = useState(false)
  const [pointerPos, setPointerPos] = useState<PointerPos>({ x: 0, y: 0 })
  const cancelRef = useRef<(() => void) | null>(null)
  const lastClickRef = useRef(0)
  const jdRef = useRef<HTMLDivElement>(null)
  // refs for pointer targets
  const panelRef      = useRef<HTMLDivElement>(null)
  const linkedinRef   = useRef<HTMLDivElement>(null)
  const portfolioRef  = useRef<HTMLDivElement>(null)
  const jdBlockRef    = useRef<HTMLDivElement>(null)
  const jdTextRef     = useRef<HTMLParagraphElement>(null)
  const aiButtonRef   = useRef<HTMLDivElement>(null)
  const submitRef     = useRef<HTMLButtonElement>(null)
  const aiOutputRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 1600)
    return () => clearTimeout(t)
  }, [])

  function flashClick(delayMs = 0) {
    setTimeout(() => {
      setClicking(true)
      setTimeout(() => setClicking(false), 280)
    }, delayMs)
  }

  // Move pointer to the right element for each phase
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    // Small delay so DOM has settled (especially after phase transitions that show/hide hotbar)
    const id = setTimeout(() => {
      if (phase === 'linkedin')   setPointerPos(centerOf(linkedinRef.current, panel))
      if (phase === 'portfolio')  setPointerPos(centerOf(portfolioRef.current, panel))
      if (phase === 'scroll')     setPointerPos(centerOf(jdBlockRef.current, panel))
      if (phase === 'ai')         setPointerPos(centerOf(aiButtonRef.current, panel))
      if (phase === 'generating') setPointerPos(centerOf(aiButtonRef.current, panel))
      if (phase === 'submit')     setPointerPos(centerOf(submitRef.current as unknown as HTMLElement, panel))
    }, 30)
    return () => clearTimeout(id)
  }, [phase])

  // Per-phase side effects
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = []
    const t = (fn: () => void, ms: number) => { const id = setTimeout(fn, ms); timers.push(id) }

    if (phase === 'linkedin') {
      t(() => {
        flashClick()
        playSpellCast()
        setCopiedLink('linkedin')
        timers.push(setTimeout(() => setCopiedLink(null), 700))
      }, 350)
      let i = 0
      function typeNextLi() {
        if (i >= LINKEDIN_URL.length) return
        setLinkedinVal(LINKEDIN_URL.slice(0, i + 1))
        i++
        timers.push(setTimeout(typeNextLi, 22 + Math.random() * 16))
      }
      t(typeNextLi, 350)
    }

    if (phase === 'portfolio') {
      t(() => {
        flashClick()
        playSpellCast()
        setCopiedLink('portfolio')
        timers.push(setTimeout(() => setCopiedLink(null), 700))
      }, 350)
      let i = 0
      function typeNextPf() {
        if (i >= PORTFOLIO_URL.length) return
        setPortfolioVal(PORTFOLIO_URL.slice(0, i + 1))
        i++
        timers.push(setTimeout(typeNextPf, 22 + Math.random() * 16))
      }
      t(typeNextPf, 350)
    }

    if (phase === 'scroll') {
      // Step 1: scroll JD into view
      t(() => jdRef.current?.scrollTo({ top: 200, behavior: 'smooth' }), 400)
      // Step 2: after scroll settles, measure text and trigger selection
      t(() => {
        const block = jdBlockRef.current
        const txt   = jdTextRef.current
        if (block && txt) {
          const br = block.getBoundingClientRect()
          const tr = txt.getBoundingClientRect()
          // position relative to the jdBlock (which has position:relative)
          const lineH = parseFloat(getComputedStyle(txt).lineHeight) || 18
          setSelectionTop(tr.top - br.top)
          setSelectionHeight(lineH * 6)
        }
        flashClick()
        setSelectAnim(true)
        // move cursor to where the text is
        const panel = panelRef.current
        if (panel && jdTextRef.current) {
          setPointerPos(centerOf(jdTextRef.current as unknown as HTMLElement, panel))
        }
      }, 950)
      t(() => playDialogueConfirm(), 1300)
    }

    if (phase === 'ai') {
      t(() => {
        flashClick()
        setRightClick(true)
        setTimeout(() => setRightClick(false), 400)
        setMenuOpen(true)
      }, 500)
    }

    if (phase === 'generating') {
      setMenuOpen(false)
      setAiResult('')
      playAiConsume()
      cancelRef.current?.()
      let accumulated = ''
      cancelRef.current = simulateStream(
        COVER_LETTER,
        token => { accumulated += token; setAiResult(accumulated) },
        () => { playAiDing(); setPhase('submit') }
      )
    }

    if (phase === 'submit') {
      t(() => {
        const panel = panelRef.current
        if (panel) setPointerPos(centerOf(submitRef.current as unknown as HTMLElement, panel))
      }, 300)
      t(() => flashClick(), 700)
    }

    return () => { timers.forEach(clearTimeout) }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function advance() {
    const now = Date.now()
    if (now - lastClickRef.current < 320) return
    lastClickRef.current = now

    const next: Partial<Record<Phase, Phase>> = {
      idle:      'linkedin',
      linkedin:  'portfolio',
      portfolio: 'scroll',
      scroll:    'ai',
      ai:        'generating',
      submit:    'done',
    }
    const n = next[phase]
    if (n) setPhase(n)
  }

  function handleReplay() {
    cancelRef.current?.()
    setPhase('idle')
    setLinkedinVal('')
    setPortfolioVal('')
    setAiResult('')
    setMenuOpen(false)
    setSelectAnim(false)
    setSelectionTop(0)
    setCopiedLink(null)
  }

  // Tilt
  const TILT_MAX = 3
  const depth = 1 + index * 0.4
  const rotX = -mouse.y * TILT_MAX * depth
  const rotY = mouse.x * TILT_MAX * depth

  const isIdle = phase === 'idle'
  const isDone = phase === 'done'
  const isGenerating = phase === 'generating'
  const isSubmit = phase === 'submit'

  // Derive click-prompt text per phase
  const clickPrompt: Partial<Record<Phase, string>> = {
    idle:      '[ click ] start demo',
    linkedin:  '[ click ] paste portfolio',
    portfolio: '[ click ] scroll to job description',
    scroll:    '[ click ] right-click AI',
    ai:        '[ click ] generate cover letter',
    submit:    '[ click ] submit cover letter',
  }



  return (
    <div
      style={{
        transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
        transition: 'transform 0.12s linear',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        position: 'relative',
        cursor: isDone || isGenerating ? 'default' : 'pointer',
      }}
      onClick={isDone || isGenerating ? undefined : advance}
    >
      {/* depth shadow */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, transform: 'translateZ(-60px)', background: 'var(--color-border)', opacity: 0.8 }} />

      {/* panel face */}
      <div
        ref={panelRef}
        className="border border-border bg-bg font-pixel text-primary overflow-hidden flex flex-col"
        style={{ transform: 'translateZ(0)', position: 'relative', height: '420px' }}
      >
        {/* loading sweep */}
        {!revealed && (
          <div className="absolute left-0 w-full h-1.5 bg-secondary z-10"
            style={{ opacity: 0.7, animation: 'qcd-sweep 0.6s linear infinite', top: '-6px' }} />
        )}

        {/* Mock pointer */}
        <MockPointer pos={pointerPos} rightClick={rightClick} clicking={clicking} visible={!isIdle && !isDone} />

        {/* ── Label ──────────────────────────────────────────────── */}
        <div className="px-6 pt-3 pb-1 shrink-0">
          <span className="text-[9px] text-dim tracking-widest select-none">QUICK CAST</span>
        </div>

        {/* ── Main scrollable body ──────────────────────────────── */}
        <div className="flex-1 border-t border-border flex flex-col overflow-hidden">

          {/* Idle / pre-start overlay */}
          {isIdle && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 select-none">
              <p className="text-[9px] text-muted tracking-widest"
                style={{ animation: 'qcd-prompt 1.8s ease-in-out infinite' }}>
                ▶ CLICK TO START DEMO
              </p>
            </div>
          )}

          {/* Done overlay */}
          {isDone && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 select-none">
              <div className="text-center">
                <p className="text-secondary text-2xl mb-4">★</p>
                <p className="text-[10px] text-primary tracking-widest mb-2">THAT'S QUICK CAST</p>
                <p className="text-[9px] text-muted leading-relaxed max-w-xs text-center">
                  Paste your links, copy a job description, and generate AI-powered cover letters — all without leaving your tracker.
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

          {/* Active demo content */}
          {!isIdle && !isDone && (
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* AI output panel */}
              {(isGenerating || isSubmit) && (
                <>
                  <div ref={aiOutputRef} className={`flex-1 px-5 py-4 bg-surface ${isGenerating ? 'overflow-y-auto' : 'overflow-hidden'}`}>
                    <div className="flex items-center justify-between mb-3 shrink-0">
                      <span className="text-[9px] tracking-widest text-muted">
                        COVER LETTER
                        {isGenerating && <span className="text-secondary ml-2 animate-pulse">● STREAMING</span>}
                        {isSubmit && <span className="text-secondary ml-2">● READY</span>}
                      </span>
                    </div>
                    <pre className="body-text text-primary text-sm leading-relaxed whitespace-pre-wrap"
                      style={{ fontFamily: 'VT323, monospace' }}>
                      {aiResult}
                      {isGenerating && <span className="text-secondary" style={{ animation: 'qcd-blink 0.6s step-start infinite' }}>▌</span>}
                    </pre>
                  </div>
                  {isSubmit && (
                    <div className="shrink-0 px-5 py-3 border-t border-border bg-surface">
                      <button
                        ref={submitRef}
                        className="w-full font-pixel text-[9px] tracking-widest border border-secondary text-secondary py-2 hover:bg-secondary hover:text-bg transition-none select-none"
                      >
                        + SUBMIT COVER LETTER
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Job form */}
              {!isGenerating && (
                <div ref={jdRef} className="flex-1 overflow-y-auto px-5 py-4"
                  style={{ scrollBehavior: 'smooth' }}>

                  {/* Company header */}
                  <div className="mb-4">
                    <p className="font-pixel text-[9px] text-secondary tracking-widest mb-1">JOB APPLICATION</p>
                    <p className="font-pixel text-xs text-primary tracking-widest">BORING LASERS CORP.</p>
                  </div>

                  {/* Link fields */}
                  <div className="flex flex-col gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-pixel text-[8px] text-muted tracking-widest w-20 shrink-0">LINKEDIN</span>
                      <div className="flex-1 border border-border bg-surface px-2 py-1 flex items-center gap-1 h-7">
                        {linkedinVal
                          ? <span className="font-pixel text-[9px] text-primary">{linkedinVal}</span>
                          : <span className="font-pixel text-[9px] text-muted opacity-50">paste link…</span>
                        }
                        {phase === 'linkedin' && (
                          <span className="inline-block w-1.5 h-3 bg-primary" style={{ animation: 'qcd-blink 0.7s step-end infinite' }} />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-pixel text-[8px] text-muted tracking-widest w-20 shrink-0">PORTFOLIO</span>
                      <div className="flex-1 border border-border bg-surface px-2 py-1 flex items-center gap-1 h-7">
                        {portfolioVal
                          ? <span className="font-pixel text-[9px] text-primary">{portfolioVal}</span>
                          : <span className="font-pixel text-[9px] text-muted opacity-50">paste link…</span>
                        }
                        {phase === 'portfolio' && (
                          <span className="inline-block w-1.5 h-3 bg-primary" style={{ animation: 'qcd-blink 0.7s step-end infinite' }} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* JD block */}
                  <div ref={jdBlockRef} className="border border-border bg-surface px-3 py-3 relative">
                    <p className="font-pixel text-[8px] text-secondary tracking-widest mb-2">JOB DESCRIPTION</p>

                    {/* Selection highlight — top/height measured from real text position */}
                    {selectAnim && (
                      <div className="absolute left-0 right-0"
                        style={{
                          top: selectionTop,
                          height: selectionHeight,
                          background: 'rgba(34,197,94,.18)',
                          borderLeft: '2px solid #22c55e',
                          animation: 'qcd-select 0.6s cubic-bezier(.4,0,.2,1) forwards',
                          pointerEvents: 'none',
                        }} />
                    )}

                    <p ref={jdTextRef} className="body-text text-muted leading-relaxed"
                      style={{ fontSize: 11 }}>
                      {JD_FULL}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Hotbar ────────────────────────────────────────────── */}
        {!isIdle && !isDone && (
          <div className="px-6 py-4 flex items-end gap-6 justify-between border-t border-border shrink-0">

            {/* Quick links */}
            <div className="flex items-center gap-1.5">
              {/* LinkedIn */}
              <div
                ref={linkedinRef}
                className="w-20 h-20 flex flex-col items-center justify-center gap-1 leading-none border transition-none select-none relative"
                style={{ borderColor: copiedLink === 'linkedin' ? 'var(--color-primary)' : linkedinVal ? 'var(--color-primary)' : 'var(--color-border)', color: copiedLink === 'linkedin' ? 'var(--color-primary)' : linkedinVal ? 'var(--color-primary)' : 'var(--color-muted)' }}
              >
                <span className="font-pixel font-bold tracking-tight leading-none" style={{ fontSize: 17 }}>in</span>
                <span className="font-pixel text-[7px] tracking-widest leading-none">
                  {copiedLink === 'linkedin' ? 'COPIED!' : 'LINKEDIN'}
                </span>
              </div>
              {/* Portfolio */}
              <div
                ref={portfolioRef}
                className="w-20 h-20 flex flex-col items-center justify-center gap-1 leading-none border transition-none select-none relative"
                style={{ borderColor: copiedLink === 'portfolio' ? 'var(--color-primary)' : portfolioVal ? 'var(--color-primary)' : 'var(--color-border)', color: copiedLink === 'portfolio' ? 'var(--color-primary)' : portfolioVal ? 'var(--color-primary)' : 'var(--color-muted)' }}
              >
                <span className="font-pixel" style={{ fontSize: 17 }}>★</span>
                <span className="font-pixel text-[7px] tracking-widest leading-none">
                  {copiedLink === 'portfolio' ? 'COPIED!' : 'PORTFOLIO'}
                </span>
              </div>
            </div>

            {/* Resume slots */}
            <div className="flex items-end gap-1.5">
              {([
                { lbl: 'General', border: 'var(--color-secondary)', color: 'var(--color-secondary)' },
                { lbl: 'Frontend', border: '#22c55e', color: '#22c55e' },
              ]).map(({ lbl, border, color }) => (
                <div key={lbl}
                  className="w-20 h-20 flex flex-col items-center justify-center gap-1 leading-none border select-none"
                  style={{ borderColor: border, color }}
                >
                  <FileText width={32} height={32} />
                  <span className="font-pixel text-[7px] tracking-widest leading-none">{lbl.slice(0, 10)}</span>
                </div>
              ))}
            </div>

            {/* AI button */}
            <div className="relative">
              <div
                ref={aiButtonRef}
                className="w-20 h-20 flex flex-col items-center justify-center gap-1 leading-none border select-none"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)', animation: phase === 'ai' ? 'qcd-shine 2.5s ease-in-out infinite' : undefined }}
              >
                <span className="font-pixel leading-none font-bold tracking-tight" style={{ fontSize: 24 }}>AI</span>
                <span className="font-pixel text-[7px] tracking-widest leading-none" style={{ color: '#22c55e' }}>● ON</span>
              </div>

              {/* Right-click menu */}
              {menuOpen && (
                <div
                  className="absolute bottom-full mb-1 right-0 z-50 bg-surface border border-border font-pixel text-xs flex flex-col w-48"
                  style={{ animation: 'qcd-rightclick 0.15s ease-out forwards' }}
                >
                  <div className="px-3 py-2 border-b border-border">
                    <span className="text-[8px] tracking-widest text-muted">QUICK GENERATE</span>
                  </div>
                  <div className="px-2 py-2 flex flex-col gap-1">
                    <div
                      className="text-left border border-secondary text-secondary text-[8px] px-2 py-1.5 font-pixel flex items-center gap-1.5 cursor-pointer"
                      onClick={e => { e.stopPropagation(); setPhase('generating') }}
                    >
                      + COVER LETTER
                    </div>
                    <div className="text-left border border-border text-muted text-[8px] px-2 py-1.5 font-pixel flex items-center gap-1.5">
                      + WHY WORK HERE?
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Click-to-advance prompt */}
        {!isIdle && !isDone && !isGenerating && clickPrompt[phase] && (
          <div className="px-4 pb-2 shrink-0 flex justify-end">
            <span className="text-[8px] text-muted tracking-widest select-none"
              style={{ animation: 'qcd-prompt 1.2s ease-in-out infinite' }}>
              {clickPrompt[phase]}
            </span>
          </div>
        )}

        {/* CRT scanlines */}
        {revealed && (
          <div className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)',
              animation: 'qcd-scans 0.3s linear infinite',
              mixBlendMode: 'multiply',
              zIndex: 20,
            }} />
        )}
      </div>
    </div>
  )
}
