export interface ColConfig {
  key: string
  visible: boolean
  width: number
}

export interface ColumnMenuState {
  x: number
  y: number
  key: string
}

export interface UseColumns {
  cols: ColConfig[]
  visibleCols: ColConfig[]
  dragColKey: string | null
  dragOverKey: string | null
  menu: ColumnMenuState | null
  closeMenu: () => void
  openMenu: (x: number, y: number, key: string) => void
  moveLeft: (key: string) => void
  moveRight: (key: string) => void
  hide: (key: string) => void
  toggleVisible: (key: string) => void
  reset: () => void
  reorder: (fromKey: string, toKey: string) => void
  setWidth: (key: string, width: number) => void
  commitWidths: () => void
  beginDrag: (key: string) => void
  endDrag: () => void
  setDragOver: (key: string | null) => void
  isResizingRef: React.MutableRefObject<boolean>
}

export type SortField = 'company' | 'date' | 'status'
export type SortDir   = 'asc' | 'desc'
export interface SortState { field: SortField; dir: SortDir }

export type TimeRange = 'today' | '7d' | '30d' | 'year' | 'all'

export interface XpPopup {
  id: number
  mega: boolean
  x: number
  y: number
  label?: string
}
