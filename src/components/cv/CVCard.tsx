import { useState, type ReactNode } from 'react'
import { Trash } from 'pixelarticons/react'
import { P, CV_FONT, removeBtnHoverStyle } from '@/lib/CVCardTheme'

interface Props {
  title: string
  summary?: string
  collapsed: boolean
  onToggleCollapse: () => void
  onDelete?: () => void
  accentColor?: string
  glowColor?: string  // kept for call-site compatibility, unused visually
  children: ReactNode
}

export default function CVCard({ title, summary, collapsed, onToggleCollapse, onDelete, accentColor, children }: Props) {
  const [deleteHover, setDeleteHover] = useState(false)
  const [cardHover, setCardHover] = useState(false)

  const deleteBtnBase: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '0 0 0 12px', flexShrink: 0, display: 'flex', alignItems: 'center',
    color: P.text, transition: 'opacity 0.15s',
  }

  return (
    <div
      className="w-full"
      onMouseEnter={() => setCardHover(true)}
      onMouseLeave={() => setCardHover(false)}
      style={{
        background:   P.bg,
        border:       `1px solid ${P.border}`,
        borderRadius: 4,
        boxShadow:    '0 1px 4px rgba(0,0,0,0.08)',
        fontFamily:   CV_FONT.family,
      }}
    >
      {/* Section header — entire row is clickable to collapse/expand */}
      <div
        className="flex items-center justify-between px-5 pt-4 pb-3 cursor-pointer"
        style={{ borderBottom: `2px solid ${accentColor ?? P.rule}` }}
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span style={{
            fontFamily:    CV_FONT.family,
            fontSize:      CV_FONT.section,
            fontVariant:   'small-caps',
            letterSpacing: '0.03em',
            fontWeight:    'normal',
            color:         P.text,
          }}>
            {title}
          </span>
          {collapsed && summary && (
            <span className="truncate" style={{
              fontSize: CV_FONT.body,
              color:    P.textMuted,
            }}>
              — {summary}
            </span>
          )}
          <span style={{ color: P.textMuted, fontSize: CV_FONT.body, flexShrink: 0 }}>
            {collapsed ? '▸' : '▾'}
          </span>
        </div>

        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            title="Delete card"
            style={deleteHover ? { ...deleteBtnBase, ...removeBtnHoverStyle, opacity: 1 } : { ...deleteBtnBase, opacity: cardHover ? 1 : 0 }}
            onMouseEnter={() => setDeleteHover(true)}
            onMouseLeave={() => setDeleteHover(false)}
          >
            <Trash style={{ width: 13, height: 13 }} />
          </button>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="flex flex-col gap-4 px-5 py-4" style={{ userSelect: 'text' }}>
          {children}
        </div>
      )}
    </div>
  )
}
