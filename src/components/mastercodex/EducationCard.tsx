import { T, labelClass, inputClass, CRT_FONT } from '@/lib/crtTheme'
import CodexCard from './CodexCard'

export interface Education {
  id: string
  institution: string
  degree: string
  field: string
  location: string
  startDate: string
  endDate: string
  gpa: string
  notes: string
}

interface Props {
  data: Education
  collapsed: boolean
  onChange: (data: Education) => void
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

export default function EducationCard({ data, collapsed, onChange, onToggleCollapse, onDelete }: Props) {
  function set<K extends keyof Education>(key: K, val: string) {
    onChange({ ...data, [key]: val })
  }

  const yearRange = [data.startDate, data.endDate].filter(Boolean).join(' – ')
  const summaryParts = [data.institution, yearRange].filter(Boolean)
  const summary = summaryParts.length ? summaryParts.join('  ·  ') : undefined

  return (
    <CodexCard
      title="EDUCATION"
      summary={summary}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      onDelete={onDelete}
      glowColor="#a78bfa"
    >
      {/* Row 1: institution + location */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="Institution" value={data.institution} placeholder="MIT"              onChange={(v) => set('institution', v)} />
        </div>
        <div className="flex-1">
          <Field label="Location"    value={data.location}    placeholder="Cambridge, MA"    onChange={(v) => set('location', v)} />
        </div>
      </div>

      {/* Row 2: degree + field */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="Degree"      value={data.degree}      placeholder="B.S."             onChange={(v) => set('degree', v)} />
        </div>
        <div className="flex-1">
          <Field label="Field"       value={data.field}       placeholder="Computer Science"  onChange={(v) => set('field', v)} />
        </div>
      </div>

      {/* Row 3: dates + GPA */}
      <div className="flex gap-3">
        <div style={{ flex: '0 0 90px' }}>
          <Field label="Start"       value={data.startDate}   placeholder="Sep 2018"         onChange={(v) => set('startDate', v)} />
        </div>
        <div style={{ flex: '0 0 90px' }}>
          <Field label="End"         value={data.endDate}     placeholder="May 2022"         onChange={(v) => set('endDate', v)} />
        </div>
        <div style={{ flex: '0 0 80px' }}>
          <Field label="GPA"         value={data.gpa}         placeholder="3.9"              onChange={(v) => set('gpa', v)} />
        </div>
      </div>

      {/* Notes — honours, activities, relevant coursework */}
      <div>
        <div className={labelClass} style={{ color: T.greenDim, fontSize: CRT_FONT.chrome }}>Notes</div>
        <textarea
          className="bg-transparent outline-none w-full px-1 py-0.5 leading-tight border-b resize-none"
          rows={2}
          style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body }}
          value={data.notes}
          placeholder="Honours, activities, relevant coursework…"
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>
    </CodexCard>
  )
}
