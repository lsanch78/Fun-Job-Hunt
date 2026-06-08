import { COL_DEFS, REQUIRED_COLS, type UseColumns } from '@/hooks/useJobLogColumns'

/**
 * Renders draggable, resizable, right-clickable <th> cells for the user-configurable
 * columns. The page wraps these with its own fixed-position <th>s (delete checkbox,
 * terminal icon on the left; commit-hint on the right).
 */
export function ColumnHeader({ columns }: { columns: UseColumns }) {
  const {
    visibleCols,
    dragColKey,
    dragOverKey,
    beginDrag,
    endDrag,
    setDragOver,
    reorder,
    openMenu,
    setWidth,
    commitWidths,
    isResizingRef,
  } = columns

  return (
    <>
      {visibleCols.map((col) => (
        <th
          key={col.key}
          draggable
          onDragStart={(e) => {
            if (isResizingRef.current) { e.preventDefault(); return }
            beginDrag(col.key)
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', col.key)
          }}
          onDragEnd={endDrag}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(col.key) }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => {
            e.preventDefault()
            const fromKey = e.dataTransfer.getData('text/plain')
            reorder(fromKey, col.key)
            setDragOver(null)
          }}
          onContextMenu={(e) => { e.preventDefault(); openMenu(e.clientX, e.clientY, col.key) }}
          className={`px-2 py-2 font-normal whitespace-nowrap cursor-grab active:cursor-grabbing select-none hover:text-secondary group transition-colors relative ${
            dragOverKey === col.key ? 'text-secondary border-l-2 border-secondary' : dragColKey === col.key ? 'opacity-40 text-muted' : 'text-muted'
          }`}
          title="Drag to reorder · Right-click for options"
        >
          <span className={REQUIRED_COLS.has(col.key) ? 'text-warn' : ''}>
            {COL_DEFS[col.key].label}
          </span>
          <span className="ml-1 opacity-0 group-hover:opacity-40 text-[8px]">⠿</span>
          {/* Resize handle — uses pointer capture so it wins over the th's drag */}
          <span
            className="absolute right-0 top-0 h-full w-2 cursor-col-resize opacity-0 group-hover:opacity-100 flex items-center justify-center select-none z-10"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              isResizingRef.current = true
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
              const startX = e.clientX
              const startW = col.width
              function onMove(ev: PointerEvent) {
                const newW = Math.max(40, startW + ev.clientX - startX)
                setWidth(col.key, newW)
              }
              function onUp() {
                isResizingRef.current = false
                window.removeEventListener('pointermove', onMove)
                window.removeEventListener('pointerup', onUp)
                commitWidths()
              }
              window.addEventListener('pointermove', onMove)
              window.addEventListener('pointerup', onUp)
            }}
            onClick={(e) => e.stopPropagation()}
            title="Drag to resize"
          >
            <span className="text-muted/60 text-[8px] leading-none pointer-events-none">│</span>
          </span>
        </th>
      ))}
    </>
  )
}
