import { useEffect, useRef, useState } from 'react'
import { getRankInfo } from '@/services/xpService'
import { XP } from '@/config/game'
import { playThud, playLinkBlip } from '@/lib/sfx'

// ── Types ──────────────────────────────────────────────────────────────────────
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

// ── Seed data ──────────────────────────────────────────────────────────────────
const SEED_JOBS: DemoJob[] = [
  { id: 1, company: 'Aperture Science',  title: 'Frontend Engineer',    status: 'INTERVIEW',    date: '2026-05-20' },
  { id: 2, company: 'Initech',           title: 'Sr. React Developer',  status: 'REJECTED',     date: '2026-05-22' },
  { id: 3, company: 'Umbrella Corp',     title: 'Full Stack Engineer',  status: 'PHONE_SCREEN', date: '2026-05-28' },
  { id: 4, company: 'Weyland-Yutani',    title: 'UI Engineer',          status: 'APPLIED',      date: '2026-05-29' },
  { id: 5, company: 'Vault-Tec',         title: 'Software Engineer',    status: 'GHOSTED',      date: '2026-05-15' },
]

const TODAY = new Date().toISOString().slice(0, 10)

// ── Keyframes ──────────────────────────────────────────────────────────────────
const DEMO_KEYFRAMES = `
@keyframes demo-xp-pop {
  0%   { opacity: 0; transform: translateX(-50%) translateY(0)   scale(0.7); }
  15%  { opacity: 1; transform: translateX(-50%) translateY(-12px) scale(1.2); }
  70%  { opacity: 1; transform: translateX(-50%) translateY(-36px) scale(1.05); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-58px) scale(0.95); }
}
@keyframes demo-scanlines-scroll {
  0%   { background-position: 0 0; }
  100% { background-position: 0 8px; }
}
@keyframes demo-scanline-sweep {
  0%   { top: -6px; opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
`

// Start mid-rank so the bar is visibly filled on arrival (rank 2, ~40% to rank 3)
const SEED_XP = 140

