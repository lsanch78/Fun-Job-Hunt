import { T, labelClass, inputClass, textareaClass, CRT_FONT } from '@/lib/crtTheme'
import CVCard from './CVCard'

export interface Award {
  id: string
  title: string
  issuer: string
  date: string
  description: string
}

interface Props {
  data: Award
  collapsed: boolean
  onChange: (data: Award) => void
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

export default function AwardCard({ data, collapsed, onChange, onToggleCollapse, onDelete }: Props) {
  function set<K extends keyof Award>(key: K, val: string) {
    onChange({ ...data, [key]: val })
  }

  const summaryParts = [data.title || data.issuer, data.date].filter(Boolean)
  const summary = summaryParts.length ? summaryParts.join('  ·  ') : undefined

  return (
    <CVCard
      title="AWARD / HONOR"
      summary={summary}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      onDelete={onDelete}
      glowColor="#fb923c"
    >
      {/* Row 1: title + issuer */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="Award / Honor"    value={data.title}  placeholder="Dean's List"          onChange={(v) => set('title', v)} />
        </div>
        <div className="flex-1">
          <Field label="Granted By"       value={data.issuer} placeholder="University of Texas"   onChange={(v) => set('issuer', v)} />
        </div>
      </div>

      {/* Row 2: date */}
      <div style={{ maxWidth: 140 }}>
        <Field label="Date" value={data.date} placeholder="May 2023" onChange={(v) => set('date', v)} />
      </div>

      {/* Description */}
      <div>
        <div className={labelClass} style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, marginBottom: 4 }}>Description</div>
        <textarea
          className={textareaClass}
          rows={2}
          style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body, lineHeight: 1.5 }}
          value={data.description}
          placeholder="Brief description of the award and why it was received…"
          onChange={(e) => set('description', e.target.value)}
        />
      </div>
    </CVCard>
  )
}
