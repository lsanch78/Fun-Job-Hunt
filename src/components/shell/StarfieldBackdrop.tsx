import { useEffect, useRef, useCallback, useState } from 'react'

interface Star {
  id: number
  baseX: number
  baseY: number
  r: number
  opacity: number
  depth: number
  phase: number
  freq: number
}

function generateStars(count: number): Star[] {
  return Array.from({ length: count }, (_, i) => {
    const depth = Math.random()
    return {
      id: i,
      baseX: Math.random(),
      baseY: Math.random(),
      r: 0.3 + (1 - depth) * 1.4,
      opacity: 0.15 + (1 - depth) * 0.55,
      depth,
      phase: Math.random() * Math.PI * 2,
      freq: 0.00015 + Math.random() * 0.0002,
    }
  })
}

interface Props {
  expanded: boolean
  starCount?: number
}

export default function StarfieldBackdrop({ expanded, starCount = 120 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })

  const starsRef      = useRef<Star[]>(generateStars(starCount))
  const starSvgRef    = useRef<SVGSVGElement>(null)
  const starRafRef    = useRef<number>(0)
  const mousePosRef   = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 })
  const smoothMouseRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDims({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const animateStars = useCallback(() => {
    const svg = starSvgRef.current
    if (!svg) { starRafRef.current = requestAnimationFrame(animateStars); return }
    const w = svg.clientWidth
    const h = svg.clientHeight
    const t = performance.now()

    const ease = 0.04
    smoothMouseRef.current.x += (mousePosRef.current.x - smoothMouseRef.current.x) * ease
    smoothMouseRef.current.y += (mousePosRef.current.y - smoothMouseRef.current.y) * ease
    const mx = smoothMouseRef.current.x - 0.5
    const my = smoothMouseRef.current.y - 0.5

    const circles = svg.querySelectorAll<SVGCircleElement>('circle[data-star]')
    starsRef.current.forEach((star, i) => {
      const el = circles[i]
      if (!el) return
      const drift = 6 * (1 - star.depth)
      const parallax = 30 * (1 - star.depth)
      const cx = star.baseX * w + Math.sin(t * star.freq + star.phase) * drift + mx * parallax
      const cy = star.baseY * h + Math.cos(t * star.freq + star.phase + 1.7) * drift + my * parallax
      el.setAttribute('cx', String(cx))
      el.setAttribute('cy', String(cy))
    })
    starRafRef.current = requestAnimationFrame(animateStars)
  }, [])

  useEffect(() => {
    starRafRef.current = requestAnimationFrame(animateStars)
    return () => cancelAnimationFrame(starRafRef.current)
  }, [animateStars])

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      mousePosRef.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 0,
        opacity: expanded ? 0.85 : 0.2,
        transform: expanded ? 'scale(2)' : 'scale(1)',
        transition: 'opacity 600ms ease, transform 600ms ease',
        transformOrigin: 'center center',
      }}
    >
      <svg ref={starSvgRef} className="absolute inset-0 w-full h-full" aria-hidden="true">
        {starsRef.current.map((star) => (
          <circle
            key={star.id}
            data-star="true"
            cx={star.baseX * (dims.w || 800)}
            cy={star.baseY * (dims.h || 600)}
            r={star.r}
            fill="white"
            fillOpacity={star.opacity}
          />
        ))}
      </svg>
    </div>
  )
}
