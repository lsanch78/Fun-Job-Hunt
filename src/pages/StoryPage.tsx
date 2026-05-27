import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { RANK_THRESHOLDS, RANK_TITLES } from '@/config/game'
import { readCache, fetchJobs } from '@/services/jobService'
import { supabase } from '@/lib/supabase'
import { playStoryChime, playFanfare, isSfxMuted } from '@/lib/sfx'
import XpTracker from '@/components/XpTracker'
import { calculateXp, getRankInfo } from '@/services/xpService'

// ── S-path node positions ─────────────────────────────────────────────────────
const NODE_COLS = 4
const NODE_POSITIONS: { rank: number; col: number; row: number }[] = [
  { rank: 1,  col: 0, row: 0 },
  { rank: 2,  col: 1, row: 0 },
  { rank: 3,  col: 2, row: 0 },
  { rank: 4,  col: 3, row: 0 },
  { rank: 5,  col: 3, row: 1 },
  { rank: 6,  col: 2, row: 1 },
  { rank: 7,  col: 1, row: 1 },
  { rank: 8,  col: 0, row: 1 },
  { rank: 9,  col: 0, row: 2 },
  { rank: 10, col: 1, row: 2 },
  { rank: 11, col: 2, row: 2 },
]

const COL_W = 160
const ROW_H = 180
const NODE_R = 32
const OFFSET_X = 56
const OFFSET_Y = 64

function nodeCenter(col: number, row: number) {
  return {
    x: OFFSET_X + col * COL_W,
    y: OFFSET_Y + row * ROW_H,
  }
}

const SVG_W = OFFSET_X + (NODE_COLS - 1) * COL_W + OFFSET_X
const SVG_H = OFFSET_Y + 2 * ROW_H + OFFSET_Y

function buildSegments() {
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (let i = 0; i < NODE_POSITIONS.length - 1; i++) {
    const a = NODE_POSITIONS[i]
    const b = NODE_POSITIONS[i + 1]
    const ca = nodeCenter(a.col, a.row)
    const cb = nodeCenter(b.col, b.row)
    segs.push({ x1: ca.x, y1: ca.y, x2: cb.x, y2: cb.y })
  }
  return segs
}

const SEGMENTS = buildSegments()

// Inject keyframes once
const PULSE_STYLE = `
@keyframes story-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.12); }
}
@keyframes story-glow {
  0%, 100% { filter: drop-shadow(0 0 6px var(--color-secondary)); }
  50% { filter: drop-shadow(0 0 14px var(--color-secondary)); }
}
@keyframes story-gold-glow {
  0%, 100% { filter: drop-shadow(0 0 8px #f5c518); }
  50% { filter: drop-shadow(0 0 18px #f5c518); }
}
@keyframes fanfare-pop {
  0%   { transform: scale(0.6) rotate(-4deg); opacity: 0; }
  60%  { transform: scale(1.12) rotate(2deg); opacity: 1; }
  80%  { transform: scale(0.96) rotate(-1deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes fanfare-pulse {
  0%, 100% { box-shadow: 0 0 0 0 #f5c51866; }
  50%       { box-shadow: 0 0 0 16px #f5c51800; }
}
@keyframes victory-text {
  0%   { letter-spacing: 0.05em; opacity: 0.7; }
  50%  { letter-spacing: 0.25em; opacity: 1; }
  100% { letter-spacing: 0.05em; opacity: 0.7; }
}
@keyframes node-unlock {
  0%   { transform: scale(0.7); opacity: 0.3; }
  60%  { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes fadeInBlack {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes creditsScroll {
  0%   { transform: translateY(0); }
  100% { transform: translateY(-100%); }
}
`
if (typeof document !== 'undefined' && !document.getElementById('story-keyframes')) {
  const el = document.createElement('style')
  el.id = 'story-keyframes'
  el.textContent = PULSE_STYLE
  document.head.appendChild(el)
}

// ── Cutscene ──────────────────────────────────────────────────────────────────
const VICTORY_LINES = [
  '> QUEST COMPLETE.',
  '',
  'After countless applications...',
  'Rejected. Ghosted. Forgotten.',
  '',
  'You kept going.',
  '',
  'Every cover letter.',
  'Every follow-up email.',
  'Every silent inbox.',
  '',
  'It was all leading here.',
  '',
  '> OFFER ACCEPTED.',
  '',
  '★  YOU GOT THE JOB.  ★',
]

