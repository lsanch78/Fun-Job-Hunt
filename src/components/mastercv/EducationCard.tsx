import { labelStyle, inputStyle, textareaStyle } from '@/lib/CVCardTheme'
import type { Education } from '@/types'
import CVCard from './CVCard'

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
      <div style={labelStyle}>{label}</div>
      <input style={inputStyle} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
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
    <CVCard title="EDUCATION" summary={summary} collapsed={collapsed} onToggleCollapse={onToggleCollapse} onDelete={onDelete} accentColor="#22c55e">
      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="Institution" value={data.institution} placeholder="MIT"             onChange={(v) => set('institution', v)} />
        </div>
        <div className="flex-1">
          <Field label="Location"    value={data.location}    placeholder="Cambridge, MA"   onChange={(v) => set('location', v)} />
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="Degree" value={data.degree} placeholder="B.S."            onChange={(v) => set('degree', v)} />
        </div>
        <div className="flex-1">
          <Field label="Field"  value={data.field}  placeholder="Computer Science" onChange={(v) => set('field', v)} />
        </div>
      </div>

      <div className="flex gap-3">
        <div style={{ flex: '0 0 90px' }}>
          <Field label="Start" value={data.startDate} placeholder="Sep 2018" onChange={(v) => set('startDate', v)} />
        </div>
        <div style={{ flex: '0 0 90px' }}>
          <Field label="End"   value={data.endDate}   placeholder="May 2022" onChange={(v) => set('endDate', v)} />
        </div>
        <div style={{ flex: '0 0 80px' }}>
          <Field label="GPA"   value={data.gpa}       placeholder="3.9"      onChange={(v) => set('gpa', v)} />
        </div>
      </div>

      <div>
        <div style={labelStyle}>Notes</div>
        <textarea
          rows={2}
          style={textareaStyle}
          value={data.notes}
          placeholder="Honours, activities, relevant coursework…"
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>
    </CVCard>
  )
}
