import { playCreditsChime, playLinkBlip } from '@/lib/sfx'

// ── EDITABLE DATA ─────────────────────────────────────────────────────────────

const KOFI_URL = 'https://ko-fi.com/farewellblu'

const PORTFOLIO_URL = 'https://luisbuenrostro.dev'

const LINKEDIN_URL = 'https://linkedin.com/in/luisbuenrostro'

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
            Hi! <br></br> I care about you and want to thank you for taking the time to read this.
          </p>
          <p className="body-text text-primary leading-relaxed mb-4">
            The professional world can feel cold.
            I worked food and beverage for 10 years before pursuing a software engineering
            degree at ASU. When I started applying to jobs I was completely behind my peers when
            it came to speaking "professionally", writing resumes, interviewing, and wowing recruiters.
            We are in the wild west of AI recruiting tools, people are submitting perfectly tailored resumes
            to perfectly crafted job descriptions to get rejected by AI that is seeking the perfect candidate.
            It's a little funny, we've essentially nullified AI's ability by using it everywhere.

          </p>
          <p className="body-text text-primary leading-relaxed mb-4">
            The bar is higher than it's ever been for new grads. It's difficult to measure your progress
            while searching for jobs. So I made this app in order to help me better navigate this space by gamifying it.
          </p>
          <p className="body-text text-primary leading-relaxed mb-4">
            This app is 100% free. If it helped you get employed or it brought you joy
            in any capacity: I've provided my LinkedIn, Ko-Fi, and portfolio below. I'm
            always happy to make new friends, so please reach out just to say hello!
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
