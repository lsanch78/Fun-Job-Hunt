import { useEffect, useRef, useState } from 'react'
import NetworkBackdrop from '@/components/shell/NetworkBackdrop'
import AiButton from '@/components/ai/AiButton'
import type { AiPhase } from '@/hooks/useAI'
import { playPingBlip, playAiConsume, playAiDing } from '@/lib/sfx'
import type { Contact } from '@/types'

// ── Keyframes ─────────────────────────────────────────────────────────────────
const DEMO_KEYFRAMES = `
@keyframes demo-comm-xp-pop {
  0%   { opacity: 0; transform: translateX(-50%) translateY(0px)   scale(0.7); }
  15%  { opacity: 1; transform: translateX(-50%) translateY(-12px) scale(1.2); }
  70%  { opacity: 1; transform: translateX(-50%) translateY(-48px) scale(1.05); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-72px) scale(0.95); }
}
@keyframes demo-scanlines-scroll {
  0%   { background-position: 0 0; }
  100% { background-position: 0 8px; }
}
@keyframes demo-scanline-sweep {
  0%   { top: -6px; opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
`

// ── Exp helpers ────────────────────────────────────────────────────────────────
function getExpRank(exp: number): { level: number; title: string; barColor: string } {
  if (exp >= 80) return { level: 5, title: 'Champion', barColor: '#22c55e' }
  if (exp >= 60) return { level: 4, title: 'Ally',     barColor: '#84cc16' }
  if (exp >= 40) return { level: 3, title: 'Contact',  barColor: '#eab308' }
  if (exp >= 20) return { level: 2, title: 'Prospect', barColor: '#f97316' }
  if (exp > 0)   return { level: 1, title: 'Stranger', barColor: '#ef4444' }
  return               { level: 0, title: 'Unknown',  barColor: '#555555' }
}

function ExpBar({ exp }: { exp: number }) {
  const { level, title, barColor } = getExpRank(exp)
  return (
    <div className="flex flex-col gap-0.5 w-20 shrink-0">
      <div className="h-1.5 w-full bg-border overflow-hidden">
        <div className="h-full transition-all duration-500" style={{ width: `${exp}%`, backgroundColor: barColor }} />
      </div>
      <span className="font-pixel text-[8px] text-muted leading-none">LVL {level} · {title}</span>
    </div>
  )
}

// ── Contacts ──────────────────────────────────────────────────────────────────
function makeContact(id: string, name: string, company: string, daysAgo: number | null): Contact {
  return {
    id,
    userId: 'demo',
    name,
    company,
    lastInteractionAt: daysAgo === null ? null : new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    commExp: daysAgo === null ? 0 : daysAgo <= 7 ? 65 : daysAgo <= 14 ? 45 : daysAgo <= 30 ? 25 : 10,
    lastCommAt: daysAgo === null ? null : new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
  }
}

const DEMO_CONTACTS: Array<{
  contact: Contact
  aiDraft: string
}> = [
  {
    contact: makeContact('c1', 'Ada Lovelace',   'Aperture Science', 8),
    aiDraft: `Hi Ada,\n\nYour work at Aperture Science caught my eye — the engineering culture there looks genuinely exciting. I'm exploring new opportunities and would love to hear your perspective.\n\nOpen to a quick chat?`,
  },
  {
    contact: makeContact('c2', 'Alan Turing',    'Initech', 15),
    aiDraft: `Hey Alan,\n\nI've been following the work coming out of Initech and think there's a strong alignment with what I'm looking for next.\n\nWould you be up for a 15-minute call sometime?`,
  },
  {
    contact: makeContact('c3', 'Grace Hopper',   'Umbrella Corp', 30),
    aiDraft: `Hi Grace,\n\nYour background at Umbrella Corp is really impressive — especially the systems work. I'd love to connect and learn more about your experience there.\n\nAny chance you'd be open to a coffee chat?`,
  },
]

const SEED_JOBS: Record<string, { id: string; title: string; company: string }[]> = {
  c1: [{ id: 'j1', title: 'Frontend Engineer', company: 'Aperture Science' }],
  c2: [], c3: [],
}

const AI_TOKEN_SPEED = 3
const CONTACT_XP_PER_COMM = 10

type RowStep = 'idle' | 'ai_generating' | 'ai_ready' | 'commed'

