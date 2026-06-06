import { useRef, useState, useEffect } from 'react'
import { useCVState } from '@/hooks/useCVState'
import { useAI } from '@/hooks/useAI'
import { PROMPT_COVER_LETTER_CANVAS, PROMPT_COVER_LETTER_ANGLE } from '@/config/aiPrompts'
import { T } from '@/lib/crtTheme'
import { insertCoverLetter, fetchCoverLetter } from '@/services/coverLetterService'
import { useSubscription } from '@/lib/SubscriptionContext'
import { fetchUsage, getAiProvider } from '@/services/aiService'
import { createCheckoutSession } from '@/services/subscriptionService'
import { PRO_UPGRADE_CTA } from '@/config/pricing'

// ── Glitch overlay (reused from CVCanvas) ────────────────────────────────────

function GlitchOverlay({ width, height, words }: { width: number; height: number; words: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wordsRef  = useRef(words)
  useEffect(() => { wordsRef.current = words }, [words])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const CHARS = '01█▓▒░10110100'
    let frame: number
    function draw() {
      ctx.clearRect(0, 0, width, height)
      ctx.font = '11px monospace'
      for (let y = 0; y < height; y += 14) {
        for (let x = 0; x < width; x += 9) {
          const alpha = Math.random() * 0.55 + 0.1
          ctx.fillStyle = `rgba(57,255,20,${alpha.toFixed(2)})`
          const pool = wordsRef.current
          if (pool.length > 0 && Math.random() < 0.08) {
            const word = pool[Math.floor(Math.random() * pool.length)]
            ctx.fillText(word, x, y + 11)
            x += ctx.measureText(word).width
          } else {
            ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], x, y + 11)
          }
        }
      }
      const barY = (Date.now() % 1800) / 1800 * height
      const grad = ctx.createLinearGradient(0, barY - 30, 0, barY + 30)
      grad.addColorStop(0, 'rgba(57,255,20,0)')
      grad.addColorStop(0.5, 'rgba(57,255,20,0.18)')
      grad.addColorStop(1, 'rgba(57,255,20,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, barY - 30, width, 60)
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [width, height])
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  userId?: string | null
  initialJd?: string | null
  initialCoverLetterId?: string | null
  initialCompany?: string | null
  initialJobId?: string | null
  onInitialConsumed?: () => void
  onLetterSaved?: (jobId: string, coverLetterId: string) => void
  onClose?: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CoverLetterCanvas({
  visible,
  userId,
  initialJd,
  initialCoverLetterId,
  initialCompany,
  initialJobId,
  onInitialConsumed,
  onLetterSaved,
  onClose,
}: Props) {
  const { cvContent, loading: cvLoading } = useCVState(userId)
  const { run: runAI } = useAI()

  // ── Generate state ───────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'error'>('idle')

  // ── Result state ─────────────────────────────────────────────────────────────
  const [body, setBody]     = useState<string | null>(null)
  const [jdText, setJdText] = useState('')

  // ── Keywords (extracted from JD by the AI, same pattern as CVCanvas) ─────────
  const [keywords, setKeywords] = useState<string[]>([])

  // ── Angle state ───────────────────────────────────────────────────────────────
  interface AngleResult {
    angle: string
    talkingPoints: string[]
    keywords: string[]
    watchOut: string
  }
  const [angleResult, setAngleResult] = useState<AngleResult | null>(null)
  const [anglePhase, setAnglePhase]   = useState<'idle' | 'thinking' | 'error'>('idle')

  // ── Save state ───────────────────────────────────────────────────────────────
  const [savePhase, setSavePhase] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [copied, setCopied]       = useState(false)

  // ── AI limit / subscription ──────────────────────────────────────────────────
  const { isSubscribed } = useSubscription()
  const [limitHit, setLimitHit] = useState(false)
  const [usage, setUsage]       = useState<{ count: number; limit: number } | null>(null)

  useEffect(() => {
    if (getAiProvider() !== 'proxy') return
    fetchUsage().then((u) => { if (u) setUsage(u) })
  }, [])

  // ── Auto-trigger on open ─────────────────────────────────────────────────────
  const initialHandledRef = useRef(false)
  const pendingJobIdRef   = useRef<string | null>(null)

  useEffect(() => {
    if (!visible) initialHandledRef.current = false
  }, [visible])

  useEffect(() => {
    if (!visible || cvLoading) return
    if (initialHandledRef.current) return
    initialHandledRef.current = true
    pendingJobIdRef.current = initialJobId ?? null

    if (initialCoverLetterId) {
      setPhase('thinking')
      fetchCoverLetter(initialCoverLetterId).then((letter) => {
        if (!letter) { setPhase('idle'); return }
        setBody(letter.body)
        setJdText(letter.jobDescription)
        setPhase('idle')
        onInitialConsumed?.()
      })
    } else if (initialJd?.trim()) {
      setJdText(initialJd)
      handleGenerate(initialJd)
      onInitialConsumed?.()
    }
  }, [visible, cvLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate ─────────────────────────────────────────────────────────────────

  function handleGenerate(overrideJd?: string) {
    const jd = (overrideJd ?? jdText).trim()
    if (!jd) return

    setBody(null)
    setKeywords([])
    setAngleResult(null)
    setAnglePhase('idle')
    setPhase('thinking')

    const prompt =
      'JOB DESCRIPTION:\n' + jd +
      '\n\nMASTER CV:\n' + JSON.stringify(cvContent, null, 2)

    // ── Letter call ───────────────────────────────────────────────────────────
    runAI({
      system: PROMPT_COVER_LETTER_CANVAS,
      prompt,
      model: 'claude-haiku-4-5',
      onComplete: (result) => {
        setBody(result.trim())
        setPhase('idle')
        const kws = Array.from(
          new Set(
            jd.split(/[\s,;:()\[\]\/\n]+/)
              .map((w) => w.replace(/[^a-zA-Z0-9+#.]/g, '').trim())
              .filter((w) => w.length > 3 && w.length < 30 && !/^\d+$/.test(w))
          )
        ).slice(0, 40)
        setKeywords(kws)
      },
      onError: (msg) => {
        if (msg.includes('Monthly limit') || msg.includes('limit reached')) setLimitHit(true)
        setPhase('error')
        setTimeout(() => setPhase('idle'), 4000)
      },
    })

    // ── Angle call (parallel) ─────────────────────────────────────────────────
    setAnglePhase('thinking')
    runAI({
      system: PROMPT_COVER_LETTER_ANGLE,
      prompt,
      model: 'claude-haiku-4-5',
      onComplete: (result) => {
        try {
          const cleaned = result.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
          const parsed = JSON.parse(cleaned) as AngleResult
          setAngleResult(parsed)
          setKeywords((prev) => {
            const merged = Array.from(new Set([...prev, ...parsed.keywords]))
            return merged.slice(0, 40)
          })
          setAnglePhase('idle')
        } catch {
          setAnglePhase('error')
          setTimeout(() => setAnglePhase('idle'), 3000)
        }
      },
      onError: (msg) => {
        if (msg.includes('Monthly limit') || msg.includes('limit reached')) setLimitHit(true)
        setAnglePhase('error')
        setTimeout(() => setAnglePhase('idle'), 3000)
      },
    })
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!body || !userId) return
    setSavePhase('saving')

    const company = initialCompany?.trim() ?? ''
    const label = company
      ? `${company}_CoverLetter`
      : `CoverLetter_${new Date().toISOString().slice(0, 10)}`

    const { data: saved, error: saveErr } = await insertCoverLetter(userId, label, body, jdText)

    if (saveErr || !saved) {
      setSavePhase('error')
      setTimeout(() => setSavePhase('idle'), 4000)
    } else {
      const jobId = pendingJobIdRef.current
      if (jobId) onLetterSaved?.(jobId, saved.id)
      pendingJobIdRef.current = null
      setSavePhase('saved')
      setTimeout(() => { setSavePhase('idle'); onClose?.() }, 1500)
    }
  }

  // ── Copy ─────────────────────────────────────────────────────────────────────

  async function handleCopy() {
    if (!body) return
    await navigator.clipboard.writeText(body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Print ─────────────────────────────────────────────────────────────────────

  function handlePrint() {
    if (!body) return

    const style = document.createElement('style')
    style.id = 'cl-print-style'
    style.textContent = `
      @media print {
        body > *:not(#cl-print-target) { display: none !important; }
        #cl-print-target {
          display: block !important;
          position: fixed !important;
          inset: 0 !important;
          width: 816px !important;
          margin: 0 auto !important;
          padding: 72px 80px !important;
          background: #fff !important;
          color: #000 !important;
          font-family: 'Carlito', sans-serif !important;
          font-size: 12pt !important;
          line-height: 1.6 !important;
          white-space: pre-wrap !important;
          word-break: break-word !important;
        }
        @page { size: letter; margin: 0; }
      }
    `
    const el = document.createElement('div')
    el.id = 'cl-print-target'
    el.style.display = 'none'
    el.textContent = body

    document.head.appendChild(style)
    document.body.appendChild(el)

    const company = initialCompany?.trim() ?? 'cover_letter'
    const prevTitle = document.title
    document.title = `${company}_cover_letter`

    const cleanup = () => {
      document.title = prevTitle
      document.getElementById('cl-print-style')?.remove()
      document.getElementById('cl-print-target')?.remove()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const glitchWords = jdText.split(/\s+/).filter((w) => w.length > 4).map((w) => w.replace(/[^a-zA-Z0-9+#]/g, ''))

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 400ms ease',
      }}
    >
      {/* ── AI usage banner ───────────────────────────────────────────────── */}
      {getAiProvider() === 'proxy' && (
        <div style={{ position: 'absolute', top: 16, left: 20, right: 20, zIndex: 19, display: 'flex', alignItems: 'center', gap: 16 }}>
          {limitHit ? (
            <>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: T.warn, letterSpacing: '0.1em' }}>
                // AI LIMIT REACHED — upgrade for unlimited use
              </span>
              <button
                onClick={() => createCheckoutSession().catch(() => {})}
                style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.12em', color: T.bg, background: T.warn, border: `1px solid ${T.warn}`, padding: '3px 12px', cursor: 'pointer' }}
              >
                {PRO_UPGRADE_CTA}
              </button>
            </>
          ) : !isSubscribed && usage ? (
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em' }}>
              <span style={{ color: T.greenDim }}>{usage.count}/{usage.limit} AI uses this month — </span>
              <span onClick={() => createCheckoutSession().catch(() => {})} style={{ color: T.warn, cursor: 'pointer', textDecoration: 'underline' }}>
                upgrade for unlimited
              </span>
            </span>
          ) : isSubscribed ? (
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: T.greenDim, letterSpacing: '0.1em' }}>Pro — unlimited AI</span>
          ) : null}
        </div>
      )}

      {/* ── Thinking overlay ──────────────────────────────────────────────── */}
      {phase === 'thinking' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50, background: T.bg,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          <div style={{ position: 'relative', width: 816, maxWidth: '90%', aspectRatio: '816/1056', border: `1px solid ${T.border}`, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0.04 }} />
            <GlitchOverlay width={816} height={1056} words={glitchWords} />
          </div>
          <div style={{ marginTop: 24, fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.2em', color: T.green }}>
            WRITING COVER LETTER<span style={{ animation: 'crt-blink 1s step-start infinite' }}>…</span>
          </div>
          <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.12em', color: T.greenDim }}>
            HAIKU IS CRAFTING YOUR LETTER FROM THE JOB DESCRIPTION
          </div>
        </div>
      )}


      {/* ── Result view ───────────────────────────────────────────────────── */}
      {body && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#000', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div style={{ borderBottom: `1px solid ${T.border}`, padding: '18px 24px 14px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 15, letterSpacing: '0.18em', color: T.green }}>
                COVER LETTER
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
                {initialCompany && (
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: T.greenDim, letterSpacing: '0.1em' }}>
                    {initialCompany.toUpperCase()}
                  </div>
                )}
                {keywords.length > 0 && (() => {
                  const letterText = (body ?? '').toLowerCase()
                  const hits = keywords.filter((kw) => letterText.includes(kw.toLowerCase())).length
                  const score = Math.round((hits / keywords.length) * 100)
                  const color = score >= 70 ? T.green : score >= 40 ? '#facc15' : T.warn
                  return (
                    <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em', textAlign: 'right' }}>
                      <span style={{ color: T.greenDim }}>KEYWORD MATCH </span>
                      <span style={{ fontSize: 20, color, fontWeight: 'bold' }}>{score}</span>
                      <span style={{ color: T.greenDim, fontSize: 12 }}>%</span>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Keyword chips */}
            {keywords.length > 0 && (() => {
              const letterText = (body ?? '').toLowerCase()
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                  {keywords.map((kw) => {
                    const hit = letterText.includes(kw.toLowerCase())
                    return (
                      <span key={kw} style={{
                        fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.08em',
                        color: hit ? T.green : T.warn,
                        border: `1px solid ${hit ? T.green : T.warn}33`,
                        padding: '1px 6px',
                      }}>
                        {kw}
                      </span>
                    )
                  })}
                </div>
              )
            })()}

            {/* Angle section — inline below keywords */}
            {(anglePhase !== 'idle' || angleResult) && (
              <div style={{ borderTop: `1px solid ${T.border}33`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {anglePhase === 'thinking' && (
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.green, letterSpacing: '0.14em' }}>
                    ANALYZING ANGLE<span style={{ animation: 'crt-blink 1s step-start infinite' }}>…</span>
                  </span>
                )}
                {anglePhase === 'error' && (
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.warn, letterSpacing: '0.1em' }}>ANGLE ANALYSIS FAILED</span>
                )}
                {anglePhase === 'idle' && angleResult && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>

                    {/* Recommended angle */}
                    <div style={{ minWidth: 260, flex: '2 1 260px' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.14em', color: T.greenDim, marginBottom: 4 }}>ANGLE ✦</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: T.green, lineHeight: 1.6, letterSpacing: '0.04em' }}>
                        {angleResult.angle}
                      </div>
                    </div>

                    {/* Talking points */}
                    <div style={{ minWidth: 200, flex: '2 1 200px' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.14em', color: T.greenDim, marginBottom: 4 }}>TALKING POINTS</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {angleResult.talkingPoints.map((pt, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.border, flexShrink: 0, marginTop: 1 }}>▸</span>
                            <span style={{ fontFamily: 'monospace', fontSize: 10, color: T.greenDim, lineHeight: 1.5, letterSpacing: '0.03em' }}>{pt}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Watch out */}
                    <div style={{ minWidth: 180, flex: '1 1 180px' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.14em', color: T.greenDim, marginBottom: 4 }}>WATCH OUT FOR</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 10, color: T.warn, lineHeight: 1.5, letterSpacing: '0.04em' }}>
                        {angleResult.watchOut}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            <div style={{ fontFamily: 'monospace', fontSize: 9, color: T.greenDim, letterSpacing: '0.08em', lineHeight: 1.5, marginTop: 8 }}>
              CLICK THE TEXT TO EDIT. REGENERATE OVERWRITES THE CURRENT DRAFT.
            </div>
          </div>

          {/* Letter body */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '32px', background: '#1a1a1a' }}>
            <div style={{
              fontFamily: "'Carlito', sans-serif",
              fontSize: '12pt',
              lineHeight: 1.6,
              color: '#000',
              background: '#fff',
              width: 816,
              minHeight: 1056,
              boxSizing: 'border-box',
              padding: '72px 80px',
              boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              outline: 'none',
              cursor: 'text',
            }}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setBody(e.currentTarget.textContent ?? '')}
            >
              {body}
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${T.border}`, padding: '14px 28px', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>

            <button
              onClick={() => { setBody(null); setKeywords([]); setAngleResult(null); setAnglePhase('idle'); onClose?.() }}
              style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.12em', color: T.greenDim, background: 'none', border: `1px solid ${T.border}`, padding: '7px 20px', cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.warn; (e.currentTarget as HTMLElement).style.borderColor = T.warn }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border }}
            >
              CLOSE
            </button>

            <button
              disabled={phase === 'thinking'}
              onClick={() => handleGenerate()}
              style={{
                fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.12em', padding: '7px 20px', cursor: 'pointer',
                color: T.greenDim, border: `1px solid ${T.border}`, background: 'none',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.green; (e.currentTarget as HTMLElement).style.borderColor = T.green }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border }}
            >
              REGENERATE
            </button>

            <button
              onClick={handleCopy}
              style={{
                fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.12em', padding: '7px 20px', cursor: 'pointer',
                color: copied ? T.green : T.greenDim,
                border: `1px solid ${copied ? T.green : T.border}`,
                background: 'none',
              }}
              onMouseEnter={(e) => { if (!copied) { (e.currentTarget as HTMLElement).style.color = T.green; (e.currentTarget as HTMLElement).style.borderColor = T.green } }}
              onMouseLeave={(e) => { if (!copied) { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border } }}
            >
              {copied ? 'COPIED ✓' : 'COPY'}
            </button>

            <button
              onClick={handlePrint}
              style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.12em', color: T.greenDim, background: 'none', border: `1px solid ${T.border}`, padding: '7px 20px', cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.green; (e.currentTarget as HTMLElement).style.borderColor = T.green }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border }}
            >
              DOWNLOAD PDF
            </button>

            {savePhase === 'idle' && userId && (
              <button
                onClick={handleSave}
                style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.12em', color: T.greenDim, background: 'none', border: `1px solid ${T.border}`, padding: '7px 20px', cursor: 'pointer' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.green; (e.currentTarget as HTMLElement).style.borderColor = T.green }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border }}
              >
                SAVE LETTER
              </button>
            )}
            {savePhase === 'saving' && <span style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.12em', color: T.greenDim }}>SAVING…</span>}
            {savePhase === 'saved'  && <span style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.12em', color: T.green }}>SAVED ✓</span>}
            {savePhase === 'error'  && <span style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.12em', color: T.warn }}>SAVE FAILED</span>}
          </div>
        </div>
      )}
    </div>
  )
}