const CREDITS_TEXT = [
  '— Fun Job Hunt —',
  '',
  'FROM THE DEV',
  '',
  'Hi! I care about you and want to',
  'thank you for taking the time',
  'to read this.',
  '',
  'The professional world can feel cold.',
  '',
  'I worked food and beverage for 10 years',
  'before pursuing a software engineering',
  'degree at ASU.',
  '',
  'When I started applying to jobs I was',
  'completely behind my peers when it came',
  'to speaking "professionally",',
  'writing resumes, interviewing,',
  'and wowing recruiters.',
  '',
  'We are in the wild west of AI recruiting.',
  'People are submitting perfectly tailored',
  'resumes to perfectly crafted job descriptions',
  'to get rejected by AI seeking the',
  'perfect candidate.',
  '',
  "It's a little funny.",
  "We've essentially nullified AI's ability",
  'by using it everywhere.',
  '',
  'The bar is higher than it\'s ever been',
  'for new grads.',
  '',
  'So I made this app to help me navigate',
  'this space by gamifying it.',
  '',
  'This app is 100% free.',
  '',
  'If it helped you get employed or',
  'brought you joy in any capacity —',
  'reach out. Always happy to make',
  'new friends.',
  '',
  'Thank you,',
  'Luis',
  '',
  '',
  'LINKS',
  '',
  'linkedin.com/in/luisbuenrostro',
  'ko-fi.com/farewellblu',
  'luisbuenrostro.dev',
]

// Total scroll duration in ms — tune to match song intro
const SCROLL_DURATION = 55000

