import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
  type Simulation,
} from 'd3-force'
import type { Contact } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeKind = 'user' | 'contact' | 'job'

interface GraphNode extends SimulationNodeDatum {
  id: string
  kind: NodeKind
  exp: number
  color: string
  radius: number
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  id: string
  exp: number
  sourceId: string
  targetId: string
}

interface RenderNode {
  id: string
  x: number
  y: number
  kind: NodeKind
  exp: number
  color: string
  radius: number
}

interface RenderLink {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  exp: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeExp(lastInteractionAt: string | null): number {
  if (!lastInteractionAt) return 5
  const days = Math.floor((Date.now() - new Date(lastInteractionAt).getTime()) / 86_400_000)
  if (days <= 7)  return 100
  if (days <= 14) return 75
  if (days <= 30) return 50
  if (days <= 60) return 25
  return 5
}

function expToColor(exp: number): string {
  if (exp >= 75) return '#22c55e'
  if (exp >= 50) return '#84cc16'
  if (exp >= 25) return '#eab308'
  if (exp >= 10) return '#6b7280'
  return '#4b5563'
}

function pulseDuration(exp: number) {
  return 1.2 + (1 - exp / 100) * 2
}

// ── Stars ─────────────────────────────────────────────────────────────────────

interface Star {
  id: number
  baseX: number   // 0–1 normalised
  baseY: number
  r: number
  opacity: number
  depth: number   // 0–1, deeper = slower parallax + dimmer
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
      r: 0.3 + (1 - depth) * 1.4,          // far stars smaller
      opacity: 0.15 + (1 - depth) * 0.55,   // far stars dimmer
      depth,
      phase: Math.random() * Math.PI * 2,
      freq: 0.00015 + Math.random() * 0.0002,
    }
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  contacts: Contact[]
  jobsByContact: Record<string, { id: string; title: string; company: string }[]>
  expanded?: boolean
  expOverrides?: Record<string, number>
}

