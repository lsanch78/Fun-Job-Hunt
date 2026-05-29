import { useMemo } from 'react'
import { FileText } from 'pixelarticons/react'

const STORM_STYLE = `
@keyframes resume-fall {
  0%   { transform: translateY(-120px) rotate(var(--r0)); opacity: 0; }
  8%   { opacity: 1; }
  92%  { opacity: 1; }
  100% { transform: translateY(110vh) rotate(var(--r1)); opacity: 0; }
}
`
if (typeof document !== 'undefined' && !document.getElementById('resume-storm-keyframes')) {
  const el = document.createElement('style')
  el.id = 'resume-storm-keyframes'
  el.textContent = STORM_STYLE
  document.head.appendChild(el)
}

const REJECTIONS = [
  "We've decided to move forward with other candidates",
  "Not a good fit at this time",
  "While there were many strong candidates",
  "We made the difficult decision of not moving forward with you",
  "We encourage you to reapply in the future",
  "We regret to inform you",
  "We wish you the best",
  "We'll keep your resume on file",
]

interface FallingItem {
  id: number
  left: number
  delay: number
  duration: number
  opacity: number
  r0: number
  r1: number
  type: 'icon' | 'text'
  size: number
  text: string
}

const ICON_COUNT = 30
const TEXT_COUNT = 4

function generateItems(): FallingItem[] {
  const icons: FallingItem[] = Array.from({ length: ICON_COUNT }, (_, i) => ({
    id: i,
    left: (i / ICON_COUNT) * 100 + (Math.random() * (100 / ICON_COUNT) - 50 / ICON_COUNT),
    delay: -(Math.random() * 8),
    duration: 3 + Math.random() * 3,
    opacity: 0.15 + Math.random() * 0.25,
    r0: -30 + Math.random() * 60,
    r1: -30 + Math.random() * 60,
    type: 'icon',
    size: 28 + Math.random() * 36,
    text: '',
  }))

  const texts: FallingItem[] = Array.from({ length: TEXT_COUNT }, (_, i) => ({
    id: ICON_COUNT + i,
    left: 5 + (i / TEXT_COUNT) * 80 + Math.random() * 10,
    delay: -(Math.random() * 8),
    duration: 5 + Math.random() * 4,
    opacity: 0.18 + Math.random() * 0.2,
    r0: -8 + Math.random() * 16,
    r1: -8 + Math.random() * 16,
    type: 'text',
    size: 0,
    text: REJECTIONS[(i + Math.floor(Math.random() * REJECTIONS.length)) % REJECTIONS.length],
  }))

  return [...icons, ...texts]
}

export default function ResumeStormOverlay() {
  const items = useMemo(generateItems, [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {items.map(item => (
        <div
          key={item.id}
          style={{
            position: 'absolute',
            left: `${item.left}vw`,
            top: 0,
            opacity: item.opacity,
            '--r0': `${item.r0}deg`,
            '--r1': `${item.r1}deg`,
            animation: `resume-fall ${item.duration}s ${item.delay}s linear infinite`,
            color: 'var(--color-primary)',
          } as React.CSSProperties}
        >
          {item.type === 'icon'
            ? <FileText width={item.size} height={item.size} />
            : (
              <span style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: 30,
                whiteSpace: 'nowrap',
                display: 'block',
              }}>
                {item.text}
              </span>
            )
          }
        </div>
      ))}
    </div>
  )
}