interface RowState {
  contact: Contact
  exp: number
  step: RowStep
  aiDraft: string
  aiPhase: AiPhase
  aiDots: number
  commXpPop: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NetworkDemo({ mouse, index = 0, expanded = false }: { mouse: { x: number; y: number }; index?: number; expanded?: boolean }) {
  const [rows, setRows] = useState<RowState[]>(
    DEMO_CONTACTS.map(({ contact }) => ({
      contact,
      exp: contact.commExp,
      step: 'idle' as RowStep,
      aiDraft: '',
      aiPhase: 'idle' as AiPhase,
      aiDots: 0,
      commXpPop: false,
    }))
  )
  const [revealed, setRevealed] = useState(false)

  const clickIndexRef = useRef(0)
  const lastClickRef = useRef(0)
  const aiRafRef = useRef<number | null>(null)
  const dotsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})
  const tableWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 1400)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    return () => {
      if (aiRafRef.current) cancelAnimationFrame(aiRafRef.current)
      if (dotsIntervalRef.current) clearInterval(dotsIntervalRef.current)
    }
  }, [])

  // ── AI stream simulation ──────────────────────────────────────────────────
  function streamAiDraft(contactId: string, fullDraft: string) {
    if (aiRafRef.current) cancelAnimationFrame(aiRafRef.current)
    let elapsed = 0
    let lastTs: number | null = null

    function tick(ts: number) {
      if (lastTs !== null) elapsed += ts - lastTs
      lastTs = ts
      const charsRevealed = Math.min(Math.floor(elapsed / AI_TOKEN_SPEED), fullDraft.length)
      setRows(prev => prev.map(r =>
        r.contact.id === contactId ? { ...r, aiDraft: fullDraft.slice(0, charsRevealed) } : r
      ))
      if (charsRevealed < fullDraft.length) {
        aiRafRef.current = requestAnimationFrame(tick)
      } else {
        aiRafRef.current = null
        playAiDing()
        setRows(prev => prev.map(r =>
          r.contact.id === contactId ? { ...r, aiPhase: 'ready', step: 'ai_ready' } : r
        ))
      }
    }
    aiRafRef.current = requestAnimationFrame(tick)
  }

  // ── Click handler ─────────────────────────────────────────────────────────

  function handleClick() {
    const now = Date.now()
    if (now - lastClickRef.current < 500) return
    lastClickRef.current = now

    // find the next contact that isn't fully done (commed), or loop back
    const total = DEMO_CONTACTS.length
    let targetIdx = clickIndexRef.current % total
    const { contact, aiDraft: fullDraft } = DEMO_CONTACTS[targetIdx]
    const contactId = contact.id

    setRows(prev => {
      const row = prev.find(r => r.contact.id === contactId)
      if (!row) return prev

      if (row.step === 'idle' || row.step === 'commed') {
        // Click 1: draft
        playAiConsume()
        if (dotsIntervalRef.current) clearInterval(dotsIntervalRef.current)
        streamAiDraft(contactId, fullDraft)
        return prev.map(r =>
          r.contact.id === contactId
            ? { ...r, step: 'ai_generating', aiPhase: 'generating', aiDraft: '', commXpPop: false }
            : r
        )
      }

      if (row.step === 'ai_generating' || row.step === 'ai_ready') {
        if (aiRafRef.current) cancelAnimationFrame(aiRafRef.current)
        if (dotsIntervalRef.current) clearInterval(dotsIntervalRef.current)
        playPingBlip()
        const newExp = Math.min(100, row.exp + CONTACT_XP_PER_COMM)
        clickIndexRef.current++
        setTimeout(() => setRows(p => p.map(r =>
          r.contact.id === contactId ? { ...r, commXpPop: false } : r
        )), 1200)
        return prev.map(r =>
          r.contact.id === contactId
            ? { ...r, step: 'commed', exp: newExp, aiPhase: 'idle', commXpPop: true }
            : r
        )
      }

      return prev
    })
  }

  const TILT_MAX = 3
  const depth = 1 + index * 0.4
  const rotX = -mouse.y * TILT_MAX * depth
  const rotY = mouse.x * TILT_MAX * depth

  const currentRow = rows[clickIndexRef.current % DEMO_CONTACTS.length]
  const footerHint = currentRow?.step === 'ai_generating' || currentRow?.step === 'ai_ready'
    ? 'CLICK TO LOG COMM'
    : 'CLICK TO DRAFT OUTREACH'

  return (
    <>
      <style>{DEMO_KEYFRAMES}</style>

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
          style={{
            position: 'absolute',
            inset: 0,
            transform: 'translateZ(-60px)',
            background: 'var(--color-border)',
            opacity: 0.8,
          }}
        />

        <div
          className="border border-border bg-bg font-pixel text-primary overflow-hidden select-none"
          style={{
            transform: 'translateZ(0)',
            position: 'relative',
            height: expanded ? '840px' : '420px',
            transition: 'height 0.4s ease',
            cursor: 'pointer',
          }}
          onClick={handleClick}
        >
          {!revealed && (
            <div
              className="absolute left-0 w-full h-1.5 bg-secondary z-10"
              style={{ opacity: 0.7, animation: 'demo-scanline-sweep 0.6s linear infinite', top: '-6px' }}
            />
          )}

          {/* Network graph */}
          <div className="relative" style={{ height: '180px' }}>
            <NetworkBackdrop
              contacts={rows.map(r => r.contact)}
              jobsByContact={SEED_JOBS}
              expanded={false}
              expOverrides={Object.fromEntries(rows.map(r => [r.contact.id, r.exp]))}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[9px] text-muted tracking-widest opacity-60">YOUR NETWORK</span>
            </div>
          </div>

          {/* Contact rows — no scroll */}
          <div ref={tableWrapRef} className="overflow-hidden" style={{ height: '210px', position: 'relative' }}>
            <table className="border-collapse text-xs w-full" style={{ cursor: 'pointer' }}>
              <thead>
                <tr className="border-b border-border text-muted text-left">
                  <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal">NAME</th>
                  <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal">COMPANY</th>
                  <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal">COMM EXP</th>
                  <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr
                    key={row.contact.id}
                    ref={el => { rowRefs.current[row.contact.id] = el }}
                    className="border-b border-border"
                  >
                    <td className="px-3 py-2 text-xs text-primary truncate max-w-[100px]">{row.contact.name}</td>
                    <td className="px-3 py-2 text-xs text-muted truncate max-w-[100px]">{row.contact.company ?? '—'}</td>
                    <td className="px-3 py-2 relative">
                      <ExpBar exp={row.exp} />
                      {row.commXpPop && (
                        <span
                          className="pointer-events-none absolute font-pixel"
                          style={{
                            left: '50%',
                            top: 0,
                            fontSize: '0.65rem',
                            color: '#22c55e',
                            animation: 'demo-comm-xp-pop 1.1s ease-out forwards',
                            whiteSpace: 'nowrap',
                            zIndex: 20,
                          }}
                        >
                          +{CONTACT_XP_PER_COMM} COMM XP
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.step === 'commed' ? (
                        <span className="font-pixel text-[8px] px-2 py-1 border border-primary text-bg bg-primary inline-block text-center w-[72px]">✓ SENT</span>
                      ) : (row.step === 'ai_generating' || row.step === 'ai_ready') ? (
                        <AiButton label="DRAFT" phase={row.aiPhase} dots={row.aiDots} onClick={handleClick} />
                      ) : (
                        <AiButton label="DRAFT" phase="idle" dots={0} onClick={handleClick} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* AI draft overlay — covers the full rows area */}
            {rows.map(row => {
              if (row.step !== 'ai_generating' && row.step !== 'ai_ready') return null
              return (
                <div
                  key={`${row.contact.id}-overlay`}
                  className="absolute inset-0 bg-bg font-pixel flex flex-col"
                  style={{ zIndex: 10, padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}
                >
                  <div className="text-muted text-[9px] tracking-widest mb-2">// AI OUTREACH DRAFT · {row.contact.name}</div>
                  <pre className="text-primary text-[11px] whitespace-pre-wrap leading-relaxed font-pixel flex-1 overflow-hidden">{row.aiDraft}</pre>
                  <div className="flex justify-center mt-2">
                    <button
                      onClick={e => { e.stopPropagation(); handleClick() }}
                      className="font-pixel text-[9px] px-6 py-1.5 border border-secondary text-secondary hover:border-primary hover:text-primary transition-colors"
                      style={{ cursor: 'pointer' }}
                    >
                      COMM
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border flex items-center justify-between">
            <span className="text-[9px] text-muted tracking-widest">
              {rows.length} CONTACT{rows.length !== 1 ? 'S' : ''} IN YOUR NETWORK
            </span>
            <span className="text-[9px] text-muted tracking-widest">{footerHint}</span>
          </div>

          {revealed && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)',
                backgroundSize: '100% 4px',
                animation: 'demo-scanlines-scroll 0.3s linear infinite',
                mixBlendMode: 'multiply',
              }}
            />
          )}
        </div>
      </div>
    </>
  )
}
