// ── CreditsPage ───────────────────────────────────────────────────────────────
// The "why I built this" page. Edit the sections below with your own story,
// photos, and links. Search for TODO comments to find all editable spots.

// ── HOW TO ADD PHOTOS ────────────────────────────────────────────────────────
// 1. Drop your image files into public/credits/ (create the folder if needed)
//    e.g.  public/credits/me.jpg
//          public/credits/setup.png
// 2. In the PHOTOS array below, add an entry like:
//    { src: '/credits/me.jpg', caption: 'Me, circa burnout era' }
// 3. Images render in a scrollable pixel-bordered gallery.
// ─────────────────────────────────────────────────────────────────────────────

// ── EDITABLE DATA ─────────────────────────────────────────────────────────────

const KOFI_URL = 'https://ko-fi.com/farewellblu'

const PORTFOLIO_URL = 'https://luisbuenrostro.dev'

const LINKEDIN_URL = 'https://linkedin.com/in/luisbuenrostro'

const PHOTOS: { src: string; caption?: string }[] = [
  { src: '/me1.jpg' },
  { src: '/me2.jpg' },
  { src: '/me3.jpg' },
]

// ─────────────────────────────────────────────────────────────────────────────

function playCreditsChime() {
  try {
    const ctx = new AudioContext()
    // Gentle ascending arpeggio — "level complete" vibe
    const notes = [
      { freq: 523.25, t: 0,    dur: 0.12, vol: 0.028 }, // C5
      { freq: 659.25, t: 0.12, dur: 0.12, vol: 0.026 }, // E5
      { freq: 783.99, t: 0.24, dur: 0.12, vol: 0.024 }, // G5
      { freq: 1046.5, t: 0.36, dur: 0.25, vol: 0.020 }, // C6
    ]
    notes.forEach(({ freq, t, dur, vol }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + t)
      gain.gain.setValueAtTime(0, ctx.currentTime + t)
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + t + 0.008)
      gain.gain.setValueAtTime(vol, ctx.currentTime + t + dur - 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + dur + 0.01)
    })
  } catch { /* AudioContext blocked */ }
}

function playLinkBlip() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(1046.5, ctx.currentTime + 0.05)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 0.006)
    gain.gain.setValueAtTime(0.025, ctx.currentTime + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.13)
  } catch { /* AudioContext blocked */ }
}

import { useEffect, useRef, useState } from 'react'

export default function CreditsPage() {
  const [booted, setBooted] = useState(false)
  const chimePlayed = useRef(false)

  useEffect(() => {
    // Stagger the boot animation
    const t = setTimeout(() => setBooted(true), 100)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (booted && !chimePlayed.current) {
      chimePlayed.current = true
      playCreditsChime()
    }
  }, [booted])

  return (
    <div className="min-h-screen bg-bg font-pixel text-primary overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* ── Header ── */}
        <div className={`transition-opacity duration-500 ${booted ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-muted text-[10px] tracking-widest mb-2">// CREDITS.EXE</p>
          <h1 className="text-lg text-primary mb-1">ABOUT THIS GAME</h1>
          <p className="text-secondary text-xs tracking-widest mb-10">
            — a dev's true story —
          </p>
        </div>

        {/* ── Photos gallery ── */}
        {PHOTOS.length > 0 && (
          <Section title="ME" delay="delay-100" booted={booted}>
            <div className="grid grid-cols-3 gap-4">
              {PHOTOS.map(({ src, caption }, i) => (
                <figure key={i} className="flex flex-col gap-2">
                  <div className="border border-border overflow-hidden">
                    <img
                      src={src}
                      alt={caption ?? `photo ${i + 1}`}
                      className="w-full h-40 object-cover object-top"
                    />
                  </div>
                  {caption && (
                    <figcaption className="body-text text-muted text-center leading-snug">
                      {caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </Section>
        )}

        {/* ── Story ── */}
        <Section title="FROM THE DEV" delay="delay-200" booted={booted}>
          <p className="body-text text-muted leading-relaxed mb-4">
            Hi everyone! Jobless and employed alike. Thank you for taking the time to use my app.
          </p>
          <p className="body-text text-muted leading-relaxed mb-4">
            As a new grad dev, the professional world was feeling increasingly cold.
            I've worked food and beverage for 12 years before making the switch to SWE
            and pursuing a degree at ASU. I've grinded LeetCode, been to multiple final rounds,
            and in a world that expects perfection, I'll be the first to admit I am anything
            close to that.
          </p>
          <p className="body-text text-muted leading-relaxed mb-4">
            But I was making progress, and progress in the job application world is hard to
            measure and difficult to hold yourself accountable to. So I made this app in order
            to help me better navigate this world and gamify it.
          </p>
          <p className="body-text text-muted leading-relaxed mb-4">
            This app is 100% free. If it helped you get employed, or you found any sort of joy
            from it and you want to help me out, I've provided my LinkedIn, Ko-Fi, and my
            portfolio below. I'm always happy to make new friends, so please reach out
            for anything!
          </p>
          <p className="body-text text-primary leading-relaxed">
            Thank you,<br />Luis
          </p>
        </Section>

        {/* ── Links ── */}
        <Section title="LINKS" delay="delay-300" booted={booted}>
          <div className="grid grid-cols-3 gap-4">

            {/* LinkedIn */}
            <LinkCard
              href={LINKEDIN_URL}
              label="LINKEDIN"
              icon="💼"
            />

            {/* Ko-fi */}
            <LinkCard
              href={KOFI_URL}
              label="BUY ME A COFFEE"
              icon="☕"
            />

            {/* Portfolio */}
            <LinkCard
              href={PORTFOLIO_URL}
              label="MY PORTFOLIO"
              icon="🗂"
            />

          </div>
        </Section>

        {/* ── Footer ── */}
        <div className={`mt-16 pt-8 border-t border-border transition-opacity duration-700 ${booted ? 'opacity-100' : 'opacity-0'}`} />

      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({
  title,
  delay,
  booted,
  children,
}: {
  title: string
  delay: string
  booted: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`mb-10 transition-opacity duration-500 ${delay} ${booted ? 'opacity-100' : 'opacity-0'}`}
    >
      <h2 className="text-[10px] text-secondary tracking-widest mb-4 border-b border-border pb-2">
        {title}
      </h2>
      {children}
    </section>
  )
}

function LinkCard({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={playLinkBlip}
      className="flex flex-col items-center justify-center gap-3 px-4 py-6 border border-border hover:border-secondary group transition-none"
    >
      <span className="text-3xl leading-none">{icon}</span>
      <span className="text-xs text-primary group-hover:text-secondary text-center">{label}</span>
    </a>
  )
}
