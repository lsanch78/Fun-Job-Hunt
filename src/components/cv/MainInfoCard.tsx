import { labelStyle, inputStyle } from '@/lib/CVCardTheme'
import type { MainInfo } from '@/types'
import CVCard from './CVCard'

interface Props {
  data: MainInfo
  collapsed: boolean
  onChange: (data: MainInfo) => void
  onToggleCollapse: () => void
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

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export default function MainInfoCard({ data, collapsed, onChange, onToggleCollapse }: Props) {
  function set<K extends keyof MainInfo>(key: K, val: string) {
    onChange({ ...data, [key]: val })
  }

  const summary = data.fullName || undefined

  return (
    <CVCard title="MAIN INFO" summary={summary} collapsed={collapsed} onToggleCollapse={onToggleCollapse} accentColor="#3b82f6">
      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="Full Name" value={data.fullName} placeholder="Jane Doe"          onChange={(v) => set('fullName', v)} />
        </div>
        <div className="flex-1">
          <Field label="Job Title" value={data.jobTitle} placeholder="Software Engineer" onChange={(v) => set('jobTitle', v)} />
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="Email" value={data.email} placeholder="jane@example.com"   onChange={(v) => set('email', v)} />
        </div>
        <div className="flex-1">
          <Field label="Phone" value={data.phone} placeholder="(555) 000-0000"     onChange={(v) => set('phone', formatPhone(v))} />
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="Location" value={data.location} placeholder="San Francisco, CA" onChange={(v) => set('location', v)} />
        </div>
        <div className="flex-1">
          <Field label="Website"  value={data.website}  placeholder="janedoe.dev"       onChange={(v) => set('website', v)} />
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="LinkedIn" value={data.linkedin} placeholder="linkedin.com/in/jane" onChange={(v) => set('linkedin', v)} />
        </div>
        <div className="flex-1">
          <Field label="GitHub"   value={data.github}   placeholder="github.com/jane"      onChange={(v) => set('github', v)} />
        </div>
      </div>
    </CVCard>
  )
}