export default function NetworkBackdrop({ contacts, jobsByContact, expanded = false, expOverrides = {} }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [renderNodes, setRenderNodes] = useState<RenderNode[]>([])
  const [renderLinks, setRenderLinks] = useState<RenderLink[]>([])

  // Stable refs to the live sim state so the diff effect can mutate them
  const simRef    = useRef<Simulation<GraphNode, GraphLink> | null>(null)
  const nodesRef  = useRef<GraphNode[]>([])
  const linksRef  = useRef<GraphLink[]>([])
  const phasesRef = useRef<Map<string, { phase: number; freq: number }>>(new Map())

  // Stars — generated once, animated via RAF
  const starsRef     = useRef<Star[]>(generateStars(120))
  const starSvgRef   = useRef<SVGSVGElement>(null)
  const starRafRef   = useRef<number>(0)

  // Measure container via ResizeObserver
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

  // Star parallax animation — direct DOM writes for perf (no React state)
  const animateStars = useCallback(() => {
    const svg = starSvgRef.current
    if (!svg) { starRafRef.current = requestAnimationFrame(animateStars); return }
    const w = svg.clientWidth
    const h = svg.clientHeight
    const t = performance.now()
    const circles = svg.querySelectorAll<SVGCircleElement>('circle[data-star]')
    starsRef.current.forEach((star, i) => {
      const el = circles[i]
      if (!el) return
      const drift = 6 * (1 - star.depth)   // near stars drift more
      const cx = star.baseX * w + Math.sin(t * star.freq + star.phase) * drift
      const cy = star.baseY * h + Math.cos(t * star.freq + star.phase + 1.7) * drift
      el.setAttribute('cx', String(cx))
      el.setAttribute('cy', String(cy))
    })
    starRafRef.current = requestAnimationFrame(animateStars)
  }, [])

  useEffect(() => {
    starRafRef.current = requestAnimationFrame(animateStars)
    return () => cancelAnimationFrame(starRafRef.current)
  }, [animateStars])

  // Build desired graph shape from props
  const { desiredNodes, desiredLinks } = useMemo(() => {
    const desiredNodes: GraphNode[] = []
    const desiredLinks: GraphLink[] = []
    const jobSeen = new Set<string>()

    desiredNodes.push({ id: '__user__', kind: 'user', exp: 100, color: '#eab308', radius: 10 })

    for (const contact of contacts) {
      const exp = expOverrides[contact.id] ?? computeExp(contact.lastInteractionAt)
      desiredNodes.push({ id: contact.id, kind: 'contact', exp, color: expToColor(exp), radius: 5 })
      desiredLinks.push({ id: `u-${contact.id}`, sourceId: '__user__', targetId: contact.id, source: '__user__', target: contact.id, exp })

      for (const job of jobsByContact[contact.id] ?? []) {
        if (!jobSeen.has(job.id)) {
          jobSeen.add(job.id)
          desiredNodes.push({ id: job.id, kind: 'job', exp, color: '#a78bfa', radius: 4 })
        }
        desiredLinks.push({ id: `c-${contact.id}-${job.id}`, sourceId: contact.id, targetId: job.id, source: contact.id, target: job.id, exp })
      }
    }

    return { desiredNodes, desiredLinks }
  }, [contacts, jobsByContact, expOverrides])

  // Bootstrap the sim once we have dimensions
  useEffect(() => {
    if (dims.w === 0 || dims.h === 0) return
    const { w, h } = dims
    const cx = w / 2
    const cy = h / 2

    // Seed initial nodes
    nodesRef.current = desiredNodes.map((n) => ({
      ...n,
      x: n.id === '__user__' ? cx : cx + (Math.random() - 0.5) * 120,
      y: n.id === '__user__' ? cy : cy + (Math.random() - 0.5) * 120,
      fx: n.id === '__user__' ? cx : undefined,
      fy: n.id === '__user__' ? cy : undefined,
    }))
    linksRef.current = desiredLinks.map((l) => ({ ...l }))

    for (const n of nodesRef.current) {
      phasesRef.current.set(n.id, { phase: Math.random() * Math.PI * 2, freq: 0.0003 + Math.random() * 0.0002 })
    }

    const linkDistances = new Map(linksRef.current.map((l) => [l.id, 70 + Math.random() * 120]))

    const linkForce = forceLink<GraphNode, GraphLink>(linksRef.current)
      .id((d) => d.id)
      .distance((l) => linkDistances.get((l as GraphLink).id) ?? 110)
      .strength(0.15)

    const sim = forceSimulation<GraphNode>(nodesRef.current)
      .force('link', linkForce)
      .force('charge', forceManyBody().strength(-40))
      .force('center', forceCenter(cx, cy).strength(0.01))
      .force('collide', forceCollide<GraphNode>((d) => d.radius + 8))
      .alpha(0.05)
      .alphaDecay(0)
      .alphaMin(0)
      .velocityDecay(0.6)

    let t = 0
    sim.on('tick', () => {
      t++
      for (const n of nodesRef.current) {
        if (n.fx != null) continue
        const p = phasesRef.current.get(n.id)
        if (!p) continue
        n.vx = (n.vx ?? 0) + Math.sin(t * p.freq + p.phase) * 0.08
        n.vy = (n.vy ?? 0) + Math.cos(t * p.freq + p.phase + 1.3) * 0.08
      }

      setRenderNodes(nodesRef.current.map((n) => ({
        id: n.id, x: n.x ?? 0, y: n.y ?? 0,
        kind: n.kind, exp: n.exp, color: n.color, radius: n.radius,
      })))

      setRenderLinks(linksRef.current.map((l) => {
        const s = l.source as GraphNode
        const t = l.target as GraphNode
        return { id: l.id, x1: s.x ?? 0, y1: s.y ?? 0, x2: t.x ?? 0, y2: t.y ?? 0, exp: l.exp }
      }))
    })

    simRef.current = sim
    return () => { sim.stop(); simRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims])

  // Diff effect — runs when desired graph changes, patches the live sim
  useEffect(() => {
    const sim = simRef.current
    if (!sim) return

    const cx = dims.w / 2
    const cy = dims.h / 2

    const currentNodeIds = new Set(nodesRef.current.map((n) => n.id))
    const desiredNodeIds  = new Set(desiredNodes.map((n) => n.id))
    const currentLinkIds  = new Set(linksRef.current.map((l) => l.id))
    const desiredLinkIds  = new Set(desiredLinks.map((l) => l.id))

    // Remove links first (before their nodes disappear)
    const removedLinkIds = [...currentLinkIds].filter((id) => !desiredLinkIds.has(id))
    if (removedLinkIds.length) {
      linksRef.current = linksRef.current.filter((l) => !removedLinkIds.includes(l.id))
    }

    // Remove nodes
    const removedNodeIds = [...currentNodeIds].filter((id) => !desiredNodeIds.has(id))
    if (removedNodeIds.length) {
      nodesRef.current = nodesRef.current.filter((n) => !removedNodeIds.includes(n.id))
      for (const id of removedNodeIds) phasesRef.current.delete(id)
    }

    // Add new nodes — spawn near center so they drift outward naturally
    const addedNodes = desiredNodes.filter((n) => !currentNodeIds.has(n.id))
    for (const n of addedNodes) {
      nodesRef.current.push({
        ...n,
        x: cx + (Math.random() - 0.5) * 80,
        y: cy + (Math.random() - 0.5) * 80,
      })
      phasesRef.current.set(n.id, { phase: Math.random() * Math.PI * 2, freq: 0.0003 + Math.random() * 0.0002 })
    }

    // Update exp/color on existing nodes (e.g. after a ping)
    for (const desired of desiredNodes) {
      const live = nodesRef.current.find((n) => n.id === desired.id)
      if (live) { live.exp = desired.exp; live.color = desired.color }
    }

    // Add new links
    const addedLinks = desiredLinks.filter((l) => !currentLinkIds.has(l.id))
    for (const l of addedLinks) {
      linksRef.current.push({ ...l })
    }

    // Re-bind updated arrays to the sim forces
    sim.nodes(nodesRef.current)
    ;(sim.force('link') as ReturnType<typeof forceLink>)?.links(linksRef.current)
    sim.alpha(Math.max(sim.alpha(), 0.05))
  }, [desiredNodes, desiredLinks, dims])

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
      {/* Star field — direct DOM writes via RAF, no React re-renders */}
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

      {dims.w > 0 && (
        <svg width={dims.w} height={dims.h} aria-hidden="true">
          <defs>
            {['#22c55e', '#84cc16', '#eab308', '#6b7280', '#4b5563', '#a78bfa'].map((color) => (
              <filter key={color} id={`glow-${color.replace('#', '')}`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>

          {/* Edges */}
          {renderLinks.map((l) => (
            <line
              key={l.id}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={expToColor(l.exp)}
              strokeWidth={1}
              strokeOpacity={0.2}
            />
          ))}

          {/* Nodes */}
          {renderNodes.map((n) => {
            const dur = pulseDuration(n.exp)
            const isUser = n.id === '__user__'
            const filterId = `glow-${n.color.replace('#', '')}`
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                {n.exp > 5 && (
                  <circle r={n.radius + 4} fill="none" stroke={n.color} strokeWidth={isUser ? 1.5 : 1} strokeOpacity={0}>
                    <animate attributeName="r" values={`${n.radius + 2};${n.radius + 14};${n.radius + 2}`} dur={`${dur}s`} repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur={`${dur}s`} repeatCount="indefinite" />
                  </circle>
                )}
                <circle r={n.radius} fill={n.color} fillOpacity={isUser ? 0.95 : 0.65} filter={`url(#${filterId})`} />
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
