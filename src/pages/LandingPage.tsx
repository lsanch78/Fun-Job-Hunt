import { useEffect, useState } from 'react'
import { PRO_FEATURE_TABLE } from '@/config/pricing'
import { useNavigate } from 'react-router-dom'
import { playLinkBlip } from '@/lib/sfx'
import { useAuth } from '@/contexts/AuthContext'
import JobLogDemo from '@/components/landing/JobLogDemo'
import NetworkDemo from '@/components/landing/NetworkDemo'

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



export default function LandingPage() {
  const { session } = useAuth()
  const [booted, setBooted] = useState(false)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const loggedIn = !!session
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
          {/* title */}
          <h1
            className="text-3xl sm:text-5xl text-primary mb-2 leading-none"
            style={{ animation: 'glitch-x 6s ease-in-out infinite' }}
          >
            FUN JOB HUNT
          </h1>

          <p className="text-[10px] text-secondary tracking-widest mb-8">
            — The F Totally Stands For Fun —
          </p>

          {/* tagline */}
          <p className="body-text text-primary max-w-md mx-auto mb-10 text-base leading-relaxed">
            If the job hunt is a number's game, then we'll help you play it like one. Track your apps, level up your network, and turn the dread into a quest worth embarking on.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => { playLinkBlip(); navigate(loggedIn ? '/jobs' : '/auth') }}
              className="px-8 py-3 border border-primary text-primary text-xs hover:bg-primary hover:text-bg transition-colors"
            >
              {loggedIn ? 'CONTINUE YOUR HUNT' : 'START YOUR HUNT'}
            </button>
            <a
              href="#features"
              onClick={playLinkBlip}
              className="px-8 py-3 border border-border text-secondary text-xs hover:border-secondary transition-colors"
            >
              SEE FEATURES ↓
            </a>
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
      <section id="features" className="px-6 py-20 max-w-3xl mx-auto" style={{ perspective: '400px' }}>
        <SectionHeader title="LETS MAKE IT FUN" sub="DO YOU DREAD THE JOB HUNT?" />
        <JobLogDemo mouse={mouse} index={0} />
        <ul className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 max-w-2xl mx-auto">
          {[
            'Modularize your workflow, track jobs the way that works best for you',
            'Gain EXP and unlock rewards along the way',
            'Quickly sanitize hastily copy/pasted job descriptions',
            'Link contacts to jobs to build your network',
          ].map(b => (
            <li key={b} className="body-text text-muted text-sm leading-relaxed flex gap-2">
              <span className="text-secondary shrink-0">▸</span>
              {b}
            </li>
          ))}
        </ul>
      </section>

      {/* ── Network Demo ─────────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-3xl mx-auto" style={{ perspective: '400px' }}>
        <SectionHeader title="THEN LET'S MEET IT IN SPACE" sub="IS NETWORKING ALIEN TO YOU?" />
        <NetworkDemo mouse={mouse} index={1} />
        <ul className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 max-w-2xl mx-auto">
          {[
            'Gamify and level up your real professional relationships',
            'Gain EXP on relationships and watch your network grow',
            'Quickly draft personalized outreach messages using your resume, job descriptions, and their notes',
            'Pressure free engagement — there\'s a difficulty setting for every social battery',
          ].map(b => (
            <li key={b} className="body-text text-muted text-sm leading-relaxed flex gap-2">
              <span className="text-secondary shrink-0">▸</span>
              {b}
            </li>
          ))}
        </ul>
      </section>

      {/* ── AI Stance ───────────────────────────────────────────────────── */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <div className="border border-border px-8 py-7 max-w-2xl mx-auto">
          <p className="text-[8px] text-secondary tracking-widest mb-3">[ NOTE ]</p>
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <p className="text-xs text-primary">OUR STANCE ON AI</p>
            <p className="text-[8px] text-muted tracking-widest shrink-0">BYOK SUPPORTED</p>
          </div>
          <div className="h-px bg-border mb-5" />
          <p className="body-text text-muted text-sm leading-relaxed mb-4">
            We understand that not everyone likes AI. At Fun Job Hunt, however, we can't understate its efficiency for simple word-matching tasks that have engulfed job hunting.
          </p>
          <p className="body-text text-muted text-sm leading-relaxed">
            <span className="text-primary">This is why we only use AI to curate your voice per job application. This is how your resume will stand out, we do NOT generate resumes, we curate them. We order the content to highlight your most relevant experiences using keywords based on your CV, a mock ATS score, and "The 6 second scan". We believe it is important to maintain your authentic voice and let AI assist you through the "dumb" tasks.</span>
          </p>
        </div>
      </section>

      {/* ── Free vs Pro ─────────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-3xl mx-auto">
        <SectionHeader title="FREE VS PRO" sub="THE FULL LOADOUT" />
        <div className="max-w-2xl mx-auto border border-border">
          {/* Header row */}
          <div className="grid grid-cols-3 border-b border-border">
            <div className="px-5 py-3 font-pixel text-[8px] text-muted tracking-widest">FEATURE</div>
            <div className="px-5 py-3 font-pixel text-[8px] text-muted tracking-widest border-l border-border text-center">FREE</div>
            <div className="px-5 py-3 font-pixel text-[8px] text-primary tracking-widest border-l border-border text-center">PRO</div>
          </div>
          {PRO_FEATURE_TABLE.map(({ feature, free, pro }, i) => (
            <div key={feature} className={`grid grid-cols-3 ${i % 2 === 1 ? 'bg-surface' : ''} ${i > 0 ? 'border-t border-border' : ''}`}>
              <div className="px-5 py-3 font-pixel text-[8px] text-muted tracking-widest">{feature.toUpperCase()}</div>
              <div className="px-5 py-3 body-text text-[11px] text-muted border-l border-border text-center">{free}</div>
              <div className="px-5 py-3 body-text text-[11px] text-primary border-l border-border text-center">{pro}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── User Data ────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-3xl mx-auto">
        <div className="border border-border px-8 py-7 max-w-2xl mx-auto">
          <p className="text-[8px] text-secondary tracking-widest mb-3">[ USER DATA ]</p>
          <p className="text-xs text-primary mb-4">YOUR HUNT IS PRIVATE</p>
          <div className="h-px bg-border mb-5" />
          <p className="body-text text-muted text-sm leading-relaxed mb-4">
            Your resumes, applications, and contacts are stored in our database so you can access them from anywhere. We never look at them, never sell them, and never train models on them. You own your data — export or delete it anytime.
          </p>
          <p className="body-text text-muted text-sm leading-relaxed mb-6">
            Fun Job Hunt is fully <span className="text-primary">open source</span>. You can read every line of code, self-host it, or fork it.
          </p>
          <a
            href="https://github.com/lsanch78/effjobhunt"
            target="_blank"
            rel="noopener noreferrer"
            onClick={playLinkBlip}
            className="inline-block px-6 py-2 border border-border text-secondary text-[10px] tracking-widest hover:border-secondary hover:text-primary transition-colors"
          >
            VIEW SOURCE CODE ON GITHUB
          </a>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="px-6 py-24 text-center border-t border-border">
        <p className="text-[9px] text-secondary tracking-widest mb-4">GAME START</p>
        <h2 className="text-2xl text-primary mb-6">READY TO HUNT?</h2>
        <button
          onClick={() => { playLinkBlip(); navigate(loggedIn ? '/jobs' : '/auth') }}
          className="px-10 py-4 border border-primary text-primary text-xs hover:bg-primary hover:text-bg transition-colors"
        >
          {loggedIn ? 'CONTINUE YOUR HUNT' : 'CREATE FREE ACCOUNT'}
        </button>
      </section>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ title, sub, bullets }: { title: string; sub: string; bullets?: string[] }) {
  return (
    <div className="mb-10 text-center">
      <h2 className="text-xs text-secondary tracking-widest mb-1">{sub}</h2>
      <p className="text-lg text-primary">{title}</p>
      <div className="mt-3 h-px bg-border max-w-xs mx-auto" />
      {bullets && bullets.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2 text-left max-w-sm mx-auto">
          {bullets.map(b => (
            <li key={b} className="body-text text-muted text-sm leading-relaxed flex gap-2">
              <span className="text-secondary shrink-0">▸</span>
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}




