import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { playLinkBlip } from '@/lib/sfx'
import { supabase } from '@/lib/supabase'
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



export default function LandingPage() {
  const [booted, setBooted] = useState(false)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [loggedIn, setLoggedIn] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session))
  }, [])

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

      {/* ── Story Demo ───────────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-3xl mx-auto" style={{ perspective: '400px' }}>
        <SectionHeader title="JOB HUNT?" sub="Hey! You spilled an entire STORY MODE all over my" />
        <StoryDemo mouse={mouse} index={2} />
        <ul className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 max-w-2xl mx-auto">
          {[
            'Fulfill your destiny with all original music and dialogue based on your hunt',
            'Gain powerful allies on the quest to finding your next job',
            'View your job hunt stats in an entirely new way',
            'Your choices shape the story — every application, ping, and offer writes the next chapter',
          ].map(b => (
            <li key={b} className="body-text text-muted text-sm leading-relaxed flex gap-2">
              <span className="text-secondary shrink-0">▸</span>
              {b}
            </li>
          ))}
        </ul>
      </section>

      {/* ── QuickCast Demo ───────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-3xl mx-auto" style={{ perspective: '400px' }}>
        <SectionHeader title="SPELLS FOR ANY JOB" sub="POWERFUL MAGICS AWAIT YOU HUNTER" />
        <QuickCastDemo mouse={mouse} index={3} />
        <ul className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 max-w-2xl mx-auto">
          {[
            'Add your most-used links for instant copy/paste into any job application',
            'Save up to 3 resumes for quick reference as you apply',
            'Copy a job description and right-click your AI assistant for cover letters, why you want to work there, and more',
            'Every AI response is personalized against your resumes, the job description, and any tweaks you want to make — context caching keeps it fast',
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
            <span className="text-primary">We created AI features in good-faith, but ultimately believe our users should be able to make their own decisions about how they want to use it. This is why we have given users a NO AI mode that hides all AI features. We understand.{
              
            }</span>
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
          {([
            { feature: 'Job Tracking',       free: '∞ applications',          pro: '∞ applications' },
            { feature: 'Network',            free: 'Up to 30 contacts',       pro: '∞ contacts' },
            { feature: 'Story Mode',         free: '✓',                       pro: '✓' },
            { feature: 'Time Tracking',      free: '✓',                       pro: '✓' },
            { feature: 'Stats',              free: '✓',                       pro: '✓' },
            { feature: 'Journal',            free: '✓',                       pro: '✓' },
            { feature: 'Themes',             free: 'Classic Terminal',         pro: 'All 5 themes + custom editor' },
            { feature: 'Resume Slots',       free: '1 slot',                  pro: '3 slots' },
            { feature: 'AI Assistant',       free: 'Limited',                 pro: 'Unlimited' },
            { feature: 'BYOK',               free: '✓',                       pro: '✓' },
            { feature: 'No AI mode',         free: '✓',                       pro: '✓' },
          ] as const).map(({ feature, free, pro }, i) => (
            <div key={feature} className={`grid grid-cols-3 ${i % 2 === 1 ? 'bg-surface' : ''} ${i > 0 ? 'border-t border-border' : ''}`}>
              <div className="px-5 py-3 font-pixel text-[8px] text-muted tracking-widest">{feature.toUpperCase()}</div>
              <div className="px-5 py-3 body-text text-[11px] text-muted border-l border-border text-center">{free}</div>
              <div className="px-5 py-3 body-text text-[11px] text-primary border-l border-border text-center">{pro}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Social proof / about ─────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-3xl mx-auto text-center">
        <SectionHeader title="FROM THE DEV" sub="WHY A PRO TIER?" />
        <p className="body-text text-primary leading-relaxed mb-4 text-base">
          Real talk: I don't want you here. I wan't you out there, 
          working the job that you deserve. I built this for myself and I hate dark UX patterns, 
          I hate ads, and I especially hate subscription fees. ESPECIALLY when you're 
          job hunting. Unfortunately my AI and hosting costs are not free, so I provided
          the "pro" option for heavy AI users with 2 extra resume slots.
        </p>
        <p className="body-text text-primary leading-relaxed text-base">
          The app is intended to be free to use with generous limits, 
          and I will never put up a paywall for core features. If you 
          want to support the project, the best way is to share it 
          with a friend who needs it. If you want to support it financially, 
          you can subscribe to pro or send me a tip on Ko-Fi. And hey, if it
          helps you land a job, just share your win with me on LinkedIn or Email. 
          That truly means the world to me.
          <br></br>
          Thank you,
          <br></br>
          Luis
        </p>
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




