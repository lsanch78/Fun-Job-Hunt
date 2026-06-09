import { useRef, useEffect } from 'react'

const CHARS = '01█▓▒░10110100'
const COL_W = 9
const ROW_H = 14
const CHURN = 0.08      // fraction of char-cells re-randomized per frame
const WORD_SLOTS = 12   // max simultaneous visible words
const WORD_TTL  = 60    // frames a word stays before being replaced

interface Cell { char: string; alpha: number }
interface WordSlot { word: string; col: number; row: number; ttl: number }

export default function GlitchOverlay({ width, height, words }: { width: number; height: number; words: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wordsRef  = useRef(words)
  useEffect(() => { wordsRef.current = words }, [words])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.font = '11px monospace'

    const cols = Math.ceil(width  / COL_W)
    const rows = Math.ceil(height / ROW_H)

    const grid: Cell[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        char:  CHARS[Math.floor(Math.random() * CHARS.length)],
        alpha: Math.random() * 0.55 + 0.1,
      }))
    )

    function randomCell(): Cell {
      return {
        char:  CHARS[Math.floor(Math.random() * CHARS.length)],
        alpha: Math.random() * 0.55 + 0.1,
      }
    }

    function randomSlot(pool: string[]): WordSlot {
      const word = pool[Math.floor(Math.random() * pool.length)]
      const maxCol = Math.max(0, cols - Math.ceil(word.length * 1.3))
      return {
        word,
        col: Math.floor(Math.random() * maxCol),
        row: Math.floor(Math.random() * rows),
        ttl: Math.floor(WORD_TTL * (0.6 + Math.random() * 0.8)),
      }
    }

    // Pre-fill word slots if words are available
    const slots: WordSlot[] = []

    let frame: number

    function draw() {
      const pool = wordsRef.current

      // Seed slots on first frame words become available
      if (pool.length > 0 && slots.length < WORD_SLOTS) {
        while (slots.length < WORD_SLOTS) slots.push(randomSlot(pool))
      }

      // Age slots — replace expired ones
      for (let i = 0; i < slots.length; i++) {
        slots[i].ttl--
        if (slots[i].ttl <= 0) slots[i] = randomSlot(pool)
      }

      // Churn char grid
      const total = rows * cols
      const toFlip = Math.round(total * CHURN)
      for (let i = 0; i < toFlip; i++) {
        const r = Math.floor(Math.random() * rows)
        const c = Math.floor(Math.random() * cols)
        grid[r][c] = randomCell()
      }

      ctx.clearRect(0, 0, width, height)
      ctx.font = '11px monospace'

      // Draw all chars in a single color
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[r][c]
          ctx.fillStyle = `rgba(255,255,255,${cell.alpha.toFixed(2)})`
          ctx.fillText(cell.char, c * COL_W, r * ROW_H + 11)
        }
      }

      // Draw word slots on top
      for (const slot of slots) {
        const age     = WORD_TTL - slot.ttl
        const fadeIn  = Math.min(1, age / 8)
        const fadeOut = Math.min(1, slot.ttl / 8)
        const alpha   = 0.75 * fadeIn * fadeOut
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`
        ctx.fillText(slot.word, slot.col * COL_W, slot.row * ROW_H + 11)
      }

      // Tint all chars with the AiButton ready palette via destination-in
      const colorGrad = ctx.createLinearGradient(0, 0, 0, height)
      colorGrad.addColorStop(0,    '#200a40')
      colorGrad.addColorStop(0.4,  '#5b0ea6')
      colorGrad.addColorStop(0.7,  '#300a60')
      colorGrad.addColorStop(1,    '#200a40')
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = colorGrad
      ctx.fillRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'source-over'

      // Scan bar
      const barY = (Date.now() % 1800) / 1800 * height
      const grad = ctx.createLinearGradient(0, barY - 30, 0, barY + 30)
      grad.addColorStop(0,   'rgba(57,255,20,0)')
      grad.addColorStop(0.5, 'rgba(57,255,20,0.18)')
      grad.addColorStop(1,   'rgba(57,255,20,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, barY - 30, width, 60)

      frame = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(frame)
  }, [width, height])

  return <canvas ref={canvasRef} width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
