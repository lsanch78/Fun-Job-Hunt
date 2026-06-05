import { useState } from 'react'
import MainInfoCard, { type MainInfo } from './MainInfoCard'
import ExperienceCard, { type Experience } from './ExperienceCard'
import EducationCard, { type Education } from './EducationCard'
import ProjectCard, { type Project } from './ProjectCard'
import SkillsBucketCard, { type SkillsBucket } from './SkillsBucketCard'
import { T } from '@/lib/crtTheme'

// ── 3-D title keyframes ───────────────────────────────────────────────────────
const TITLE_STYLE_ID = 'codex-title-styles'
if (typeof document !== 'undefined' && !document.getElementById(TITLE_STYLE_ID)) {
  const el = document.createElement('style')
  el.id = TITLE_STYLE_ID
  el.textContent = `
@keyframes codex-rock {
  0%   { transform: perspective(600px) rotateY(-8deg) rotateX(3deg); }
  50%  { transform: perspective(600px) rotateY( 8deg) rotateX(-2deg); }
  100% { transform: perspective(600px) rotateY(-8deg) rotateX(3deg); }
}
.codex-title-3d {
  animation: codex-rock 6s ease-in-out infinite;
  transform-style: preserve-3d;
  display: inline-block;
}
`
  document.head.appendChild(el)
}

// ── id helper ─────────────────────────────────────────────────────────────────
let _seq = 0
function nextId(prefix: string) { return `${prefix}-${++_seq}` }

const NEW_ITEMS = ['Experience', 'Education', 'Project', 'Skills', 'Other'] as const

interface Props {
  visible: boolean
  userName?: string | null
}

