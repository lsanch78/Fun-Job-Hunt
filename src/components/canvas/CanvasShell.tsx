import { type ReactNode } from 'react'
import { T } from '@/lib/crtTheme'

interface CanvasShellProps {
  title: ReactNode
  titleColor?: string
  headerRight?: ReactNode
  headerExtra?: ReactNode
  children: ReactNode
  footer?: ReactNode
  position?: 'absolute' | 'fixed'
  zIndex?: number
  background?: string
  headerBorderColor?: string
}

export default function CanvasShell({
  title,
  titleColor = T.green,
  headerRight,
  headerExtra,
  children,
  footer,
  position = 'absolute',
  zIndex = 50,
  background = T.bg,
  headerBorderColor = T.border,
}: CanvasShellProps) {
  return (
    <div style={{ position, inset: 0, zIndex, background, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${headerBorderColor}`, padding: '18px 24px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 15, letterSpacing: '0.18em', color: titleColor }}>
            {title}
          </div>
          {headerRight && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
              {headerRight}
            </div>
          )}
        </div>
        {headerExtra}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: '14px 28px', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
          {footer}
        </div>
      )}
    </div>
  )
}
