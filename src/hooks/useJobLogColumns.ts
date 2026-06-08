import { useState, useRef, useCallback } from 'react'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import type { ColConfig } from '@/components/joblog/types'

// ── Static config ─────────────────────────────────────────────────────────────

export const REQUIRED_COLS = new Set(['company', 'title'])

export const COL_DEFS: Record<string, { label: string; defaultWidth: number }> = {
  company:  { label: 'COMPANY',  defaultWidth: 140 },
  title:    { label: 'TITLE',    defaultWidth: 160 },
  url:      { label: 'URL',      defaultWidth:  48 },
  salary:   { label: 'SALARY',   defaultWidth:  80 },
  rating:   { label: 'RATING',   defaultWidth:  96 },
  date:     { label: 'DATE',     defaultWidth:  60 },
  status:   { label: 'STATUS',   defaultWidth: 130 },
  jd:       { label: 'JD',       defaultWidth: 160 },
  contacts: { label: 'CONTACTS', defaultWidth: 140 },
  notes:    { label: 'NOTES',    defaultWidth: 160 },
}

export const DEFAULT_COLS: ColConfig[] = [
  { key: 'company',  visible: true,  width: COL_DEFS.company.defaultWidth  },
  { key: 'title',    visible: true,  width: COL_DEFS.title.defaultWidth    },
  { key: 'url',      visible: true,  width: COL_DEFS.url.defaultWidth      },
  { key: 'salary',   visible: true,  width: COL_DEFS.salary.defaultWidth   },
  { key: 'rating',   visible: true,  width: COL_DEFS.rating.defaultWidth   },
  { key: 'date',     visible: true,  width: COL_DEFS.date.defaultWidth     },
  { key: 'status',   visible: true,  width: COL_DEFS.status.defaultWidth   },
  { key: 'jd',       visible: false, width: COL_DEFS.jd.defaultWidth       },
  { key: 'contacts', visible: false, width: COL_DEFS.contacts.defaultWidth },
  { key: 'notes',    visible: false, width: COL_DEFS.notes.defaultWidth    },
]

// ── Persistence ───────────────────────────────────────────────────────────────

function readColConfig(): ColConfig[] {
  const parsed = lsGet<ColConfig[] | null>(SK.colConfig, null)
  if (!parsed) return DEFAULT_COLS
  const savedKeys = new Set(parsed.map((c) => c.key))
  const withDefaults = parsed.map((c) => ({
    ...c,
    width: c.width ?? COL_DEFS[c.key]?.defaultWidth ?? 120,
  }))
  return [...withDefaults, ...DEFAULT_COLS.filter((c) => !savedKeys.has(c.key))]
}

function writeColConfig(cols: ColConfig[]): void {
  lsSet(SK.colConfig, cols)
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface ColumnMenuState {
  x: number
  y: number
  key: string
}

export interface UseColumns {
  cols: ColConfig[]
  visibleCols: ColConfig[]
  /** Drag-in-progress state — header uses this to dim/highlight cells. */
  dragColKey: string | null
  dragOverKey: string | null
  /** Right-click menu state — null when closed. */
  menu: ColumnMenuState | null
  closeMenu: () => void
  openMenu: (x: number, y: number, key: string) => void

  // Mutators — all persist to localStorage.
  moveLeft: (key: string) => void
  moveRight: (key: string) => void
  hide: (key: string) => void
  toggleVisible: (key: string) => void
  reset: () => void
  reorder: (fromKey: string, toKey: string) => void
  setWidth: (key: string, width: number) => void
  commitWidths: () => void

  // Drag handlers — header attaches these to <th>.
  beginDrag: (key: string) => void
  endDrag: () => void
  setDragOver: (key: string | null) => void

  /** Set by ColumnHeader's resize handle so drag-start can ignore it. */
  isResizingRef: React.MutableRefObject<boolean>
}

export function useJobLogColumns(): UseColumns {
  const [cols, setCols] = useState<ColConfig[]>(readColConfig)
  const [menu, setMenu] = useState<ColumnMenuState | null>(null)
  const [dragColKey, setDragColKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const isResizingRef = useRef(false)

  const visibleCols = cols.filter((c) => c.visible)

  const moveLeft = useCallback((key: string) => {
    setCols((prev) => {
      const next = [...prev]
      const allIdx = next.findIndex((c) => c.key === key)
      // Find the closest visible col to the left in the full array
      let swapIdx = -1
      for (let i = allIdx - 1; i >= 0; i--) {
        if (next[i].visible) { swapIdx = i; break }
      }
      if (swapIdx === -1) return prev
      ;[next[swapIdx], next[allIdx]] = [next[allIdx], next[swapIdx]]
      writeColConfig(next)
      return next
    })
  }, [])

  const moveRight = useCallback((key: string) => {
    setCols((prev) => {
      const next = [...prev]
      const allIdx = next.findIndex((c) => c.key === key)
      let swapIdx = -1
      for (let i = allIdx + 1; i < next.length; i++) {
        if (next[i].visible) { swapIdx = i; break }
      }
      if (swapIdx === -1) return prev
      ;[next[allIdx], next[swapIdx]] = [next[swapIdx], next[allIdx]]
      writeColConfig(next)
      return next
    })
  }, [])

  const hide = useCallback((key: string) => {
    setCols((prev) => {
      const next = prev.map((c) => c.key === key ? { ...c, visible: false } : c)
      writeColConfig(next)
      return next
    })
  }, [])

  const toggleVisible = useCallback((key: string) => {
    setCols((prev) => {
      const next = prev.map((c) => c.key === key ? { ...c, visible: !c.visible } : c)
      writeColConfig(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    writeColConfig(DEFAULT_COLS)
    setCols(DEFAULT_COLS)
  }, [])

  const reorder = useCallback((fromKey: string, toKey: string) => {
    if (!fromKey || fromKey === toKey) return
    setCols((prev) => {
      const next = [...prev]
      const fromIdx = next.findIndex((c) => c.key === fromKey)
      const toIdx   = next.findIndex((c) => c.key === toKey)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      writeColConfig(next)
      return next
    })
  }, [])

  const setWidth = useCallback((key: string, width: number) => {
    setCols((prev) => prev.map((c) => c.key === key ? { ...c, width } : c))
  }, [])

  const commitWidths = useCallback(() => {
    setCols((prev) => { writeColConfig(prev); return prev })
  }, [])

  const openMenu  = useCallback((x: number, y: number, key: string) => setMenu({ x, y, key }), [])
  const closeMenu = useCallback(() => setMenu(null), [])

  const beginDrag = useCallback((key: string) => setDragColKey(key), [])
  const endDrag   = useCallback(() => { setDragColKey(null); setDragOverKey(null) }, [])
  const setDragOver = useCallback((key: string | null) => setDragOverKey(key), [])

  return {
    cols,
    visibleCols,
    dragColKey,
    dragOverKey,
    menu,
    openMenu,
    closeMenu,
    moveLeft,
    moveRight,
    hide,
    toggleVisible,
    reset,
    reorder,
    setWidth,
    commitWidths,
    beginDrag,
    endDrag,
    setDragOver,
    isResizingRef,
  }
}