function VictoryCutscene({ onComplete }: { onComplete: () => void }) {
  const [scrollDone, setScrollDone] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const navigate = useNavigate()

  // Play mp3 on mount
  useEffect(() => {
    const audio = new Audio('/congratulations.mp3')
    audio.volume = isSfxMuted() ? 0 : 0.8
    audio.play().catch(() => {})
    audioRef.current = audio
    return () => { audio.pause(); audio.src = '' }
  }, [])

  // Show CONTINUE after scroll finishes
  useEffect(() => {
    const t = setTimeout(() => setScrollDone(true), SCROLL_DURATION - 6000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 bg-black overflow-hidden flex flex-col items-center"
      style={{ fontFamily: '"Press Start 2P", monospace' }}
    >
      {/* Top + bottom fade masks */}
      <div className="absolute inset-x-0 top-0 h-32 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, black 40%, transparent)' }} />
      <div className="absolute inset-x-0 bottom-0 h-32 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to top, black 40%, transparent)' }} />

      {/* Scrolling text block */}
      <div
        className="w-full max-w-4xl flex flex-col gap-5 px-8"
        style={{
          animation: `creditsScroll ${SCROLL_DURATION}ms linear forwards`,
          paddingTop: '100vh',
          paddingBottom: '0',
        }}
      >
        {/* Victory lines */}
        {VICTORY_LINES.map((line, i) => (
          <div
            key={`v-${i}`}
            className={[
              'leading-relaxed text-center',
              line === '★  YOU GOT THE JOB.  ★' ? 'text-[#f5c518] text-sm' : 'text-xs',
              line.startsWith('>') ? 'text-green-400' : 'text-gray-300',
              line === '' ? 'h-3' : '',
            ].join(' ')}
          >
            {line}
          </div>
        ))}

        {/* Divider */}
        <div className="h-16" />

        {/* Photos */}
        <div className="grid grid-cols-3 gap-3">
          {['/me1.webp', '/me2.webp', '/me3.webp'].map((src, i) => (
            <div key={i} className="border border-gray-700 overflow-hidden">
              <img
                src={src}
                alt={`photo ${i + 1}`}
                className="w-full h-28 object-cover object-top"
                loading="eager"
              />
            </div>
          ))}
        </div>

        <div className="h-8" />

        {/* Credits text */}
        {CREDITS_TEXT.map((line, i) => (
          <div
            key={`c-${i}`}
            className={[
              'leading-relaxed text-center',
              line === 'FROM THE DEV' || line === 'LINKS' ? 'text-[10px] text-secondary tracking-widest border-b border-gray-700 pb-2' : 'text-xs text-gray-300',
              line === '' ? 'h-3' : '',
              line.startsWith('linkedin') || line.startsWith('ko-fi') || line.startsWith('luis') ? 'text-green-400' : '',
            ].join(' ')}
          >
            {line}
          </div>
        ))}
      </div>

      {/* CONTINUE appears after scroll */}
      {scrollDone && (
        <button
          onClick={() => { onComplete(); navigate('/credits') }}
          className="absolute bottom-12 text-xs text-[#f5c518] border border-[#f5c518] px-6 py-3 hover:bg-[#f5c51822] transition-none z-20"
          style={{ animation: 'fanfare-pulse 2s ease-in-out infinite' }}
        >
          CONTINUE  →
        </button>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const STORY_AVATAR_CHARS = ['◉', '◈', '◆', '▣', '★', '✦', '⬡', '⬟', '◉', '✸', '✺']

export default function StoryPage({ userId }: { userId: string | null }) {
  const [xp, setXp] = useState(() => {
    const cached = userId ? readCache(userId) : []
    return calculateXp(cached.length)
  })
  const [employed, setEmployed] = useState(false)
  const [loading, setLoading] = useState(() => {
    return userId ? readCache(userId).length === 0 : true
  })
  const [togglingEmployed, setTogglingEmployed] = useState(false)
  const [fanfare, setFanfare] = useState(false)
  const [fading, setFading]   = useState(false)
  const [cutscene, setCutscene] = useState(false)

  useEffect(() => { playStoryChime() }, [])

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let cancelled = false

    async function init() {
      const [profileResult, dbJobs] = await Promise.all([
        supabase.from('profiles').select('employed').eq('id', userId!).single(),
        fetchJobs(userId!),
      ])
      if (cancelled) return
      if (profileResult.data) setEmployed(!!profileResult.data.employed)
      setXp(calculateXp(dbJobs.length))
      setLoading(false)
    }

    init()
    return () => { cancelled = true }
  }, [userId])

  async function handleToggleEmployed() {
    if (!userId) return
    const next = !employed
    setEmployed(next)
    if (!next) setFanfare(false)
    setTogglingEmployed(true)
    await supabase.from('profiles').update({ employed: next }).eq('id', userId)
    setTogglingEmployed(false)
  }

  async function handleGotJob() {
    if (employed || togglingEmployed || !userId) return
    playFanfare()
    setFanfare(true)
    setTogglingEmployed(true)
    await supabase.from('profiles').update({ employed: true }).eq('id', userId)
    setTogglingEmployed(false)
    setEmployed(true)
    // Let the fanfare play out, then fade music + screen to black, then show cutscene
    setTimeout(() => {
      setFading(true)
      window.dispatchEvent(new CustomEvent('fjobhunt:music-fade'))
    }, 800)
    setTimeout(() => setCutscene(true), 1400)
  }

  function handleCutsceneComplete() {
    setCutscene(false)
    setFading(false)
  }

  const { rank: currentRank, progress, isMax } = getRankInfo(xp)

  // When employed, treat every node as fully unlocked
  const effectiveRank = employed ? 12 : currentRank
  const effectiveProgress = employed ? 1 : progress

  return (
    <div className="h-full bg-bg font-pixel text-primary scanlines flex flex-col overflow-hidden">

      {/* Fade-to-black overlay */}
      {fading && !cutscene && (
        <div
          className="fixed inset-0 z-40 bg-black pointer-events-none"
          style={{ animation: 'fadeInBlack 2s ease-in forwards' }}
        />
      )}

      {/* Victory cutscene */}
      {cutscene && <VictoryCutscene onComplete={handleCutsceneComplete} />}

      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-sm tracking-widest">STORY</h1>
          <p className="text-muted text-xs mt-1">your hunt, chapter by chapter</p>
        </div>

        <button className="cursor-default">
          <XpTracker xp={xp} />
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 overflow-auto flex items-center justify-center py-8 px-4">
        {loading ? (
          <div className="text-muted text-xs mt-16 animate-pulse">LOADING MAP…</div>
        ) : (
          <div className="relative" style={{ width: SVG_W, height: SVG_H }}>

            {/* SVG path lines */}
            <svg
              width={SVG_W}
              height={SVG_H}
              className="absolute inset-0 pointer-events-none"
              style={{ overflow: 'visible' }}
            >
              {SEGMENTS.map((seg, i) => {
                const fromRank = NODE_POSITIONS[i].rank
                const toRank   = NODE_POSITIONS[i + 1].rank
                const unlocked = fromRank <= effectiveRank && toRank <= effectiveRank
                const partial  = fromRank <= effectiveRank && toRank > effectiveRank
                const goldLine = employed
                return (
                  <g key={i}>
                    <line
                      x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                      stroke="var(--color-border)"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                    />
                    {(unlocked || partial) && (
                      <line
                        x1={seg.x1} y1={seg.y1}
                        x2={unlocked ? seg.x2 : seg.x1 + (seg.x2 - seg.x1) * effectiveProgress}
                        y2={unlocked ? seg.y2 : seg.y1 + (seg.y2 - seg.y1) * effectiveProgress}
                        stroke={goldLine ? '#f5c518' : 'var(--color-secondary)'}
                        strokeWidth="2"
                      />
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Nodes */}
            {NODE_POSITIONS.map(({ rank, col, row }, idx) => {
              const { x, y } = nodeCenter(col, row)
              const isEmployedNode = rank === 11

              // When employed: every node is gold
              const isGold    = employed
              const unlocked  = employed ? true : rank < currentRank
              const isCurrent = employed ? false : rank === currentRank
              const locked    = employed ? false : rank > currentRank

              const avatarChar = STORY_AVATAR_CHARS[(rank - 1) % STORY_AVATAR_CHARS.length]

              const nodeStyle: React.CSSProperties = {
                position: 'absolute',
                left: x - NODE_R,
                top: y - NODE_R,
                width: NODE_R * 2,
                height: NODE_R * 2,
                // stagger the unlock pop animation by node index
                animation: isGold
                  ? `story-gold-glow 2s ease-in-out infinite, node-unlock 0.4s cubic-bezier(0.34,1.56,0.64,1) ${idx * 0.06}s both`
                  : isCurrent
                    ? 'story-glow 1.8s ease-in-out infinite'
                    : undefined,
              }

              const nodeBg = isGold
                ? 'bg-surface border-2'
                : unlocked
                  ? 'bg-surface border border-secondary'
                  : isCurrent
                    ? 'bg-surface border-2 border-secondary'
                    : 'bg-bg border border-border'

              const textColor = isGold ? 'text-[#f5c518]' : locked ? 'text-muted' : 'text-secondary'

              return (
                <div key={rank} style={nodeStyle}>
                  {isCurrent && (
                    <div
                      className="absolute rounded-full border border-secondary pointer-events-none"
                      style={{
                        inset: -6,
                        animation: 'story-pulse 1.8s ease-in-out infinite',
                        borderColor: 'var(--color-secondary)',
                      }}
                    />
                  )}

                  <div
                    className={`w-full h-full rounded-full flex items-center justify-center select-none ${nodeBg}`}
                    style={isGold ? { borderColor: '#f5c518' } : undefined}
                  >
                    <span
                      className={`text-xl ${textColor}`}
                      style={{ lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {locked ? '▨' : avatarChar}
                    </span>
                  </div>

                  <div className="absolute -top-1 -right-1 text-[9px] text-muted leading-none bg-bg px-0.5">
                    {rank}
                  </div>

                  <div
                    className="absolute w-[140px] text-center"
                    style={{ top: NODE_R * 2 + 6, left: '50%', transform: 'translateX(-50%)' }}
                  >
                    <div className={`text-[10px] leading-snug ${locked ? 'text-muted' : isGold ? 'text-[#f5c518]' : isCurrent ? 'text-primary' : 'text-muted'}`}>
                      {locked ? '???' : RANK_TITLES[rank]}
                    </div>

                    {isCurrent && !isMax && (
                      <div className="mt-1.5 w-[100px] mx-auto h-1 bg-border">
                        <div
                          className="h-full bg-secondary transition-all duration-500"
                          style={{ width: `${Math.round(effectiveProgress * 100)}%` }}
                        />
                      </div>
                    )}

                    {!isCurrent && !locked && !isGold && (
                      <div className="text-[9px] text-muted mt-0.5">✓ unlocked</div>
                    )}
                    {locked && rank < 11 && (
                      <div className="text-[9px] text-muted mt-0.5">
                        {RANK_THRESHOLDS[rank]} XP
                      </div>
                    )}

                    {/* Small undo on rank 11 when employed */}
                    {isEmployedNode && employed && (
                      <div className="mt-2">
                        <button
                          onClick={handleToggleEmployed}
                          disabled={togglingEmployed}
                          className="text-[9px] text-muted border border-border px-2 py-0.5 hover:opacity-60 disabled:opacity-30"
                        >
                          {togglingEmployed ? '…' : 'undo'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Big "I Got a Job!" button */}
      {!loading && (
        <div className="shrink-0 flex flex-col items-center gap-3 py-6 border-t border-border">
          {employed ? (
            <div
              className="text-center"
              style={{ animation: fanfare ? 'fanfare-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' : undefined }}
            >
              <div className="text-[#f5c518] text-2xl mb-1" style={{ animation: 'story-gold-glow 2s ease-in-out infinite' }}>★</div>
              <div className="text-[#f5c518] text-xs tracking-widest" style={{ animation: 'victory-text 2.4s ease-in-out infinite' }}>
                CONGRATULATIONS — YOU GOT THE JOB!
              </div>
            </div>
          ) : (
            <button
              onClick={handleGotJob}
              disabled={togglingEmployed}
              className="relative px-10 py-4 border-2 border-[#f5c518] text-[#f5c518] text-sm tracking-widest uppercase
                         bg-surface hover:bg-[#f5c51811] active:scale-95 transition-transform
                         disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ animation: 'fanfare-pulse 2s ease-in-out infinite' }}
            >
              {togglingEmployed ? '…' : '★  I GOT A JOB!  ★'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
