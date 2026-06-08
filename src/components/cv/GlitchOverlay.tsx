import { useRef, useEffect } from 'react'

export default function GlitchOverlay({ width, height, words }: { width: number; height: number; words: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wordsRef = useRef(words)
  useEffect(() => { wordsRef.current = words }, [words])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const CHARS = '01█▓▒░10110100'
    let frame: number
    function draw() {
      ctx.clearRect(0, 0, width, height)
      ctx.font = '11px monospace'
      for (let y = 0; y < height; y += 14) {
        for (let x = 0; x < width; x += 9) {
          const alpha = Math.random() * 0.55 + 0.1
          ctx.fillStyle = `rgba(57,255,20,${alpha.toFixed(2)})`
          const pool = wordsRef.current
          if (pool.length > 0 && Math.random() < 0.08) {
            const word = pool[Math.floor(Math.random() * pool.length)]
            ctx.fillText(word, x, y + 11)
            x += ctx.measureText(word).width
          } else {
            ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], x, y + 11)
          }
        }
      }
      const barY = (Date.now() % 1800) / 1800 * height
      const grad = ctx.createLinearGradient(0, barY - 30, 0, barY + 30)
      grad.addColorStop(0, 'rgba(57,255,20,0)')
      grad.addColorStop(0.5, 'rgba(57,255,20,0.18)')
      grad.addColorStop(1, 'rgba(57,255,20,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, barY - 30, width, 60)
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [width, height])
  return <canvas ref={canvasRef} width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
