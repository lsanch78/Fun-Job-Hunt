import { useState, useEffect } from 'react'

const QUOTES = [
  "YOUR NETWORK IS YOUR NET WORTH.",
  "EVERY GREAT OPPORTUNITY STARTS WITH A CONVERSATION.",
  "THE PEOPLE YOU KNOW OPEN DOORS YOU DIDN'T KNOW EXISTED.",
  "WEAK TIES CARRY STRONG SIGNALS.",
  "ONE INTRODUCTION CAN CHANGE EVERYTHING.",
  "BUILD THE NETWORK BEFORE YOU NEED IT.",
]

const CYCLE = 8000   // ms per quote
const FADE  = 800    // ms fade in / out

export default function UniverseQuote({ visible }: { visible: boolean }) {
  const [index, setIndex]   = useState(0)
  const [opacity, setOpacity] = useState(0)

  useEffect(() => {
    if (!visible) { setOpacity(0); return }

    let current = 0
    let mounted = true

    function showQuote() {
      if (!mounted) return
      setIndex(current)
      setOpacity(1)

      // fade out just before the cycle ends
      const fadeOut = setTimeout(() => {
        if (mounted) setOpacity(0)
      }, CYCLE - FADE)

      // advance to next quote
      const next = setTimeout(() => {
        if (!mounted) return
        current = (current + 1) % QUOTES.length
        showQuote()
      }, CYCLE)

      return () => { clearTimeout(fadeOut); clearTimeout(next) }
    }

    const cleanup = showQuote()
    return () => { mounted = false; cleanup?.() }
  }, [visible])

  return (
    <div
      className="absolute inset-x-0 top-0 flex items-start justify-center pt-8 pointer-events-none"
      style={{ zIndex: 1 }}
    >
      <p
        className="font-pixel text-[10px] tracking-widest text-primary text-center max-w-xs px-4"
        style={{ opacity, transition: `opacity ${FADE}ms ease` }}
      >
        "{QUOTES[index]}"
      </p>
    </div>
  )
}
