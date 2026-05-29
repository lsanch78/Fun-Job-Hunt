import { useMemo } from 'react'

const RAIN_STYLE = `
@keyframes rain-fall {
  0%   { transform: translateY(-120px); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateY(110vh); opacity: 0; }
}
`
if (typeof document !== 'undefined' && !document.getElementById('rain-keyframes')) {
  const el = document.createElement('style')
  el.id = 'rain-keyframes'
  el.textContent = RAIN_STYLE
  document.head.appendChild(el)
}

interface Drop {
  id: number
  left: number   // vw
  height: number // px
  delay: number  // s
  duration: number // s
  opacity: number
  width: number  // px
}

const DROP_COUNT = 140

function generateDrops(): Drop[] {
  return Array.from({ length: DROP_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    height: 12 + Math.random() * 24,
    delay: -(Math.random() * 4),   // negative delay = already mid-fall on mount
    duration: 1.2 + Math.random() * 1.2,
    opacity: 0.15 + Math.random() * 0.35,
    width: Math.random() < 0.5 ? 1 : 2,
  }))
}

export default function RainOverlay() {
  const drops = useMemo(generateDrops, [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {drops.map(drop => (
        <div
          key={drop.id}
          style={{
            position: 'absolute',
            left: `${drop.left}vw`,
            top: 0,
            width: drop.width,
            height: drop.height,
            background: `hsl(0,0%,${55 + Math.floor(drop.opacity * 100)}%)`,
            opacity: drop.opacity,
            animation: `rain-fall ${drop.duration}s ${drop.delay}s linear infinite`,
          }}
        />
      ))}
    </div>
  )
}
