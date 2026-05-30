import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { playLinkBlip } from '@/lib/sfx'
import JobLogDemo from '@/components/landing/JobLogDemo'
import NetworkDemo from '@/components/landing/NetworkDemo'
import QuickCastDemo from '@/components/landing/QuickCastDemo'
import StoryDemo from '@/components/landing/StoryDemo'

// ── Scanline animation keyframes injected once ─────────────────────────────
const KEYFRAMES = `
  @keyframes scanline-sweep {
    0%   { top: -6px; opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes scanlines-scroll {
    0%   { background-position: 0 0; }
    100% { background-position: 0 8px; }
  }
  @keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
  @keyframes glitch-x {
    0%, 90%, 100% { transform: translateX(0); }
    92%           { transform: translateX(-3px); }
    94%           { transform: translateX(3px); }
    96%           { transform: translateX(-2px); }
  }
  @keyframes float-y {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-6px); }
  }
`


// ── Features ───────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: '[ LOG ]',
    title: 'JOB LOG',
    body: 'Track every application. Status, company, role, notes — all in one retro HUD.',
  },
  {
    icon: '[ NET ]',
    title: 'NETWORK',
    body: 'Map your contacts and connections. Know who to follow up with and when.',
  },
  {
    icon: '[ BAR ]',
    title: 'WORKDAY BAR',
    body: 'A persistent timer that keeps you focused across the whole hunt.',
  },
  {
    icon: '[ STR ]',
    title: 'STORY MODE',
    body: 'Watch your job hunt unfold as a narrative timeline. Every move matters.',
  },
  {
    icon: '[ STA ]',
    title: 'STATS',
    body: 'Charts, streaks, and breakdowns so you know exactly where you stand.',
  },
  {
    icon: '[ PAD ]',
    title: 'SCRATCH PAD',
    body: 'A persistent notepad always one keystroke away. Think fast, write faster.',
  },
]

