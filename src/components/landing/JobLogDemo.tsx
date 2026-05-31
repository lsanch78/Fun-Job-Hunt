import { useEffect, useRef, useState } from 'react'
import { getRankInfo } from '@/services/xpService'
import { XP } from '@/config/game'
import { playThud, playLevelUp } from '@/lib/sfx'

type DemoStatus = 'APPLIED' | 'PHONE_SCREEN' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'GHOSTED'

interface DemoJob {
  id: number
  company: string
  title: string
  status: DemoStatus
  date: string
}

const STATUS_COLORS: Record<DemoStatus, string> = {
  APPLIED:      'text-dim',
  PHONE_SCREEN: 'text-secondary',
  INTERVIEW:    'text-secondary',
  OFFER:        'text-secondary',
  REJECTED:     'text-warning',
  GHOSTED:      'text-warning',
}

const STATUS_LABELS: Record<DemoStatus, string> = {
  APPLIED:      'APPLIED',
  PHONE_SCREEN: 'PHONE',
  INTERVIEW:    'INTERVIEW',
  OFFER:        'OFFER',
  REJECTED:     'REJECTED',
  GHOSTED:      'GHOSTED',
}

const SEED_JOBS: DemoJob[] = [
  { id: 1, company: 'Aperture Science',  title: 'Frontend Engineer',    status: 'INTERVIEW',    date: '2026-05-20' },
  { id: 2, company: 'Initech',           title: 'Sr. React Developer',  status: 'REJECTED',     date: '2026-05-22' },
  { id: 3, company: 'Umbrella Corp',     title: 'Full Stack Engineer',  status: 'PHONE_SCREEN', date: '2026-05-28' },
  { id: 4, company: 'Weyland-Yutani',    title: 'UI Engineer',          status: 'APPLIED',      date: '2026-05-29' },
  { id: 5, company: 'Vault-Tec',         title: 'Software Engineer',    status: 'GHOSTED',      date: '2026-05-15' },
  { id: 6, company: 'Omni Consumer',     title: 'React Developer',      status: 'REJECTED',     date: '2026-05-14' },
  { id: 7, company: 'Primatech',         title: 'Frontend Developer',   status: 'APPLIED',      date: '2026-05-13' },
  { id: 8, company: 'Genco Pura',        title: 'UI Engineer',          status: 'GHOSTED',      date: '2026-05-12' },
  { id: 9,  company: 'Soylent Corp',      title: 'Systems Engineer',     status: 'PHONE_SCREEN', date: '2026-05-11' },
  { id: 10, company: 'Rekall Inc',        title: 'Full Stack Developer', status: 'INTERVIEW',    date: '2026-05-10' },
  { id: 11, company: 'Massive Dynamic',   title: 'Software Engineer',    status: 'APPLIED',      date: '2026-05-09' },
]

const CLICK_JOBS: Array<{ company: string; title: string; status: DemoStatus }> = [
  { company: 'Cyberdyne Systems', title: 'Systems Engineer',     status: 'APPLIED'      },
  { company: 'Soylent Corp',      title: 'Product Engineer',     status: 'PHONE_SCREEN' },
  { company: 'Oscorp',            title: 'React Developer',      status: 'INTERVIEW'    },
  { company: 'Rekall Inc',        title: 'Frontend Architect',   status: 'OFFER'        },
  { company: 'Tyrell Corp',       title: 'Software Engineer',    status: 'REJECTED'     },
  { company: 'Massive Dynamic',   title: 'Full Stack Developer', status: 'GHOSTED'      },
]

const TODAY = new Date().toISOString().slice(0, 10)
const TYPE_SPEED = 16

const DEMO_KEYFRAMES = `
@keyframes demo-xp-pop {
  0%   { opacity: 0; transform: translateX(-50%) translateY(0)   scale(0.7); }
  15%  { opacity: 1; transform: translateX(-50%) translateY(-12px) scale(1.2); }
  70%  { opacity: 1; transform: translateX(-50%) translateY(-48px) scale(1.05); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-72px) scale(0.95); }
}
@keyframes demo-scanlines-scroll {
  0%   { background-position: 0 0; }
  100% { background-position: 0 8px; }
}
@keyframes demo-scanline-sweep {
  0%   { top: -6px; opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
@keyframes demo-row-in {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes demo-cursor-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
`

const SEED_XP = 140