export default function CodexCanvas({ visible, userName }: Props) {
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const [collapsed, setCollapsed]     = useState<Record<string, boolean>>({ main: false })

  const [mainInfo, setMainInfo]       = useState<MainInfo>({
    fullName: '', jobTitle: '', email: '', phone: '',
    location: '', website: '', linkedin: '', github: '',
  })
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [educations, setEducations]   = useState<Education[]>([])
  const [projects, setProjects]       = useState<Project[]>([])
  const [skills, setSkills]           = useState<SkillsBucket | null>(null)

  function toggleCollapse(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function spawnExperience() {
    const id = nextId('exp')
    setExperiences((prev) => [...prev, { id, company: '', title: '', location: '', startDate: '', endDate: '', bullets: [''] }])
    setCollapsed((prev) => ({ ...prev, [id]: false }))
    setNewMenuOpen(false)
  }

  function spawnEducation() {
    const id = nextId('edu')
    setEducations((prev) => [...prev, { id, institution: '', degree: '', field: '', location: '', startDate: '', endDate: '', gpa: '', notes: '' }])
    setCollapsed((prev) => ({ ...prev, [id]: false }))
    setNewMenuOpen(false)
  }

  function spawnProject() {
    const id = nextId('proj')
    setProjects((prev) => [...prev, { id, name: '', role: '', url: '', startDate: '', endDate: '', technologies: '', bullets: [''] }])
    setCollapsed((prev) => ({ ...prev, [id]: false }))
    setNewMenuOpen(false)
  }

  function spawnSkills() {
    if (skills) return
    setSkills({ evergreen: [], modular: [] })
    setCollapsed((prev) => ({ ...prev, skills: false }))
    setNewMenuOpen(false)
  }

  return (
    <div
      className="absolute inset-0 overflow-y-auto"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity 400ms ease' }}
    >
      {/* Centered column */}
      <div className="mx-auto flex flex-col gap-2 px-4 pb-8" style={{ width: 'min(72vw, 860px)', paddingTop: 100 }}>

        {/* 3-D rotating title */}
        {userName && (
          <div className="flex justify-center pointer-events-none mb-6">
            <span
              className="codex-title-3d select-none"
              style={{
                fontFamily: 'monospace',
                fontSize: 'clamp(1.8rem, 4vw, 3.2rem)',
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: T.green,
                textTransform: 'uppercase',
                textShadow: [
                  '1px 1px 0 #1a7a06', '2px 2px 0 #166604', '3px 3px 0 #124f03',
                  '4px 4px 0 #0d3a02', '5px 5px 0 #092601',
                  '6px 6px 12px rgba(0,0,0,0.8)',
                  '0 0 40px rgba(57,255,20,0.4)', '0 0 80px rgba(57,255,20,0.15)',
                ].join(', '),
              }}
            >
              {userName}
            </span>
          </div>
        )}

        {/* Main info */}
        <MainInfoCard
          data={mainInfo}
          collapsed={collapsed.main ?? false}
          onChange={setMainInfo}
          onToggleCollapse={() => toggleCollapse('main')}
        />

        {/* Education cards */}
        {educations.map((edu) => (
          <EducationCard
            key={edu.id}
            data={edu}
            collapsed={collapsed[edu.id] ?? false}
            onChange={(updated) => setEducations((prev) => prev.map((e) => e.id === updated.id ? updated : e))}
            onToggleCollapse={() => toggleCollapse(edu.id)}
            onDelete={() => setEducations((prev) => prev.filter((e) => e.id !== edu.id))}
          />
        ))}

        {/* Experience cards */}
        {experiences.map((exp) => (
          <ExperienceCard
            key={exp.id}
            data={exp}
            collapsed={collapsed[exp.id] ?? false}
            onChange={(updated) => setExperiences((prev) => prev.map((e) => e.id === updated.id ? updated : e))}
            onToggleCollapse={() => toggleCollapse(exp.id)}
            onDelete={() => setExperiences((prev) => prev.filter((e) => e.id !== exp.id))}
          />
        ))}

        {/* Project cards */}
        {projects.map((proj) => (
          <ProjectCard
            key={proj.id}
            data={proj}
            collapsed={collapsed[proj.id] ?? false}
            onChange={(updated) => setProjects((prev) => prev.map((p) => p.id === updated.id ? updated : p))}
            onToggleCollapse={() => toggleCollapse(proj.id)}
            onDelete={() => setProjects((prev) => prev.filter((p) => p.id !== proj.id))}
          />
        ))}

        {/* Skills bucket — singleton */}
        {skills && (
          <SkillsBucketCard
            data={skills}
            collapsed={collapsed.skills ?? false}
            onChange={setSkills}
            onToggleCollapse={() => toggleCollapse('skills')}
            onDelete={() => setSkills(null)}
          />
        )}

        {/* NEW… button */}
        <div className="relative mt-2">
          <button
            onClick={() => setNewMenuOpen((v) => !v)}
            style={{
              fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em',
              color: newMenuOpen ? T.green : T.greenDim,
              border: `1px solid ${newMenuOpen ? T.green : T.border}`,
              background: T.bg, padding: '5px 16px', cursor: 'pointer',
              transition: 'color 150ms, border-color 150ms',
            }}
          >
            NEW…
          </button>

          {newMenuOpen && (
            <div
              className="absolute left-0 flex flex-col"
              style={{ top: 'calc(100% + 4px)', background: T.bg, border: `1px solid ${T.border}`, minWidth: 160, boxShadow: '0 0 12px rgba(57,255,20,0.15)', zIndex: 30 }}
            >
              {NEW_ITEMS.map((item) => {
                const disabled = item === 'Skills' && skills !== null
                return (
                  <button
                    key={item}
                    disabled={disabled}
                    onClick={() => {
                      if (item === 'Experience') spawnExperience()
                      else if (item === 'Education') spawnEducation()
                      else if (item === 'Project') spawnProject()
                      else if (item === 'Skills') spawnSkills()
                      else setNewMenuOpen(false)
                    }}
                    style={{
                      fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em',
                      color: disabled ? T.border : T.greenDim,
                      background: 'transparent', border: 'none',
                      borderBottom: `1px solid ${T.border}`,
                      padding: '7px 14px', textAlign: 'left',
                      cursor: disabled ? 'default' : 'pointer',
                    }}
                    onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.color = T.green }}
                    onMouseLeave={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.color = T.greenDim }}
                  >
                    + {item.toUpperCase()}
                  </button>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
