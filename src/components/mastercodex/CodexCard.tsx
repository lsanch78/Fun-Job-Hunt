import { type ReactNode } from 'react'
import { T, crtBoxShadow, crtTextShadow, ensureCrtStyles, CRT_FONT } from '@/lib/crtTheme'

ensureCrtStyles()

interface Props {
  title: string
  summary?: string
  collapsed: boolean
  onToggleCollapse: () => void
  children: ReactNode
}

export default function CodexCard({ title, summary, collapsed, onToggleCollapse, children }: Props) {
  return (
    <div
      className="crt-card w-full flex flex-col"
      style={{
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        boxShadow: crtBoxShadow,
        textShadow: crtTextShadow,
        fontFamily: 'monospace',
      }}
    >
      {/* Header — click to collapse/expand */}
      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-between px-4 py-2.5 w-full text-left flex-shrink-0"
        style={{ borderBottom: collapsed ? 'none' : `1px solid ${T.border}`, cursor: 'pointer', background: 'none', border: 'none' }}
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <span style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, letterSpacing: '0.15em', flexShrink: 0 }}>
            {title}
          </span>
          {collapsed && summary && (
            <span className="truncate" style={{ color: T.green, fontSize: CRT_FONT.chrome, letterSpacing: '0.08em', opacity: 0.75 }}>
              {summary}
            </span>
          )}
        </div>
        <span style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, flexShrink: 0, marginLeft: 8 }}>
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {/* Body — hidden when collapsed */}
      {!collapsed && (
        <div className="flex flex-col gap-3 px-4 py-3" style={{ userSelect: 'text' }}>
          {children}
        </div>
      )}
    </div>
  )
}
