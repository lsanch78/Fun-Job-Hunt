import { useState, useEffect } from 'react'
import { XP, RANK_THRESHOLDS, RANK_TITLES } from '@/config/game'
import { readCache, fetchJobs } from '@/services/jobService'
import { supabase } from '@/lib/supabase'

// ── Sound: story page entry chime ─────────────────────────────────────────────
function playStoryChime() {
  try {
    const ctx = new AudioContext()
    const notes = [440.00, 329.63]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.22
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.07, t + 0.04)
      gain.gain.setValueAtTime(0.07, t + 0.18)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65)
      osc.start(t)
      osc.stop(t + 0.65)
    })
  } catch { /* AudioContext blocked */ }
}

// ── Fanfare sound (Web Audio API — no file needed) ────────────────────────────
function playFanfare() {
  try {
    const ctx = new AudioContext()
    // A short ascending trumpet-ish fanfare: C5 E5 G5 C6
    const notes = [
      { freq: 523.25, start: 0.00, dur: 0.18 },
      { freq: 659.25, start: 0.16, dur: 0.18 },
      { freq: 783.99, start: 0.30, dur: 0.18 },
      { freq: 1046.5, start: 0.44, dur: 0.55 },
    ]
    notes.forEach(({ freq, start, dur }) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(0, ctx.currentTime + start)
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur)
    })
    setTimeout(() => ctx.close(), 1400)
  } catch {
    // AudioContext unavailable — silent fail
  }
}

// ── Rank helpers ──────────────────────────────────────────────────────────────
function getRankInfo(xp: number) {
  let rank = 1
  for (let i = 1; i < RANK_THRESHOLDS.length; i++) {
    if (xp >= RANK_THRESHOLDS[i]) rank = i
    else break
  }
  const isMax = rank >= RANK_THRESHOLDS.length - 1
  const currentFloor = RANK_THRESHOLDS[rank]
  const nextFloor = isMax ? currentFloor : RANK_THRESHOLDS[rank + 1]
  const progress = isMax ? 1 : (xp - currentFloor) / (nextFloor - currentFloor)
  return { rank, title: RANK_TITLES[rank] ?? '', progress, xp, nextFloor, isMax }
}

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
`
if (typeof document !== 'undefined' && !document.getElementById('story-keyframes')) {
  const el = document.createElement('style')
  el.id = 'story-keyframes'
  el.textContent = PULSE_STYLE
  document.head.appendChild(el)
}

// ── Page ──────────────────────────────────────────────────────────────────────
const STORY_AVATAR_CHARS = ['◉', '◈', '◆', '▣', '★', '✦', '⬡', '⬟', '◉', '✸', '✺']

export default function StoryPage({ userId }: { userId: string | null }) {
  const [xp, setXp] = useState(() => {
    const cached = userId ? readCache(userId) : []
    return cached.length * XP.ADD_JOB
  })
  const [employed, setEmployed] = useState(false)
  const [loading, setLoading] = useState(() => {
    return userId ? readCache(userId).length === 0 : true
  })
  const [togglingEmployed, setTogglingEmployed] = useState(false)
  const [fanfare, setFanfare] = useState(false)

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
      setXp(dbJobs.length * XP.ADD_JOB)
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
    setEmployed(true)
    setTogglingEmployed(true)
    await supabase.from('profiles').update({ employed: true }).eq('id', userId)
    setTogglingEmployed(false)
  }

  const { rank: currentRank, progress, nextFloor, isMax } = getRankInfo(xp)
  const headerAvatarChar = STORY_AVATAR_CHARS[(currentRank - 1) % STORY_AVATAR_CHARS.length]
  const headerBarPct = Math.round(progress * 100)

  // When employed, treat every node as fully unlocked
  const effectiveRank = employed ? 12 : currentRank
  const effectiveProgress = employed ? 1 : progress

  return (
    <div className="h-full bg-bg font-pixel text-primary scanlines flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-sm tracking-widest">STORY</h1>
          <p className="text-muted text-xs mt-1">your hunt, chapter by chapter</p>
        </div>

        <div className="flex items-center gap-3 border border-border px-4 py-2.5 bg-surface">
          <div className="text-2xl leading-none text-secondary select-none" title={`Rank ${currentRank}`}>
            {headerAvatarChar}
          </div>
          <div className="flex flex-col gap-1 w-[200px]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-secondary text-[11px] tracking-widest uppercase leading-none">
                LVL {currentRank}
              </span>
              <span className="text-muted text-[9px] leading-none">
                {isMax ? 'MAX' : `${xp} / ${nextFloor} XP`}
              </span>
            </div>
            <div className="text-primary text-[9px] leading-tight">
              {RANK_TITLES[currentRank]}
            </div>
            <div className="w-full h-1.5 bg-border">
              <div
                className="h-full bg-secondary transition-all duration-500"
                style={{ width: `${headerBarPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 overflow-auto flex items-start justify-center py-8 px-4">
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
