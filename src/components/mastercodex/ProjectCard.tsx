import { T, labelClass, inputClass, textareaClass, CRT_FONT } from '@/lib/crtTheme'
import CodexCard from './CodexCard'

export interface Project {
  id: string
  name: string
  role: string
  url: string
  startDate: string
  endDate: string
  technologies: string
  bullets: string[]
}

interface Props {
  data: Project
  collapsed: boolean
  onChange: (data: Project) => void
  onToggleCollapse: () => void
  onDelete?: () => void
}

function Field({ label, value, placeholder, onChange }: {
  label: string; value: string; placeholder: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <div className={labelClass} style={{ color: T.greenDim, fontSize: CRT_FONT.chrome }}>{label}</div>
      <input
        className={inputClass}
        style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export default function ProjectCard({ data, collapsed, onChange, onToggleCollapse, onDelete }: Props) {
  function set<K extends keyof Project>(key: K, val: Project[K]) {
    onChange({ ...data, [key]: val })
  }

  function setBullet(i: number, val: string) {
    const next = [...data.bullets]
    next[i] = val
    set('bullets', next)
  }

  function addBullet() {
    const next = [...data.bullets, '']
    set('bullets', next)
    setTimeout(() => {
      const textareas = document.querySelectorAll<HTMLTextAreaElement>(`[data-bullet-card="${data.id}"]`)
      textareas[next.length - 1]?.focus()
    }, 30)
  }

  function removeBullet(i: number) {
    set('bullets', data.bullets.filter((_, idx) => idx !== i))
  }

  function handleBulletKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const next = [...data.bullets]
      next.splice(i + 1, 0, '')
      set('bullets', next)
      setTimeout(() => {
        const textareas = document.querySelectorAll<HTMLTextAreaElement>(`[data-bullet-card="${data.id}"]`)
        textareas[i + 1]?.focus()
      }, 30)
    }
    if (e.key === 'Backspace' && data.bullets[i] === '' && data.bullets.length > 1) {
      e.preventDefault()
      removeBullet(i)
      setTimeout(() => {
        const textareas = document.querySelectorAll<HTMLTextAreaElement>(`[data-bullet-card="${data.id}"]`)
        textareas[Math.max(0, i - 1)]?.focus()
      }, 30)
    }
  }

  const yearRange = [data.startDate, data.endDate || 'Present'].filter(Boolean).join(' – ')
  const summaryParts = [data.name || data.role, yearRange].filter(Boolean)
  const summary = summaryParts.length ? summaryParts.join('  ·  ') : undefined

  return (
    <CodexCard
      title="PROJECT"
      summary={summary}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      onDelete={onDelete}
    >
      {/* Row 1: name + role */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="Project Name" value={data.name} placeholder="My Awesome App" onChange={(v) => set('name', v)} />
        </div>
        <div className="flex-1">
          <Field label="Your Role" value={data.role} placeholder="Lead Developer" onChange={(v) => set('role', v)} />
        </div>
      </div>

      {/* Row 2: dates + url */}
      <div className="flex gap-3">
        <div style={{ flex: '0 0 90px' }}>
          <Field label="Start" value={data.startDate} placeholder="Jan 2024" onChange={(v) => set('startDate', v)} />
        </div>
        <div style={{ flex: '0 0 90px' }}>
          <Field label="End" value={data.endDate} placeholder="Present" onChange={(v) => set('endDate', v)} />
        </div>
        <div className="flex-1">
          <Field label="URL / Repo" value={data.url} placeholder="github.com/you/project" onChange={(v) => set('url', v)} />
        </div>
      </div>

      {/* Row 3: technologies */}
      <div>
        <Field label="Technologies" value={data.technologies} placeholder="React, TypeScript, Supabase…" onChange={(v) => set('technologies', v)} />
      </div>

      {/* Bullets */}
      <div>
        <div className={labelClass} style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, marginBottom: 6 }}>
          BULLETS
        </div>

        <div className="flex flex-col gap-1.5">
          {data.bullets.map((bullet, i) => (
            <div key={i} className="flex items-start gap-2">
              <span style={{ color: T.greenDim, fontSize: CRT_FONT.body, lineHeight: 1.6, flexShrink: 0 }}>›</span>
              <textarea
                data-bullet-card={data.id}
                className={textareaClass}
                rows={2}
                style={{
                  color: T.green,
                  borderColor: T.border,
                  caretColor: T.green,
                  fontSize: CRT_FONT.body,
                  flex: 1,
                  lineHeight: 1.5,
                }}
                value={bullet}
                placeholder="Describe what you built and the impact…"
                onChange={(e) => setBullet(i, e.target.value)}
                onKeyDown={(e) => handleBulletKeyDown(e, i)}
              />
              <button
                onClick={() => removeBullet(i)}
                style={{ color: T.border, fontSize: CRT_FONT.chrome, lineHeight: 1.6, flexShrink: 0, cursor: 'pointer', background: 'none', border: 'none' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.warn }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.border }}
                title="Remove bullet"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addBullet}
          style={{
            marginTop: 8,
            fontFamily: 'monospace',
            fontSize: CRT_FONT.chrome,
            letterSpacing: '0.12em',
            color: T.greenDim,
            background: 'none',
            border: `1px solid ${T.border}`,
            padding: '3px 10px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.green; (e.currentTarget as HTMLElement).style.borderColor = T.green }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border }}
        >
          + ADD BULLET
        </button>
      </div>
    </CodexCard>
  )
}
