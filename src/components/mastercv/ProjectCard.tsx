import { useState } from 'react'
import type { CSSProperties } from 'react'
import { labelStyle, inputStyle, textareaStyle, bulletGlyphStyle, removeBtnStyle, removeBtnHoverStyle, addBtnStyle, addBtnHoverStyle } from '@/lib/CVCardTheme'
import type { Project } from '@/types'
import CVCard from './CVCard'

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
      <div style={labelStyle}>{label}</div>
      <input style={inputStyle} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export default function ProjectCard({ data, collapsed, onChange, onToggleCollapse, onDelete }: Props) {
  const [addBtnHover, setAddBtnHover] = useState(false)
  const [removeBtnHovers, setRemoveBtnHovers] = useState<Record<number, boolean>>({})

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
    <CVCard title="PROJECT" summary={summary} collapsed={collapsed} onToggleCollapse={onToggleCollapse} onDelete={onDelete} accentColor="#a855f7">
      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="Project Name" value={data.name} placeholder="My Awesome App" onChange={(v) => set('name', v)} />
        </div>
        <div className="flex-1">
          <Field label="Your Role"    value={data.role} placeholder="Lead Developer"  onChange={(v) => set('role', v)} />
        </div>
      </div>

      <div className="flex gap-3">
        <div style={{ flex: '0 0 90px' }}>
          <Field label="Start"    value={data.startDate} placeholder="Jan 2024" onChange={(v) => set('startDate', v)} />
        </div>
        <div style={{ flex: '0 0 90px' }}>
          <Field label="End"      value={data.endDate}   placeholder="Present"  onChange={(v) => set('endDate', v)} />
        </div>
        <div className="flex-1">
          <Field label="URL / Repo" value={data.url} placeholder="github.com/you/project" onChange={(v) => set('url', v)} />
        </div>
      </div>

      <div>
        <Field label="Technologies" value={data.technologies} placeholder="React, TypeScript, Supabase…" onChange={(v) => set('technologies', v)} />
      </div>

      <div className="flex flex-col">
        <div style={{ ...labelStyle, marginBottom: 6 }}>Bullets</div>
        <div className="flex flex-col gap-1.5">
          {data.bullets.map((bullet, i) => (
            <div key={i} className="flex items-start gap-2">
              <span style={bulletGlyphStyle}>•</span>
              <textarea
                data-bullet-card={data.id}
                rows={2}
                style={{ ...textareaStyle, flex: 1, lineHeight: 1.5 } as CSSProperties}
                value={bullet}
                placeholder="Describe what you built and the impact…"
                onChange={(e) => setBullet(i, e.target.value)}
                onKeyDown={(e) => handleBulletKeyDown(e, i)}
              />
              <button
                onClick={() => removeBullet(i)}
                style={removeBtnHovers[i] ? { ...removeBtnStyle, ...removeBtnHoverStyle } : removeBtnStyle}
                onMouseEnter={() => setRemoveBtnHovers(prev => ({ ...prev, [i]: true }))}
                onMouseLeave={() => setRemoveBtnHovers(prev => ({ ...prev, [i]: false }))}
                title="Remove bullet"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addBullet}
          style={addBtnHover ? { ...addBtnStyle, ...addBtnHoverStyle } : addBtnStyle}
          onMouseEnter={() => setAddBtnHover(true)}
          onMouseLeave={() => setAddBtnHover(false)}
        >
          Add Bullet
        </button>
      </div>
    </CVCard>
  )
}
