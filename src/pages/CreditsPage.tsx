import { playCreditsChime, playLinkBlip } from '@/lib/sfx'

// ── EDITABLE DATA ─────────────────────────────────────────────────────────────

const KOFI_URL = 'https://ko-fi.com/farewellblu'

const PORTFOLIO_URL = 'https://luisbuenrostro.dev'

const LINKEDIN_URL = 'https://linkedin.com/in/luisbuenrostro'

const MUSIC_CHANNELS: { name: string; href: string }[] = [
  { name: 'Zeryu Soul', href: 'https://www.youtube.com/@ZeryuSoul' },
  { name: 'Fancy Fox', href: 'https://www.youtube.com/@fancyfoxgaming9952' },
  { name: 'Visual Escape', href: 'https://www.youtube.com/@VisualEscape' },
  { name: 'jungle wizard', href: 'https://youtube.com/@junglewizards?si=XIOZk5ZmsGUyVAoq' },
  { name: 'Enzo OSRS', href: 'https://www.youtube.com/@EnzoOSRS' },
]

const PHOTOS: { src: string; caption?: string }[] = [
  { src: '/me1.webp' },
  { src: '/me2.webp' },
  { src: '/me3.webp' },
]

// ─────────────────────────────────────────────────────────────────────────────

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
    <div className="h-full overflow-y-auto bg-bg font-pixel text-primary">
      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* ── Header ── */}
        <div className={`transition-opacity duration-500 ${booted ? 'opacity-100' : 'opacity-0'}`}>
          <h1 className="text-lg text-primary mb-1">CREDITS</h1>
          <p className="text-secondary text-xs tracking-widest mb-4">
            — Fun Job Hunt —
          </p>
          <div className="flex items-center gap-2 mb-10">
            <span
              className="inline-block w-2 h-2 rounded-full bg-secondary"
              style={{ animation: 'blink 1.2s step-start infinite' }}
            />
            <span className="text-xs text-primary tracking-widest">
              STATUS: <span className="text-secondary">OPEN TO OPPORTUNITIES</span>
            </span>
          </div>
        </div>

        {/* ── Photos gallery ── */}
        {PHOTOS.length > 0 && (
          <Section title="ME IN ACTION" delay="delay-100" booted={booted}>
            <div className="grid grid-cols-3 gap-4">
              {PHOTOS.map(({ src, caption }, i) => (
                <figure key={i} className="flex flex-col gap-2">
                  <div className="border border-border overflow-hidden">
                    <img
                      src={src}
                      alt={caption ?? `photo ${i + 1}`}
                      width={448}
                      height={320}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-40 object-cover object-top"
                    />
                  </div>
                  {caption && (
                    <figcaption className="body-text text-primary text-center leading-snug">
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
          <p className="body-text text-primary leading-relaxed mb-4">
            Hello my name is Luis (I also go by Lui). I made this app as a fun side project to help me track my applications. It's my first real foray into publishing a webapp and I hope that you've enjoyed using it as much as I've enjoyed building it. I want to give a special thanks to the YouTube channels who put together such great music for me to work to. Please Remember to subscribe to them below!

          </p>
          <p className="body-text text-primary leading-relaxed mb-4">
            In the wild west of AI, people are submitting perfectly tailored resumes
            to perfect job descriptions to get rejected by the very same AI seeking a perfect candidate.
            It's a little funny, I think some of us have completely lost the plot. I believe one of the greatest things
            AI will teach us is to appreciate our imperfections.

          </p>
          <p className="body-text text-primary leading-relaxed mb-4">
            So here it is: an imperfect app and hopefully a helping hand. I'll continue working on it so long as I have the time and energy. If you want to support me, I've provided my LinkedIn, Ko-Fi, and portfolio below. I'm
            always happy to make new friends, so please reach out just to say hello!
          </p>
          <p className="body-text text-primary leading-relaxed">
            Thank you,<br />Luis
          </p>
        </Section>

        {/* ── Music Credits ── */}
        <Section title="MUSIC" delay="delay-300" booted={booted}>
          <p className="body-text text-primary leading-relaxed mb-4">
            Big thanks to these YouTube channels for the tunes. Please subscribe!
          </p>
          <div className="grid grid-cols-3 gap-4">
            {MUSIC_CHANNELS.map(({ name, href }) => (
              <LinkCard key={name} href={href} label={name} />
            ))}
          </div>
        </Section>

        {/* ── Links ── */}
        <Section title="LINKS" delay="delay-400" booted={booted}>
          <div className="grid grid-cols-3 gap-4">

            {/* LinkedIn */}
            <LinkCard
              href={LINKEDIN_URL}
              label="LINKEDIN"
            />

            {/* Ko-fi */}
            <LinkCard
              href={KOFI_URL}
              label="BUY ME A COFFEE"
            />

            {/* Portfolio */}
            <LinkCard
              href={PORTFOLIO_URL}
              label="MY PORTFOLIO"
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
}: {
  href: string
  label: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={playLinkBlip}
      className="flex flex-col items-center justify-center gap-3 px-4 py-6 border border-border hover:border-secondary group transition-none"
    >
      <span className="text-xs text-primary group-hover:text-secondary text-center">{label}</span>
    </a>
  )
}
