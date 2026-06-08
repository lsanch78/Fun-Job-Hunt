import { useEffect } from 'react'
import { COL_DEFS, REQUIRED_COLS } from '@/hooks/useJobLogColumns'
import type { ColConfig } from './types'

interface Props {
  x: number
  y: number
  isFirst: boolean
  isLast: boolean
  allCols: ColConfig[]
  activeKey: string
  onMoveLeft: () => void
  onMoveRight: () => void
  onHide: () => void
  onToggleCol: (key: string) => void
  onReset: () => void
  onClose: () => void
}

export function ColumnContextMenu({
  x, y, isFirst, isLast, allCols, activeKey,
  onMoveLeft, onMoveRight, onHide, onToggleCol, onReset, onClose,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const btnBase = 'block w-full text-left px-3 py-1.5 font-pixel text-[10px] transition-none'
  const btnActive = `${btnBase} text-primary hover:bg-surface`
  const btnDimmed = `${btnBase} text-muted/40 cursor-default`

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Menu */}
      <div
        className="fixed z-50 border border-border bg-bg py-1 min-w-[140px]"
        style={{ left: x, top: y }}
      >
        <button className={isFirst ? btnDimmed : btnActive} onClick={isFirst ? undefined : () => { onMoveLeft(); onClose() }}>
          ← Move Left
        </button>
        <button className={isLast ? btnDimmed : btnActive} onClick={isLast ? undefined : () => { onMoveRight(); onClose() }}>
          → Move Right
        </button>
        <div className="border-t border-border my-1" />
        <button
          className={REQUIRED_COLS.has(activeKey) ? btnDimmed : btnActive}
          onClick={REQUIRED_COLS.has(activeKey) ? undefined : () => { onHide(); onClose() }}
        >
          ✕ Hide Column
        </button>
        <button className={btnActive} onClick={() => { onReset(); onClose() }}>
          ↺ Reset to Default
        </button>
        <div className="border-t border-border my-1" />
        {allCols.map((col) => {
          const isRequired = REQUIRED_COLS.has(col.key)
          return (
            <button
              key={col.key}
              className={`${btnBase} flex items-center gap-2 ${isRequired ? 'text-muted/40 cursor-default' : 'text-muted hover:bg-surface hover:text-primary'}`}
              onClick={isRequired ? undefined : () => onToggleCol(col.key)}
            >
              <span className="w-3 text-secondary">{col.visible ? '✓' : ''}</span>
              <span className={isRequired ? 'text-warn' : ''}>{COL_DEFS[col.key].label}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
