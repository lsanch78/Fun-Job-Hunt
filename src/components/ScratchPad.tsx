import { useState, useRef, useEffect } from 'react'
import { playSelectClick, playScratchOpen, playScratchClose } from '@/lib/sfx'
import { fetchScratchPad, upsertScratchPad, SCRATCH_PAD_LIMIT } from '@/services/scratchPadService'

// ── Sync badge ────────────────────────────────────────────────────────────────

function SyncBadge({ status }: { status: 'synced' | 'syncing' | null }) {
  if (!status) return <span className="font-pixel text-[9px] text-muted select-none">local only</span>
  return (
    <span className="flex items-center gap-1 select-none">
      <span className={`font-pixel text-[9px] ${status === 'syncing' ? 'animate-blink' : ''} ${status === 'synced' ? 'text-secondary' : 'text-muted'}`}>●</span>
      <span className="font-pixel text-[9px] text-muted">{status === 'synced' ? 'synced' : 'syncing'}</span>
    </span>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SCRATCH_TAB_KEY    = 'fjobhunt:scratchtab'
const SCRATCH_HEIGHT_KEY = 'fjobhunt:scratchheight'
const SCRATCH_OPEN_KEY   = 'fjobhunt:scratchopen'

const scratchPadKey  = (uid: string) => `fjobhunt:scratchpad:${uid}`
const scratchListKey = (uid: string) => `fjobhunt:scratchlist:${uid}`

const SCRATCH_MIN_H = 120
const SCRATCH_MAX_H = 600
const SCRATCH_DEF_H = 220

interface CheckItem { id: string; text: string; done: boolean }

// ── ScratchPad ────────────────────────────────────────────────────────────────

export default function ScratchPad({ userId }: { userId: string | null }) {
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(SCRATCH_OPEN_KEY) === 'true' } catch { return false }
  })
  const [tab, setTab] = useState<'pad' | 'list'>(() => {
    try { return (localStorage.getItem(SCRATCH_TAB_KEY) as 'pad' | 'list') ?? 'pad' } catch { return 'pad' }
  })
  const [height, setHeight] = useState<number>(() => {
    try { return Number(localStorage.getItem(SCRATCH_HEIGHT_KEY)) || SCRATCH_DEF_H } catch { return SCRATCH_DEF_H }
  })
  const [text, setText] = useState('')
  const [items, setItems] = useState<CheckItem[]>([])
  const [newItem, setNewItem] = useState('')
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing'>('synced')
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const newItemRef    = useRef<HTMLInputElement>(null)
  const isDragging    = useRef(false)
  const saveTextTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveListTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userId) return
    try {
      const cachedText = localStorage.getItem(scratchPadKey(userId))
      if (cachedText) setText(cachedText)
      const cachedList = localStorage.getItem(scratchListKey(userId))
      if (cachedList) setItems(JSON.parse(cachedList) as CheckItem[])
    } catch { /* noop */ }
    setSyncStatus('syncing')
    fetchScratchPad(userId).then((rec) => {
      if (rec) {
        if (rec.notes) {
          setText(rec.notes)
          try { localStorage.setItem(scratchPadKey(userId), rec.notes) } catch { /* noop */ }
        }
        if (rec.list) {
          try {
            const parsed = JSON.parse(rec.list) as CheckItem[]
            setItems(parsed)
            try { localStorage.setItem(scratchListKey(userId), JSON.stringify(parsed)) } catch { /* noop */ }
          } catch { /* noop */ }
        }
      }
      setSyncStatus('synced')
    })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    setTimeout(() => {
      if (tab === 'pad') textareaRef.current?.focus()
      else newItemRef.current?.focus()
    }, 50)
  }, [open, tab])

  function toggleOpen() {
    setOpen((o) => {
      const next = !o
      next ? playScratchOpen() : playScratchClose()
      try { localStorage.setItem(SCRATCH_OPEN_KEY, String(next)) } catch { /* noop */ }
      return next
    })
  }

  function switchTab(t: 'pad' | 'list') {
    setTab(t)
    try { localStorage.setItem(SCRATCH_TAB_KEY, t) } catch { /* noop */ }
  }

  function persistText(val: string) {
    if (userId) try { localStorage.setItem(scratchPadKey(userId), val) } catch { /* noop */ }
    if (!userId) return
    setSyncStatus('syncing')
    if (saveTextTimer.current) clearTimeout(saveTextTimer.current)
    saveTextTimer.current = setTimeout(async () => {
      await upsertScratchPad(userId, { notes: val })
      setSyncStatus('synced')
    }, 800)
  }

  function persistItems(next: CheckItem[]) {
    if (userId) try { localStorage.setItem(scratchListKey(userId), JSON.stringify(next)) } catch { /* noop */ }
    if (!userId) return
    setSyncStatus('syncing')
    if (saveListTimer.current) clearTimeout(saveListTimer.current)
    saveListTimer.current = setTimeout(async () => {
      await upsertScratchPad(userId, { list: JSON.stringify(next) })
      setSyncStatus('synced')
    }, 800)
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value.slice(0, SCRATCH_PAD_LIMIT)
    setText(val)
    persistText(val)
  }

  function addItem() {
    const trimmed = newItem.trim()
    if (!trimmed) return
    const next = [...items, { id: crypto.randomUUID(), text: trimmed, done: false }]
    setItems(next); persistItems(next); setNewItem('')
  }

  function toggleItem(id: string) {
    playSelectClick()
    const next = items.map((it) => it.id === id ? { ...it, done: !it.done } : it)
    setItems(next); persistItems(next)
  }

  function deleteItem(id: string) {
    const next = items.filter((it) => it.id !== id)
    setItems(next); persistItems(next)
  }

  function clearDone() {
    const next = items.filter((it) => !it.done)
    setItems(next); persistItems(next)
  }

  function clearAll() {
    setItems([]); persistItems([])
  }

  function onItemDragHandlePointerDown(e: React.PointerEvent<HTMLSpanElement>, dragId: string) {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const listEl = (e.currentTarget as HTMLElement).closest('ul')
    if (!listEl) return

    function getIdAtY(y: number): string | null {
      const lis = Array.from(listEl!.querySelectorAll<HTMLElement>('li[data-id]'))
      for (const li of lis) {
        const rect = li.getBoundingClientRect()
        if (y < rect.top + rect.height / 2) return li.dataset.id ?? null
      }
      return null
    }

    function onMove(ev: PointerEvent) {
      setDragOverId(getIdAtY(ev.clientY) ?? '__end__')
    }
    function onUp(ev: PointerEvent) {
      const targetId = getIdAtY(ev.clientY)
      setDragOverId(null)
      setItems((prev) => {
        if (dragId === targetId) return prev
        const next = prev.filter((it) => it.id !== dragId)
        const dragged = prev.find((it) => it.id === dragId)!
        const insertIdx = targetId === null ? next.length : next.findIndex((it) => it.id === targetId)
        next.splice(insertIdx, 0, dragged)
        persistItems(next)
        return next
      })
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    isDragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const startY = e.clientY
    const startH = height

    function onMove(ev: PointerEvent) {
      const next = Math.min(SCRATCH_MAX_H, Math.max(SCRATCH_MIN_H, startH - (ev.clientY - startY)))
      setHeight(next)
    }
    function onUp(ev: PointerEvent) {
      isDragging.current = false
      const final = Math.min(SCRATCH_MAX_H, Math.max(SCRATCH_MIN_H, startH - (ev.clientY - startY)))
      try { localStorage.setItem(SCRATCH_HEIGHT_KEY, String(final)) } catch { /* noop */ }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const doneCount   = items.filter((it) => it.done).length
  const hasActivity = (!!text) || items.length > 0

  return (
    <div data-tutorial="journal" className="border-t border-border bg-bg shrink-0">
      {open && (
        <div
          onPointerDown={onHandlePointerDown}
          className="w-full flex items-center justify-center h-3 cursor-ns-resize hover:bg-surface/60 select-none group/handle"
          title="Drag to resize"
        >
          <span className="font-pixel text-[8px] text-muted/40 group-hover/handle:text-muted leading-none">⠿⠿⠿</span>
        </div>
      )}

      <button
        onClick={toggleOpen}
        className="w-full flex items-center gap-2 px-4 text-muted hover:text-primary transition-none group"
        style={open ? { paddingTop: '0.5rem', paddingBottom: '0.5rem' } : { height: 119 }}
        title={open ? 'Close journal' : 'Open journal'}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1.5" y="1.5" width="9" height="9" rx="0.5" />
          <line x1="3.5" y1="4" x2="8.5" y2="4" />
          <line x1="3.5" y1="6" x2="8.5" y2="6" />
          <line x1="3.5" y1="8" x2="6.5" y2="8" />
        </svg>
        <span className="font-pixel text-[10px] select-none">JOURNAL</span>
        {hasActivity && !open && (
          <span className="font-pixel text-[8px] text-secondary ml-1 select-none">●</span>
        )}
        <span className="ml-auto font-pixel text-[10px] select-none group-hover:text-primary">
          {open ? '▼' : '▲'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3 flex flex-col gap-2 overflow-hidden" style={{ height }}>
          <div className="flex items-center gap-0 border-b border-border shrink-0">
            {(['pad', 'list'] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`font-pixel text-[10px] px-3 py-1 border-b-2 -mb-px transition-none ${
                  tab === t ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-secondary'
                }`}
              >
                {t === 'pad' ? 'NOTES' : 'CHECKLIST'}
              </button>
            ))}
          </div>

          {tab === 'pad' && (
            <div className="flex flex-col gap-1.5 flex-1 min-h-0">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                placeholder="jot something down…"
                className="w-full flex-1 bg-surface border border-border text-primary font-terminal text-sm placeholder-muted outline-none focus:border-primary resize-none px-3 py-2 leading-relaxed min-h-0"
              />
              <div className="flex items-center justify-between shrink-0">
                <SyncBadge status={userId ? syncStatus : null} />
                {text && (
                  <button
                    onClick={() => { setText(''); persistText('') }}
                    className="font-pixel text-[9px] text-muted hover:text-warning transition-none"
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === 'list' && (
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={newItemRef}
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem()}
                  placeholder="add item…"
                  className="flex-1 bg-surface border border-border text-primary font-terminal text-sm placeholder-muted outline-none focus:border-primary px-2 py-1"
                />
                <button
                  onClick={addItem}
                  disabled={!newItem.trim()}
                  className="font-pixel text-[10px] px-2 py-1 border border-border text-muted hover:border-secondary hover:text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-none"
                >
                  + ADD
                </button>
              </div>

              {items.length > 0 && (
                <ul className="flex flex-col gap-0.5 overflow-y-auto flex-1 min-h-0">
                  {items.map((it) => (
                    <li
                      key={it.id}
                      data-id={it.id}
                      className={`flex items-center gap-2 group/item py-0.5 border-t-2 transition-none ${dragOverId === it.id ? 'border-secondary' : 'border-transparent'}`}
                    >
                      <span
                        onPointerDown={(e) => onItemDragHandlePointerDown(e, it.id)}
                        className="opacity-0 group-hover/item:opacity-40 hover:!opacity-100 font-pixel text-[9px] text-muted cursor-grab active:cursor-grabbing shrink-0 select-none"
                        title="Drag to reorder"
                      >
                        ⠿
                      </span>
                      <input
                        type="checkbox"
                        checked={it.done}
                        onChange={() => toggleItem(it.id)}
                        className="accent-secondary cursor-pointer shrink-0"
                      />
                      <span className={`font-terminal text-sm flex-1 leading-snug ${it.done ? 'line-through text-muted' : 'text-primary'}`}>
                        {it.text}
                      </span>
                      <button
                        onClick={() => deleteItem(it.id)}
                        className="opacity-0 group-hover/item:opacity-100 font-pixel text-[9px] text-muted hover:text-warning transition-none shrink-0"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center justify-between shrink-0">
                <span className="flex items-center gap-2">
                  <SyncBadge status={userId ? syncStatus : null} />
                  {items.length > 0 && <span className="font-pixel text-[9px] text-muted">{doneCount} / {items.length} done</span>}
                </span>
                <div className="flex items-center gap-3">
                  {doneCount > 0 && (
                    <button onClick={clearDone} className="font-pixel text-[9px] text-muted hover:text-warning transition-none">
                      CLEAR DONE
                    </button>
                  )}
                  {items.length > 0 && (
                    <button onClick={clearAll} className="font-pixel text-[9px] text-muted hover:text-warning transition-none">
                      CLEAR ALL
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
