import { labelStyle, inputStyle, textareaStyle } from '@/lib/CVCardTheme'
import type { Summary } from '@/types'
import CVCard from './CVCard'

interface Props {
  data: Summary
  collapsed: boolean
  onChange: (data: Summary) => void
  onToggleCollapse: () => void
  onDelete?: () => void
}

export default function SummaryCard({ data, collapsed, onChange, onToggleCollapse, onDelete }: Props) {
  function set<K extends keyof Summary>(key: K, val: string) {
    onChange({ ...data, [key]: val })
  }

  const words = data.text.trim().split(/\s+/).filter(Boolean).length
  const summary = [data.label, words > 0 ? `${words} words` : null].filter(Boolean).join('  ·  ') || undefined

  return (
    <CVCard title="SUMMARY" summary={summary} collapsed={collapsed} onToggleCollapse={onToggleCollapse} onDelete={onDelete} accentColor="#64748b">
      <div>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Label</div>
        <input
          style={{ ...inputStyle, marginBottom: 10 }}
          value={data.label}
          placeholder="e.g. Professional Summary, Objective…"
          onChange={(e) => set('label', e.target.value)}
        />
      </div>
      <div>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Content</div>
        <textarea
          rows={4}
          style={{ ...textareaStyle, lineHeight: 1.6 }}
          value={data.text}
          placeholder="Results-driven engineer with 5+ years of experience building scalable web applications…"
          onChange={(e) => set('text', e.target.value)}
        />
      </div>
    </CVCard>
  )
}