export default function JobLogDemo({ mouse, index = 0, expanded = false }: { mouse: { x: number; y: number }; index?: number; expanded?: boolean }) {
  const [jobs, setJobs] = useState<DemoJob[]>(SEED_JOBS)
  const [xp, setXp] = useState(SEED_XP)
  const [revealed, setRevealed] = useState(false)
  const [newRowId, setNewRowId] = useState<number | null>(null)
  const [xpPop, setXpPop] = useState<{ key: number; amount: number; mega: boolean } | null>(null)

  const [typedCompany, setTypedCompany] = useState('')
  const [typedTitle, setTypedTitle] = useState('')
  const [isAnimating, setIsAnimating] = useState(false)

  const nextId = useRef(SEED_JOBS.length + 1)
  const clickIndexRef = useRef(0)
  const jobsLengthRef = useRef(SEED_JOBS.length) // starts at 9, so first click hits 10 → mega
  const rafIdRef = useRef<number | null>(null)
  const xpPopKeyRef = useRef(0)
  const lastClickRef = useRef(0)
  const prevRankRef = useRef<number | null>(null)

  useEffect(() => {
    typeIn(CLICK_JOBS[0])
    return () => { if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 1200)
    return () => clearTimeout(t)
  }, [])

  function typeIn(job: { company: string; title: string }) {
    // cancel any in-flight animation
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)

    setIsAnimating(true)
    setTypedCompany('')
    setTypedTitle('')

    const company = job.company
    const title = job.title
    const totalChars = company.length + title.length
    let elapsed = 0
    let lastTs: number | null = null

    function tick(ts: number) {
      if (lastTs !== null) elapsed += ts - lastTs
      lastTs = ts

      const charsRevealed = Math.min(Math.floor(elapsed / TYPE_SPEED), totalChars)

      if (charsRevealed <= company.length) {
        setTypedCompany(company.slice(0, charsRevealed))
        setTypedTitle('')
      } else {
        setTypedCompany(company)
        setTypedTitle(title.slice(0, charsRevealed - company.length))
      }

      if (charsRevealed < totalChars) {
        rafIdRef.current = requestAnimationFrame(tick)
      } else {
        rafIdRef.current = null
        setIsAnimating(false)
      }
    }

    rafIdRef.current = requestAnimationFrame(tick)
  }

  const { rank, title: rankTitle, progress } = getRankInfo(xp)
  const barPct = Math.round(progress * 100)

  useEffect(() => {
    if (prevRankRef.current === null) { prevRankRef.current = rank; return }
    if (rank > prevRankRef.current) playLevelUp()
    prevRankRef.current = rank
  }, [rank])

  const avatarChars = ['◉', '◈', '◆', '▣', '★', '✦', '⬡', '⬟', '◉', '✸', '✺']
  const avatarChar = avatarChars[(rank - 1) % avatarChars.length]

  function handleClick() {
    const now = Date.now()
    if (now - lastClickRef.current < 500) return
    lastClickRef.current = now

    const job = CLICK_JOBS[clickIndexRef.current % CLICK_JOBS.length]
    clickIndexRef.current++

    const id = nextId.current++
    jobsLengthRef.current += 1
    const mega = jobsLengthRef.current % 10 === 0
    const delta = mega ? XP.ADD_JOB * 2 : XP.ADD_JOB

    setJobs(prev => [
      { id, company: job.company, title: job.title, status: job.status, date: TODAY },
      ...prev,
    ])
    setXp(x => x + delta)
    playThud(mega)

    const popKey = ++xpPopKeyRef.current
    setXpPop({ key: popKey, amount: delta, mega })
    setTimeout(() => setXpPop(p => p?.key === popKey ? null : p), 1100)

    setNewRowId(id)
    setTimeout(() => setNewRowId(null), 400)

    const next = CLICK_JOBS[clickIndexRef.current % CLICK_JOBS.length]
    typeIn(next)
  }

  const TILT_MAX = 3
  const depth = 1 + index * 0.4
  const rotX = -mouse.y * TILT_MAX * depth
  const rotY = mouse.x * TILT_MAX * depth

  const cursorStyle = isAnimating
    ? { animation: 'demo-cursor-blink 0.7s step-start infinite' }
    : { opacity: 0 }

  return (
    <>
      <style>{DEMO_KEYFRAMES}</style>

      <div
        style={{
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transition: 'transform 0.12s linear',
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            transform: 'translateZ(-60px)',
            background: 'var(--color-border)',
            opacity: 0.8,
          }}
        />

        <div
          className="border border-border bg-bg font-pixel text-primary overflow-hidden select-none"
          style={{
            transform: 'translateZ(0)',
            position: 'relative',
            height: expanded ? '840px' : '420px',
            transition: 'height 0.4s ease',
            cursor: 'pointer',
          }}
          onClick={handleClick}
        >
          {!revealed && (
            <div
              className="absolute left-0 w-full h-1.5 bg-secondary z-10"
              style={{ opacity: 0.7, animation: 'demo-scanline-sweep 0.6s linear infinite', top: '-6px' }}
            />
          )}

          {/* XP tracker bar */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-surface">
            <div className="text-2xl leading-none text-secondary">{avatarChar}</div>
            <div className="flex flex-col gap-1 flex-1">
              <div className="flex items-baseline justify-between">
                <span className="text-secondary text-[11px] tracking-widest leading-none">LVL {rank}</span>
                <span className="text-muted text-[9px] leading-none">{xp} XP</span>
              </div>
              <div className="text-primary text-[9px] leading-tight">{rankTitle}</div>
              <div className="w-full h-1.5 bg-border">
                <div
                  className="h-full bg-secondary transition-all duration-500"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Add row — typing animation drives the values. overflow-visible so XP can float up */}
          <div
            className="px-4 py-3 border-b border-border flex gap-2 items-center bg-surface flex-nowrap min-w-0"
            style={{ position: 'relative', overflow: 'visible', zIndex: 10 }}
          >
            {/* XP pop — floats up from the add row, above the form */}
            {xpPop && (
              <span
                key={xpPop.key}
                className="pointer-events-none absolute font-pixel"
                style={{
                  left: '50%',
                  top: 0,
                  fontSize: xpPop.mega ? '0.875rem' : '0.75rem',
                  color: xpPop.mega ? 'var(--color-secondary)' : 'var(--color-primary)',
                  animation: 'demo-xp-pop 1.1s ease-out forwards',
                  whiteSpace: 'nowrap',
                  zIndex: 20,
                }}
              >
                {xpPop.mega ? `✦ +${xpPop.amount} XP ✦` : `+${xpPop.amount} XP`}
              </span>
            )}

            <div className="border-b border-border text-xs text-primary font-pixel py-0.5 w-36 min-w-0 shrink-0 flex items-center overflow-hidden whitespace-nowrap">
              <span className="truncate">{typedCompany || <span className="text-muted">Company…</span>}</span>
              {isAnimating && typedTitle === '' && (
                <span style={cursorStyle} className="text-primary ml-px shrink-0">▌</span>
              )}
            </div>
            <div className="border-b border-border text-xs text-primary font-pixel py-0.5 flex-1 min-w-0 flex items-center overflow-hidden whitespace-nowrap">
              <span className="truncate">{typedTitle || (typedCompany ? <span className="text-muted">Role…</span> : '')}</span>
              {isAnimating && typedTitle !== '' && (
                <span style={cursorStyle} className="text-primary ml-px shrink-0">▌</span>
              )}
            </div>
            <button
              onClick={e => { e.stopPropagation(); handleClick() }}
              className="text-[10px] px-3 py-1 border border-primary text-primary hover:bg-primary hover:text-bg transition-colors"
              style={{ cursor: 'pointer' }}
            >
              + LOG
            </button>
          </div>

          {/* Job rows — no scroll */}
          <div className="overflow-hidden" style={{ maxHeight: '260px' }}>
            <table className="border-collapse text-xs w-full">
              <thead>
                <tr className="border-b border-border text-muted text-left">
                  <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal">COMPANY</th>
                  <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal">ROLE</th>
                  <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal">STATUS</th>
                  <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal">DATE</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-border"
                    style={job.id === newRowId ? { animation: 'demo-row-in 0.25s ease-out' } : undefined}
                  >
                    <td className="px-3 py-2 text-xs text-primary truncate max-w-[140px]">{job.company}</td>
                    <td className="px-3 py-2 text-xs text-muted truncate max-w-[160px]">{job.title}</td>
                    <td className={`px-3 py-2 text-[10px] tracking-widest ${STATUS_COLORS[job.status]}`}>
                      {STATUS_LABELS[job.status]}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-muted">{job.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border flex items-center justify-between">
            <span className="text-[9px] text-muted tracking-widest">
              {jobs.length} APPLICATION{jobs.length !== 1 ? 'S' : ''} TRACKED
            </span>
            <span className="text-[9px] text-muted tracking-widest">CLICK TO LOG</span>
          </div>

          {revealed && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.13) 3px, rgba(0,0,0,0.13) 4px)',
                animation: 'demo-scanlines-scroll 0.3s linear infinite',
                mixBlendMode: 'multiply',
              }}
            />
          )}
        </div>
      </div>
    </>
  )
}

