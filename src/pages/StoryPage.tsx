import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RANK_THRESHOLDS, RANK_TITLES } from '@/config/game'
import { readCache } from '@/services/jobService'
import { supabase } from '@/lib/supabase'
import { playStoryChime, playFanfare } from '@/lib/sfx'
import TutorialModal from '@/components/modals/TutorialModal'
import { registerTutorialTrigger, unregisterTutorialTrigger, broadcastTutorialActive } from '@/lib/tutorialBus'
import { lsGet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import { STORY_STEPS } from '@/lib/tutorialSteps'
import XpTracker from '@/components/hud/XpTracker'
import { Movement } from '@/components/story/scenes/6-Movement'
import { Victory } from '@/components/story/scenes/11-Victory'
import { useXp, getRankInfo } from '@/services/xpService'
import { SCENES } from '@/components/story/scenes'
import type { ComponentType } from 'react'

// Rank → scene component. Add entries here as new scenes are written.
const RANK_SCENES: Partial<Record<number, ComponentType<{ onComplete: () => void }>>> = {
  1:  SCENES.find(s => s.label === '1-Intro')?.component,
  4:  SCENES.find(s => s.label === '4-Nerve')?.component,
  6:  Movement,
  8:  SCENES.find(s => s.label === '8-Heart')?.component,
  10: SCENES.find(s => s.label === '10-Run')?.component,
}

const DEV_BYPASS = import.meta.env['VITE_DEV_BYPASS'] === 'true'

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
const AI_BUMP_RANK = 5

const RANK_REWARDS: Partial<Record<number, string>> = {
  [AI_BUMP_RANK]: '20 free AI credits/mo',
  7:              '30 free AI credits/mo',
}


// ── Page ──────────────────────────────────────────────────────────────────────
const STORY_AVATAR_CHARS = ['◉', '◈', '◆', '▣', '★', '✦', '⬡', '⬟', '◉', '✸', '✺']

export default function StoryPage({ userId }: { userId: string | null }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showTutorial, setShowTutorial] = useState(false)
  const { xp } = useXp(userId)
  const [employed, setEmployed] = useState(false)
  const [loading, setLoading] = useState(() => {
    return userId ? readCache(userId).length === 0 : true
  })
  const [togglingEmployed, setTogglingEmployed] = useState(false)
  const [fanfare, setFanfare] = useState(false)
  const [cutscene, setCutscene] = useState(false)
  const [devMenuOpen, setDevMenuOpen] = useState(false)
  const [activeScene, setActiveScene] = useState<number | null>(null)
  const [activeRankScene, setActiveRankScene] = useState<number | null>(null)
  const [seenScenes, setSeenScenes] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem('fjobhunt:seen-scenes')
      return stored ? new Set(JSON.parse(stored) as number[]) : new Set()
    } catch { return new Set() }
  })
  function handleRankSceneComplete(rank: number) {
    setActiveRankScene(null)
    setSeenScenes(prev => {
      const next = new Set(prev)
      next.add(rank)
      try { localStorage.setItem('fjobhunt:seen-scenes', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  useEffect(() => {
    if (searchParams.get('tutorial') === '1') {
      setShowTutorial(true)
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { broadcastTutorialActive(showTutorial) }, [showTutorial])

  useEffect(() => {
    registerTutorialTrigger(() => setShowTutorial(true))
    if (!userId) return () => { unregisterTutorialTrigger() }
    const seen = lsGet<boolean>(SK.tutorialSeen(userId, 'story'), false)
    if (!seen) {
      const id = setTimeout(() => setShowTutorial(true), 800)
      return () => { clearTimeout(id); unregisterTutorialTrigger() }
    }
    return () => { unregisterTutorialTrigger() }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { playStoryChime() }, [])

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let cancelled = false

    async function init() {
      const progressResult = await supabase.from('game_progress').select('employed').eq('user_id', userId!).single()
      if (cancelled) return
      if (progressResult.data) setEmployed(!!progressResult.data.employed)
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
    await supabase.from('game_progress').upsert({ user_id: userId!, employed: next })
    setTogglingEmployed(false)
  }

  async function handleGotJob() {
    if (employed || togglingEmployed || !userId) return
    playFanfare()
    setFanfare(true)
    setTogglingEmployed(true)
    await supabase.from('game_progress').upsert({ user_id: userId!, employed: true })
    setTogglingEmployed(false)
    setEmployed(true)
    // Let the fanfare play out, then fade music out and show cutscene
    setTimeout(() => window.dispatchEvent(new CustomEvent('fjobhunt:music-fade')), 800)
    setTimeout(() => setCutscene(true), 1400)
  }

  function handleCutsceneComplete() {
    setCutscene(false)
    navigate('/credits')
  }

  const { rank: currentRank, progress, isMax } = getRankInfo(xp ?? 0)

  const effectiveRank = currentRank
  const effectiveProgress = progress

  return (
    <div className="h-full bg-bg font-pixel text-primary scanlines flex flex-col overflow-hidden">

      {/* Rank dialogue scenes */}
      {activeRankScene !== null && (() => {
        const Scene = RANK_SCENES[activeRankScene]
        return Scene ? <Scene onComplete={() => handleRankSceneComplete(activeRankScene)} /> : null
      })()}


      {/* Victory cutscene */}
      {cutscene && (
        <Victory
          onComplete={handleCutsceneComplete}
        />
      )}


      {/* Dev scene preview — only in DEV_BYPASS mode */}
      {DEV_BYPASS && activeScene !== null && (() => {
        const Scene = SCENES[activeScene].component
        return <Scene onComplete={() => setActiveScene(null)} />
      })()}

      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 shrink-0 min-h-[100px]">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-sm tracking-widest">STORY</h1>
            <p className="text-muted text-xs mt-1">your hunt, chapter by chapter</p>
          </div>

          {/* Dev scene picker */}
          {DEV_BYPASS && (
            <div className="relative ml-2">
              <button
                onClick={() => setDevMenuOpen(o => !o)}
                className="text-[9px] text-muted border border-border px-2 py-1 hover:opacity-70 tracking-widest"
                title="Dev: preview scenes"
              >
                ☰
              </button>
              {devMenuOpen && (
                <div className="absolute left-0 top-full mt-1 bg-surface border border-border z-40 min-w-[180px] flex flex-col">
                  <div className="text-[8px] text-muted tracking-widest px-3 py-2 border-b border-border">SCENES</div>
                  {SCENES.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setActiveScene(i); setDevMenuOpen(false) }}
                      className="text-[9px] text-primary text-left px-3 py-2 hover:bg-border"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button className="cursor-default">
          <XpTracker xp={xp} />
        </button>
      </div>

      {/* Map */}
      <div data-tutorial="story-map" className="flex-1 overflow-auto flex items-center justify-center py-8 px-4">
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
                        stroke={employed ? '#f5c518' : 'var(--color-secondary)'}
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

              const isGold    = employed
              const unlocked  = rank < currentRank
              const isCurrent = rank === currentRank
              const locked    = rank > currentRank

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

                  {(() => {
                    const hasScene = !!RANK_SCENES[rank]
                    const clickable = !locked && hasScene
                    const unseen = hasScene && !seenScenes.has(rank)
                    const symbol = locked ? '▨' : (unseen ? '▶' : avatarChar)

                    function handleNodeClick() {
                      if (hasScene) setActiveRankScene(rank)
                    }

                    return clickable ? (
                      <button
                        onClick={handleNodeClick}
                        className={`w-full h-full rounded-full flex items-center justify-center select-none ${nodeBg} hover:opacity-70 transition-none`}
                        style={isGold ? { borderColor: '#f5c518' } : undefined}
                      >
                        <span
                          className={`text-xl ${textColor}`}
                          style={{ lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {symbol}
                        </span>
                      </button>
                    ) : (
                      <div
                        className={`w-full h-full rounded-full flex items-center justify-center select-none ${nodeBg}`}
                        style={isGold ? { borderColor: '#f5c518' } : undefined}
                      >
                        <span
                          className={`text-xl ${textColor}`}
                          style={{ lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {symbol}
                        </span>
                      </div>
                    )
                  })()}

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


                    {locked && rank < 11 && (
                      <div className="text-[9px] text-muted mt-0.5">
                        {RANK_THRESHOLDS[rank]} XP
                      </div>
                    )}

                    {/* Reward hint — shown on locked and current nodes */}
                    {(locked || isCurrent) && RANK_REWARDS[rank] && (
                      <div className="text-[9px] text-primary mt-0.5 opacity-30">
                        {RANK_REWARDS[rank]}
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

      {showTutorial && userId && (
        <TutorialModal steps={STORY_STEPS} screen="story" userId={userId} onDone={() => setShowTutorial(false)} />
      )}

      {/* Big "I Got a Job!" button */}
      {!loading && (
        <div data-tutorial="story-got-job" className="shrink-0 flex flex-col items-center gap-3 py-6">
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
