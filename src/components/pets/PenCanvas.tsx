import { useRef, useEffect, useCallback } from 'react'
import {
  getFrames,
  getPalette,
  drawSprite,
  drawHat,
  type PetSpecies,
} from './PetSprite'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PenPet {
  id: string
  species: PetSpecies
  name: string
  colorId?: string
  hatId?: string
  happiness?: number  // 0–100; defaults to 100
}

interface LivePet {
  pet: PenPet
  x: number          // top-left canvas x
  y: number          // top-left canvas y
  vx: number         // pixels/frame (0 when idle)
  vy: number         // pixels/frame (0 when idle)
  frame: number      // current animation frame index
  frameTimer: number
  walkFor: number    // canvas frames left walking before next idle check
  idleFor: number    // canvas frames left standing still (0 = walking)
}

interface Props {
  pets: PenPet[]
  /** Called when user clicks a pet (owner view only). Pass undefined for read-only share view. */
  onPetClick?: (pet: PenPet) => void
  /**
   * Fixed canvas height in px. Pass undefined to fill the parent container's height.
   * Defaults to 240.
   */
  height?: number | undefined
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRITE_COLS = 6        // sprite grid width
const SPRITE_ROWS = 5        // sprite grid height
const SCALE = 6              // display scale → 36×30 per pet
const DISPLAY_W = SPRITE_COLS * SCALE  // 36px
const DISPLAY_H = SPRITE_ROWS * SCALE  // 30px

const FPS_TARGET = 60
const FRAME_MS = 1000 / FPS_TARGET
const ANIM_TICKS = 18        // canvas frames between sprite frame advances (~3.3 sprite fps)

const SPEED = 0.5            // pixels per canvas frame
const BORDER = 2             // pen border thickness (px)

// Idle behaviour: pets walk for WALK_MIN–WALK_MAX frames, then stand for IDLE_MIN–IDLE_MAX frames
const WALK_MIN = 120   // ~2s at 60fps
const WALK_MAX = 420   // ~7s
const IDLE_MIN = 60    // ~1s
const IDLE_MAX = 240   // ~4s

function randBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PenCanvas({ pets, onPetClick, height = 240 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const livePetsRef = useRef<LivePet[]>([])
  const rafRef = useRef<number>(0)
  const lastRef = useRef<number>(0)
  const accRef = useRef<number>(0)

  // Initialise live pet state when pet list changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = canvas.width
    const H = canvas.height

    livePetsRef.current = pets.map((pet, i) => {
      // Spread pets evenly along x, random y
      const spread = W / (pets.length + 1)
      const x = spread * (i + 1) - DISPLAY_W / 2
      const y = BORDER + Math.random() * (H - BORDER * 2 - DISPLAY_H)
      // Random direction, bias horizontal so they mostly walk side-to-side
      const angle = (Math.random() - 0.5) * Math.PI * 0.5  // ±45° from horizontal
      // Stagger so pets don't all start/stop simultaneously
      const walkFor = randBetween(WALK_MIN, WALK_MAX) + i * 40
      return {
        pet,
        x,
        y,
        vx: Math.cos(angle) * SPEED * (Math.random() > 0.5 ? 1 : -1),
        vy: Math.sin(angle) * SPEED,
        frame: i % 4,
        frameTimer: Math.floor(Math.random() * ANIM_TICKS),
        walkFor,
        idleFor: 0,
      }
    })
  }, [pets])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    // Clear
    ctx.clearRect(0, 0, W, H)

