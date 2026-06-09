import { T, ensureCrtStyles } from '@/lib/crtTheme'
import GlitchOverlay from '@/components/cv/GlitchOverlay'

ensureCrtStyles()

const RESUME_WORDS = [
  'led', 'built', 'reduced', 'improved', 'shipped', 'architected', 'migrated',
  'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS', 'Docker', 'CI/CD',
  'latency', 'throughput', 'uptime', 'coverage', 'scalability', 'refactored',
  'cross-functional', 'stakeholders', 'mentored', 'ownership', 'metrics',
]

const JD_WORDS = [
  'React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'Docker', 'GraphQL',
  'REST', 'CI/CD', 'Agile', 'collaborate', 'ownership', 'fast-paced', 'startup',
  'full-stack', 'scalable', 'microservices', 'distributed', 'SaaS', 'B2B',
  'growth', 'impact', 'ship', 'senior', 'engineer', 'experience', 'driven',
]

export default function DevGlitch() {
  return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 48, padding: 40 }}>
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: T.greenDim, letterSpacing: '0.2em' }}>
        DEV — AI LOADING SPINNER PREVIEW
      </div>

      {/* Resume Curation */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: T.greenDim, letterSpacing: '0.15em', marginBottom: 4 }}>
          RESUME CURATION
        </div>
        <div className="crt-glitch-wrap" style={{ position: 'relative', width: 408, maxWidth: '90vw', aspectRatio: '816/1056', border: `1px solid ${T.border}`, overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, background: '#fff' }} />
          <GlitchOverlay width={816} height={1056} words={RESUME_WORDS} />
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.2em', color: T.green }}>
          TAILORING RESUME<span className="crt-blink">…</span>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.12em', color: T.greenDim }}>
          HAIKU IS MATCHING YOUR BULLETS TO THE JOB DESCRIPTION
        </div>
      </div>

      {/* Cover Letter */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: T.greenDim, letterSpacing: '0.15em', marginBottom: 4 }}>
          COVER LETTER
        </div>
        <div className="crt-glitch-wrap" style={{ position: 'relative', width: 408, maxWidth: '90vw', aspectRatio: '816/1056', border: `1px solid ${T.border}`, overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, background: '#fff' }} />
          <GlitchOverlay width={816} height={1056} words={JD_WORDS} />
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.2em', color: T.green }}>
          WRITING COVER LETTER<span className="crt-blink">…</span>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.12em', color: T.greenDim }}>
          HAIKU IS CRAFTING YOUR LETTER FROM THE JOB DESCRIPTION
        </div>
      </div>
    </div>
  )
}
