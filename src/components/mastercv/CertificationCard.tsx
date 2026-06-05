import { T, labelClass, inputClass, CRT_FONT } from '@/lib/crtTheme'
import CVCard from './CVCard'

export interface Certification {
  id: string
  name: string
  issuer: string
  issueDate: string
  expiryDate: string
  credentialId: string
  url: string
}

interface Props {
  data: Certification
  collapsed: boolean
  onChange: (data: Certification) => void
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

export default function CertificationCard({ data, collapsed, onChange, onToggleCollapse, onDelete }: Props) {
  function set<K extends keyof Certification>(key: K, val: string) {
    onChange({ ...data, [key]: val })
  }

  const summaryParts = [data.name || data.issuer, data.issueDate].filter(Boolean)
  const summary = summaryParts.length ? summaryParts.join('  ·  ') : undefined

  return (
    <CVCard
      title="CERTIFICATION"
      summary={summary}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      onDelete={onDelete}
      glowColor="#f472b6"
    >
      {/* Row 1: name + issuer */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="Certification Name" value={data.name}   placeholder="AWS Solutions Architect"  onChange={(v) => set('name', v)} />
        </div>
        <div className="flex-1">
          <Field label="Issuing Organization" value={data.issuer} placeholder="Amazon Web Services"    onChange={(v) => set('issuer', v)} />
        </div>
      </div>

      {/* Row 2: issue date + expiry */}
      <div className="flex gap-3">
        <div style={{ flex: '0 0 110px' }}>
          <Field label="Issue Date"  value={data.issueDate}  placeholder="Mar 2024"  onChange={(v) => set('issueDate', v)} />
        </div>
        <div style={{ flex: '0 0 110px' }}>
          <Field label="Expiry Date" value={data.expiryDate} placeholder="Mar 2027"  onChange={(v) => set('expiryDate', v)} />
        </div>
        <div className="flex-1">
          <Field label="Credential ID" value={data.credentialId} placeholder="ABC-12345" onChange={(v) => set('credentialId', v)} />
        </div>
      </div>

      {/* Row 3: verification url */}
      <div>
        <Field label="Verification URL" value={data.url} placeholder="credly.com/badges/…" onChange={(v) => set('url', v)} />
      </div>
    </CVCard>
  )
}