    // Pen background — use CSS var via a fillStyle trick
    const style = getComputedStyle(canvas)
    const bgColor = style.getPropertyValue('--pen-bg').trim() || '#0a0a0a'
    const borderColor = style.getPropertyValue('--pen-border').trim() || '#444444'

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, W, H)

    // Pen border (pixel-style — no rounding)
    ctx.fillStyle = borderColor
    ctx.fillRect(0, 0, W, BORDER)           // top
    ctx.fillRect(0, H - BORDER, W, BORDER)  // bottom
    ctx.fillRect(0, 0, BORDER, H)           // left
    ctx.fillRect(W - BORDER, 0, BORDER, H)  // right

    // Draw pets
    const minX = BORDER
    const maxX = W - BORDER - DISPLAY_W
    const minY = BORDER
    const maxY = H - BORDER - DISPLAY_H

    // Read primary color from CSS var for name tags
    const primaryColor = style.getPropertyValue('--color-primary').trim() || '#39ff14'
    const dimColor = style.getPropertyValue('--color-muted').trim() || '#1a7a08'

    for (const lp of livePetsRef.current) {
      const frames = getFrames(lp.pet.species)
      const palette = getPalette(lp.pet.species, lp.pet.colorId ?? 'default')
      const frame = frames[lp.frame % frames.length]!
      const flipX = lp.vx < 0

      // Sadness indicator (happiness < 50): dim the sprite area
      const happiness = lp.pet.happiness ?? 100
      if (happiness < 50) {
        ctx.fillStyle = dimColor
        ctx.font = '8px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(':(', lp.x + DISPLAY_W / 2, lp.y - 2)
      }

      const isIdle = lp.idleFor > 0
      // When idle, lock to frame 0 (standing pose)
      const displayFrame = isIdle ? frames[0]! : frame

      drawSprite(ctx, displayFrame, palette, lp.x, lp.y, SCALE, flipX)

      if (lp.pet.hatId) {
        drawHat(ctx, lp.pet.hatId, palette, lp.x, lp.y, SCALE, flipX)
      }

      // Name tag — single pixel-font line below sprite
      ctx.font = '7px monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = primaryColor
      ctx.fillText(lp.pet.name.slice(0, 7), lp.x + DISPLAY_W / 2, lp.y + DISPLAY_H + 9)

      if (isIdle) {
        // Standing still — count down idle timer, then pick a new walk direction
        lp.idleFor--
        if (lp.idleFor === 0) {
          const angle = (Math.random() - 0.5) * Math.PI * 0.5
          lp.vx = Math.cos(angle) * SPEED * (Math.random() > 0.5 ? 1 : -1)
          lp.vy = Math.sin(angle) * SPEED
          lp.walkFor = randBetween(WALK_MIN, WALK_MAX)
        }
      } else {
        // Walking — move, bounce, advance walk timer
        lp.x += lp.vx
        lp.y += lp.vy

        // Bounce off walls
        if (lp.x < minX) { lp.x = minX; lp.vx = Math.abs(lp.vx) }
        if (lp.x > maxX) { lp.x = maxX; lp.vx = -Math.abs(lp.vx) }
        if (lp.y < minY) { lp.y = minY; lp.vy = Math.abs(lp.vy) }
        if (lp.y > maxY) { lp.y = maxY; lp.vy = -Math.abs(lp.vy) }

        // Advance animation frame
        lp.frameTimer++
        if (lp.frameTimer >= ANIM_TICKS) {
          lp.frameTimer = 0
          lp.frame = (lp.frame + 1) % frames.length
        }

        // Walk timer — when it expires, sit still for a while
        lp.walkFor--
        if (lp.walkFor === 0) {
          lp.idleFor = randBetween(IDLE_MIN, IDLE_MAX)
          lp.frame = 0
          lp.frameTimer = 0
        }
      }
    }
  }, [])

  // rAF loop
  useEffect(() => {
    function loop(ts: number) {
      const delta = ts - lastRef.current
      lastRef.current = ts
      accRef.current += delta

      if (accRef.current >= FRAME_MS) {
        accRef.current -= FRAME_MS
        draw()
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [draw])

  // Resize canvas + clamp all pets to new bounds
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const sync = () => {
      const parent = canvas.parentElement
      if (!parent) return

      // Always sync width; sync height only when prop is undefined (fill mode)
      const newW = parent.clientWidth
      const newH = height === undefined ? parent.clientHeight : height

      canvas.width  = newW
      canvas.height = newH

      // Clamp every pet so none escape the new pen bounds
      const maxX = newW  - BORDER - DISPLAY_W
      const maxY = newH  - BORDER - DISPLAY_H
      for (const lp of livePetsRef.current) {
        lp.x = Math.max(BORDER, Math.min(lp.x, maxX))
        lp.y = Math.max(BORDER, Math.min(lp.y, maxY))
      }
    }

    const observer = new ResizeObserver(sync)
    const parent = canvas.parentElement
    if (parent) {
      sync()
      observer.observe(parent)
    }
    return () => observer.disconnect()
  }, [height])

  // Click → hit-test pets
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPetClick) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    // Scale click coords to canvas coords
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mx = cx * scaleX
    const my = cy * scaleY

    for (const lp of livePetsRef.current) {
      if (mx >= lp.x && mx <= lp.x + DISPLAY_W && my >= lp.y && my <= lp.y + DISPLAY_H) {
        onPetClick(lp.pet)
        return
      }
    }
  }, [onPetClick])

  return (
    // Wrapper drives the layout size. Canvas pixel dims are always set by ResizeObserver.
    <div className="w-full" style={{ height: height ?? '100%' }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: onPetClick ? 'pointer' : 'default',
          imageRendering: 'pixelated',
          '--pen-bg': 'var(--color-surface, #0d0d0d)',
          '--pen-border': 'var(--color-border, #333333)',
        } as React.CSSProperties}
      />
    </div>
  )
}
