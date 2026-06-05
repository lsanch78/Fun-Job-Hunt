import { type ReactNode } from 'react'
import { Trash } from 'pixelarticons/react'
import { T, ensureCrtStyles, CRT_FONT } from '@/lib/crtTheme'

ensureCrtStyles()

interface Props {
  title: string
  summary?: string
  collapsed: boolean
  onToggleCollapse: () => void
  onDelete?: () => void
  glowColor?: string
  children: ReactNode
}

function makeGlow(hex: string) {
  return [
    '0 0 0 1px #111',
    `0 0 6px 1px ${hex}22`,
    `0 0 16px 2px ${hex}14`,
    'inset 0 0 60px 30px rgba(0,0,0,0.70)',
    `inset 0 0 10px 2px ${hex}06`,
  ].join(', ')
}

export default function CodexCard({ title, summary, collapsed, onToggleCollapse, onDelete, glowColor, children }: Props) {
  const color    = glowColor ?? T.green
  const colorDim = glowColor ? `${glowColor}99` : T.greenDim

  return (
    <div
      className="crt-card w-full flex flex-col"
      style={{
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        boxShadow: makeGlow(color),
        textShadow: `0 0 4px ${color}0d`,
        fontFamily: 'monospace',
      }}
    >
      {/* Header — click to collapse/expand */}
      <div
        className="flex items-center justify-between px-4 py-2.5 w-full flex-shrink-0"
        style={{ borderBottom: collapsed ? 'none' : `1px solid ${T.border}` }}
      >
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
          style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
        >
          <span style={{ color: colorDim, fontSize: CRT_FONT.chrome, letterSpacing: '0.15em', flexShrink: 0 }}>
            {title}
          </span>
          {collapsed && summary && (
            <span className="truncate" style={{ color, fontSize: CRT_FONT.chrome, letterSpacing: '0.08em', opacity: 0.75 }}>
              {summary}
            </span>
          )}
          <span style={{ color: colorDim, fontSize: CRT_FONT.chrome, flexShrink: 0 }}>
            {collapsed ? '▸' : '▾'}
          </span>
        </button>

        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            title="Delete card"
            style={{ color: T.border, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 12px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.warn }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.border }}
          >
            <Trash style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>

      {/* Body — hidden when collapsed */}
      {!collapsed && (
        <div className="flex flex-col gap-3 px-4 py-3" style={{ userSelect: 'text' }}>
          {children}
        </div>
      )}
    </div>
  )
}