// ── Component ──────────────────────────────────────────────────────────────────
export default function JobLogDemo({ mouse }: { mouse: { x: number; y: number } }) {
  const [jobs, setJobs] = useState<DemoJob[]>(SEED_JOBS)
  const [xp, setXp] = useState(SEED_XP)
  const [company, setCompany] = useState('')
  const [title, setTitle] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [popups, setPopups] = useState<{ id: number; x: number; y: number; mega: boolean }[]>()
  const inputRef = useRef<HTMLInputElement>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const popupCounter = useRef(0)
  const nextId = useRef(SEED_JOBS.length + 1)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 1200)
    return () => clearTimeout(t)
  }, [])

  const { rank, title: rankTitle, progress } = getRankInfo(xp)
  const barPct = Math.round(progress * 100)

  const avatarChars = ['◉', '◈', '◆', '▣', '★', '✦', '⬡', '⬟', '◉', '✸', '✺']
  const avatarChar = avatarChars[(rank - 1) % avatarChars.length]

  function spawnPopup(mega: boolean) {
    const btn = addBtnRef.current
    const rect = btn?.getBoundingClientRect()
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const y = rect ? rect.top : window.innerHeight / 2
    const id = ++popupCounter.current
    setPopups(prev => [...(prev ?? []), { id, x, y, mega }])
    setTimeout(() => setPopups(prev => (prev ?? []).filter(p => p.id !== id)), 1200)
  }

  function handleAdd() {
    if (!company.trim() || !title.trim()) return
    const newCount = jobs.length + 1
    const mega = newCount % 10 === 0
    const delta = mega ? XP.ADD_JOB * 2 : XP.ADD_JOB
    setJobs(prev => [
      { id: nextId.current++, company: company.trim(), title: title.trim(), status: 'APPLIED', date: TODAY },
      ...prev,
    ])
    setXp(x => x + delta)
    playThud(mega)
    spawnPopup(mega)
    setCompany('')
    setTitle('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd()
  }

  // Tilt — subtle, not nauseating
  const TILT_MAX = 3
  const rotX = -mouse.y * TILT_MAX
  const rotY = mouse.x * TILT_MAX

  return (
    <>
      <style>{DEMO_KEYFRAMES}</style>

      {/* XP popups — rendered in fixed position above the panel */}
      {(popups ?? []).map(p => (
        <div
          key={p.id}
          className="pointer-events-none fixed z-[9999] select-none font-pixel"
          style={{
            left: p.x,
            top: p.y,
            fontSize: p.mega ? '0.875rem' : '0.75rem',
            color: p.mega ? 'var(--color-secondary)' : 'var(--color-primary)',
            animation: 'demo-xp-pop 1.0s ease-out forwards',
          }}
        >
          {p.mega ? `✦ +${XP.ADD_JOB * 2} XP ✦` : `+${XP.ADD_JOB} XP`}
        </div>
      ))}

      {/* CRT panel — tilts with mouse */}
      <div
        style={{
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transition: 'transform 0.12s linear',
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          position: 'relative',
        }}
      >
        {/* depth shadow */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            transform: 'translateZ(-20px)',
            background: 'var(--color-border)',
            opacity: 0.5,
          }}
        />

        {/* panel face */}
        <div
          className="border border-border bg-bg font-pixel text-primary overflow-hidden"
          style={{ transform: 'translateZ(0)', position: 'relative' }}
          onClick={() => inputRef.current?.focus()}
        >
          {/* loading sweep */}
          {!revealed && (
            <div
              className="absolute left-0 w-full h-1.5 bg-secondary z-10"
              style={{ opacity: 0.7, animation: 'demo-scanline-sweep 0.6s linear infinite', top: '-6px' }}
            />
          )}

          {/* ── XP tracker bar ─────────────────────────────────────── */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-surface">
            <div className="text-2xl leading-none text-secondary select-none">{avatarChar}</div>
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

          {/* ── Add row ────────────────────────────────────────────── */}
          <div className="px-4 py-3 border-b border-border flex gap-2 items-center bg-surface">
            <input
              ref={inputRef}
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Company…"
              maxLength={30}
              className="bg-transparent border-b border-border focus:border-primary outline-none text-xs text-primary placeholder-muted font-pixel py-0.5 w-36 min-w-0"
            />
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Role…"
              maxLength={30}
              className="bg-transparent border-b border-border focus:border-primary outline-none text-xs text-primary placeholder-muted font-pixel py-0.5 flex-1 min-w-0"
            />
            <button
              ref={addBtnRef}
              onClick={() => { playLinkBlip(); handleAdd() }}
              disabled={!company.trim() || !title.trim()}
              className="text-[10px] px-3 py-1 border border-primary text-primary hover:bg-primary hover:text-bg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              + LOG
            </button>
          </div>

          {/* ── Job rows ───────────────────────────────────────────── */}
          <div className="overflow-y-auto" style={{ maxHeight: '260px' }}>
            <table className="border-collapse text-xs w-full">
              <thead>
                <tr className="border-b border-border text-muted text-left select-none">
                  <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal">COMPANY</th>
                  <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal">ROLE</th>
                  <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal">STATUS</th>
                  <th className="px-3 py-1.5 text-[9px] tracking-widest font-normal">DATE</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-border hover:bg-surface transition-none">
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

          {/* ── Footer hint ────────────────────────────────────────── */}
          <div className="px-4 py-2 border-t border-border flex items-center justify-between">
            <span className="text-[9px] text-muted tracking-widest">
              {jobs.length} APPLICATION{jobs.length !== 1 ? 'S' : ''} TRACKED
            </span>
            <span className="text-[9px] text-muted tracking-widest">
              PRESS ENTER TO LOG
            </span>
          </div>

          {/* CRT scanline overlay */}
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
