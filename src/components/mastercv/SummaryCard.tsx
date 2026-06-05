import { T, labelClass, textareaClass, CRT_FONT } from '@/lib/crtTheme'
import CVCard from './CVCard'

export interface Summary {
  id: string
  label: string
  text: string
}

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
    <CVCard
      title="SUMMARY"
      summary={summary}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      onDelete={onDelete}
      glowColor="#00d4ff"
    >
      <div>
        <div className={labelClass} style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, marginBottom: 4 }}>
          Label
        </div>
        <input
          className="bg-transparent outline-none w-full px-1 py-0.5 leading-tight border-b"
          style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body, marginBottom: 10 }}
          value={data.label}
          placeholder="e.g. Professional Summary, Objective…"
          onChange={(e) => set('label', e.target.value)}
        />
      </div>
      <div>
        <div className={labelClass} style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, marginBottom: 4 }}>
          Content
        </div>
        <textarea
          className={textareaClass}
          rows={4}
          style={{ color: T.green, borderColor: T.border, caretColor: T.green, fontSize: CRT_FONT.body, lineHeight: 1.6 }}
          value={data.text}
          placeholder="Results-driven engineer with 5+ years of experience building scalable web applications…"
          onChange={(e) => set('text', e.target.value)}
        />
      </div>
    </CVCard>
  )
}