export default function LandingPage() {
  const [booted, setBooted] = useState(false)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 80)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      })
    }
    window.addEventListener('mousemove', handle)
    return () => window.removeEventListener('mousemove', handle)
  }, [])

  return (
    <div className="min-h-screen bg-bg font-pixel text-primary overflow-x-hidden">
      <style>{KEYFRAMES}</style>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center overflow-hidden">
        {/* grid background */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(var(--color-border-rgb,46,46,46),0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(46,46,46,0.18) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div
          className="relative z-10"
          style={{
            opacity: booted ? 1 : 0,
            transition: 'opacity 0.6s',
          }}
        >
          {/* eyebrow */}
          <p className="text-[9px] text-secondary tracking-widest mb-6 uppercase">
            ▶ SILICON DREAMS PRESENTS
          </p>

          {/* title */}
          <h1
            className="text-3xl sm:text-5xl text-primary mb-2 leading-none"
            style={{ animation: 'glitch-x 6s ease-in-out infinite' }}
          >
            FUN JOB HUNT
          </h1>

          <p className="text-[10px] text-secondary tracking-widest mb-8">
            — THE JOB TRACKER FOR THE PIXEL GENERATION —
          </p>

          {/* tagline */}
          <p className="body-text text-primary max-w-md mx-auto mb-10 text-base leading-relaxed">
            In a world of spreadsheets and corporate ATS black holes, take back control.
            <br />
            Track applications, map your network, and stay sane — retro style.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => { playLinkBlip(); navigate('/auth') }}
              className="px-8 py-3 border border-primary text-primary text-xs hover:bg-primary hover:text-bg transition-colors"
            >
              START YOUR HUNT
            </button>
            <a
              href="#features"
              onClick={playLinkBlip}
              className="px-8 py-3 border border-border text-secondary text-xs hover:border-secondary transition-colors"
            >
              SEE FEATURES ↓
            </a>
          </div>

          {/* blinking cursor */}
          <div className="mt-16 flex items-center justify-center gap-2">
            <span className="text-[9px] text-muted tracking-widest">PRESS START</span>
            <span
              className="inline-block w-2 h-3 bg-primary"
              style={{ animation: 'cursor-blink 1s step-end infinite' }}
            />
          </div>
        </div>

        {/* scroll hint chevron */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-secondary text-[10px]"
          style={{ animation: 'float-y 2s ease-in-out infinite', opacity: booted ? 0.7 : 0, transition: 'opacity 1s 1s' }}
        >
          ▼
        </div>
      </section>

      {/* ── Live Demo ───────────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-3xl mx-auto" style={{ perspective: '900px' }}>
        <SectionHeader title="TRY IT NOW" sub="NO SIGN-UP REQUIRED" />
        <JobLogDemo mouse={mouse} />
        <p className="text-center text-[9px] text-muted mt-6 tracking-widest">
          ↑ TYPE A COMPANY + ROLE AND HIT ENTER — EARN XP AS YOU GO
        </p>
      </section>

      {/* ── Network Demo ─────────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-3xl mx-auto" style={{ perspective: '900px' }}>
        <SectionHeader title="NETWORK" sub="MAP YOUR CONNECTIONS" />
        <NetworkDemo mouse={mouse} />
        <p className="text-center text-[9px] text-muted mt-6 tracking-widest">
          ↑ ADD CONTACTS AND PING THEM — WATCH THE GRAPH GROW
        </p>
      </section>

      {/* ── Story Demo ───────────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-3xl mx-auto" style={{ perspective: '900px' }}>
        <SectionHeader title="STORY MODE" sub="AN ORIGINAL NARRATIVE" />
        <StoryDemo mouse={mouse} />
        <p className="text-center text-[9px] text-muted mt-6 tracking-widest">
          ↑ CLICK TO START · ORIGINAL MUSIC COMPOSED FOR THE HUNT
        </p>
      </section>

      {/* ── QuickCast Demo ───────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-3xl mx-auto" style={{ perspective: '900px' }}>
        <SectionHeader title="QUICK CAST" sub="AI-POWERED RESUME TOOLS" />
        <QuickCastDemo mouse={mouse} />
        <p className="text-center text-[9px] text-muted mt-6 tracking-widest">
          ↑ CLICK A RESUME SLOT · RIGHT-CLICK AI TO GENERATE COVER LETTERS INSTANTLY
        </p>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="px-6 py-20 max-w-5xl mx-auto">
        <SectionHeader title="FEATURES" sub="YOUR FULL LOADOUT" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon, title, body }) => (
            <FeatureCard key={title} icon={icon} title={title} body={body} />
          ))}
        </div>
      </section>

      {/* ── Social proof / about ─────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-3xl mx-auto text-center">
        <SectionHeader title="FROM THE DEV" sub="WHY THIS EXISTS" />
        <p className="body-text text-primary leading-relaxed mb-4 text-base">
          The job market is wild. AI is rejecting AI-written resumes. The loop is broken.
          I built this so tracking the chaos feels less like a spreadsheet and more like a game.
        </p>
        <p className="body-text text-primary leading-relaxed text-base">
          Free to use. No nonsense. Made by a dev who's been in the hunt too.
        </p>
        <div className="mt-8 flex justify-center gap-6">
          <StatBadge label="APPS TRACKED" value="∞" />
          <StatBadge label="THEMES" value="5+" />
          <StatBadge label="COST" value="$0" />
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="px-6 py-24 text-center border-t border-border">
        <p className="text-[9px] text-secondary tracking-widest mb-4">GAME START</p>
        <h2 className="text-2xl text-primary mb-6">READY TO HUNT?</h2>
        <button
          onClick={() => { playLinkBlip(); navigate('/auth') }}
          className="px-10 py-4 border border-primary text-primary text-xs hover:bg-primary hover:text-bg transition-colors"
        >
          CREATE FREE ACCOUNT
        </button>
        <p className="text-[9px] text-muted mt-6 tracking-widest">
          NO ADS · NO TRACKING · OPEN SOURCE VIBES
        </p>
      </section>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-10 text-center">
      <h2 className="text-xs text-secondary tracking-widest mb-1">{sub}</h2>
      <p className="text-lg text-primary">{title}</p>
      <div className="mt-3 h-px bg-border max-w-xs mx-auto" />
    </div>
  )
}

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="border border-border p-5 hover:border-secondary transition-colors group">
      <p className="text-[9px] text-secondary mb-3 tracking-widest group-hover:text-primary transition-colors">
        {icon}
      </p>
      <p className="text-xs text-primary mb-2">{title}</p>
      <p className="body-text text-muted text-sm leading-relaxed">{body}</p>
    </div>
  )
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-lg text-primary">{value}</span>
      <span className="text-[8px] text-muted tracking-widest">{label}</span>
    </div>
  )
}

