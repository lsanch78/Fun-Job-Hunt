import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'pixelarticons/react'

// Song starts at 31s. Storm transition at 51s (20s of playback). Full storm at 1:06 (35s of playback).
const TRANSITION_START_MS = 20_000
const FULL_STORM_MS       = 35_000

const STYLE = `
@keyframes rtp-fall {
  0%   { transform: translateY(-80px) rotate(var(--r0)); opacity: 0; }
  8%   { opacity: 1; }
  92%  { opacity: 1; }
  100% { transform: translateY(110vh) rotate(var(--r1)); opacity: 0; }
}
@keyframes rtp-spin {
  0%   { transform: translateY(-80px) rotate(0deg); opacity: 0; }
  8%   { opacity: 1; }
  92%  { opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
}
@keyframes rtp-rain-fall {
  0%   { transform: translateY(-20px); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateY(110vh); opacity: 0; }
}
@keyframes rtp-day-night {
  0%   { background: #0a0a1a; }
  15%  { background: #1a1035; }
  25%  { background: #c2410c; }
  35%  { background: #1d4ed8; }
  50%  { background: #3b82f6; }
  65%  { background: #f59e0b; }
  75%  { background: #dc2626; }
  85%  { background: #312e81; }
  100% { background: #0a0a1a; }
}
`

if (typeof document !== 'undefined' && !document.getElementById('rtp-keyframes')) {
  const el = document.createElement('style')
  el.id = 'rtp-keyframes'
  el.textContent = STYLE
  document.head.appendChild(el)
}

const REJECTIONS = [
  "We've decided to move forward with other candidates",
  "Not a good fit at this time",
  "While there were many strong candidates",
  "We regret to inform you",
  "We'll keep your resume on file",
]

const ICON_COLORS = ['#f9a8d4', '#93c5fd', '#86efac', '#fcd34d', '#c4b5fd']
const ICON_COUNT = 25
const TEXT_COUNT = 3
const RAIN_COUNT = 120

const STARS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  top: Math.random() * 55,
  size: 1 + Math.random() * 2,
}))

function generateResumes() {
  return Array.from({ length: ICON_COUNT }, (_, i) => ({
    id: i,
    left: (i / ICON_COUNT) * 100 + (Math.random() * 4 - 2),
    delay: -(Math.random() * 10),
    duration: 4 + Math.random() * 4,
    opacity: 0.5 + Math.random() * 0.4,
    r0: -20 + Math.random() * 40,
    r1: -20 + Math.random() * 40,
    size: 20 + Math.random() * 28,
    spin: Math.random() < 0.3,
    color: ICON_COLORS[i % ICON_COLORS.length],
  }))
}

function generateTexts() {
  return Array.from({ length: TEXT_COUNT }, (_, i) => ({
    id: i,
    left: 10 + (i / TEXT_COUNT) * 70 + Math.random() * 8,
    delay: -(Math.random() * 10),
    duration: 7 + Math.random() * 5,
    opacity: 0.25 + Math.random() * 0.2,
    text: REJECTIONS[(i + Math.floor(Math.random() * REJECTIONS.length)) % REJECTIONS.length],
  }))
}

function generateRain() {
  return Array.from({ length: RAIN_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: -(Math.random() * 4),
    duration: 1.2 + Math.random() * 1.2,
    opacity: 0.15 + Math.random() * 0.35,
    width: Math.random() < 0.5 ? 1 : 2,
    height: 12 + Math.random() * 24,
  }))
}

export default function ResumeTimePassingOverlay() {
  const resumes = useMemo(generateResumes, [])
  const texts   = useMemo(generateTexts, [])
  const rain    = useMemo(generateRain, [])

  // 0 = calm, 1 = full storm. Interpolated between TRANSITION_START_MS and FULL_STORM_MS.
  const [stormProgress, setStormProgress] = useState(0)

  useEffect(() => {
    let raf: number
    const startedAt = performance.now()

    function tick() {
      const elapsed = performance.now() - startedAt
      if (elapsed < TRANSITION_START_MS) {
        setStormProgress(0)
      } else if (elapsed >= FULL_STORM_MS) {
        setStormProgress(1)
        return // done
      } else {
        const t = (elapsed - TRANSITION_START_MS) / (FULL_STORM_MS - TRANSITION_START_MS)
        setStormProgress(t)
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const stormOverlayOpacity = stormProgress
  const rainOpacity         = stormProgress
  const iconSaturation      = 1 - stormProgress
  const iconBrightness      = 1 - stormProgress * 0.6
  const starsOpacity        = stormProgress * 0.8
  const sunOpacity          = Math.max(0, 1 - stormProgress * 2)

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>

      {/* Looping day/night cycle */}
      <div style={{ position: 'absolute', inset: 0, background: '#0a0a1a', animation: 'rtp-day-night 20s linear infinite' }} />

      {/* Storm dark overlay — driven by stormProgress */}
      <div style={{ position: 'absolute', inset: 0, background: '#050508', opacity: stormOverlayOpacity }} />

      {/* Stars */}
      {STARS.map(star => (
        <div key={star.id} style={{
          position: 'absolute',
          left: `${star.left}%`,
          top: `${star.top}%`,
          width: star.size,
          height: star.size,
          borderRadius: '50%',
          background: '#fff',
          opacity: starsOpacity,
        }} />
      ))}

      {/* Sun */}
      <div style={{
        position: 'absolute',
        top: '30%',
        left: `${20 + stormProgress * 80}vw`,
        width: 48, height: 48,
        borderRadius: '50%',
        background: '#fbbf24',
        boxShadow: '0 0 40px 16px rgba(251,191,36,0.4)',
        opacity: sunOpacity,
        transform: `translateY(${stormProgress * 40}px)`,
      }} />

      {/* Resume icons — desaturate as storm hits */}
      <div style={{
        position: 'absolute', inset: 0,
        filter: `saturate(${iconSaturation}) brightness(${iconBrightness})`,
      }}>
        {resumes.map(item => (
          <div key={item.id} style={{
            position: 'absolute',
            left: `${item.left}vw`,
            top: 0,
            opacity: item.opacity,
            '--r0': `${item.r0}deg`,
            '--r1': `${item.r1}deg`,
            animation: `${item.spin ? 'rtp-spin' : 'rtp-fall'} ${item.duration}s ${item.delay}s linear infinite`,
            color: item.color,
          } as React.CSSProperties}>
            <FileText width={item.size} height={item.size} />
          </div>
        ))}
        {texts.map(item => (
          <div key={item.id} style={{
            position: 'absolute',
            left: `${item.left}vw`,
            top: 0,
            opacity: item.opacity,
            animation: `rtp-fall ${item.duration}s ${item.delay}s linear infinite`,
          }}>
            <span style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 10,
              whiteSpace: 'nowrap',
              display: 'block',
              color: 'rgba(255,255,255,0.6)',
            }}>
              {item.text}
            </span>
          </div>
        ))}
      </div>

      {/* Rain — fades in as storm arrives */}
      <div style={{ position: 'absolute', inset: 0, opacity: rainOpacity }}>
        {rain.map(drop => (
          <div key={drop.id} style={{
            position: 'absolute',
            left: `${drop.left}vw`,
            top: 0,
            width: drop.width,
            height: drop.height,
            background: `hsl(0,0%,${55 + Math.floor(drop.opacity * 100)}%)`,
            opacity: drop.opacity,
            animation: `rtp-rain-fall ${drop.duration}s ${drop.delay}s linear infinite`,
          }} />
        ))}
      </div>

    </div>
  )
}
