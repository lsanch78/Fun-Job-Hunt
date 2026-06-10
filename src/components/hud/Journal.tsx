import { useState, useRef, useEffect } from 'react'
import { playSelectClick, playJournalOpen, playJournalClose } from '@/lib/sfx'
import { useJournal } from '@/hooks/hud/useJournal'
import type { CheckItem } from '@/types'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'

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

const JOURNAL_MIN_H = 120
const JOURNAL_MAX_H = 600
const JOURNAL_DEF_H = 220

// ── Journal ───────────────────────────────────────────────────────────────────

export default function Journal({ userId }: { userId: string | null }) {
  const [open,   setOpen]   = useState<boolean>(() => lsGet<boolean>(SK.journalOpen, false))
  const [height, setHeight] = useState<number>(() => lsGet<number>(SK.journalHeight, JOURNAL_DEF_H))
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const newItemRef  = useRef<HTMLInputElement>(null)

  const {
    tab, setTab,
    text,
    items,
    newItem, setNewItem,
    syncStatus,
    doneCount,
    hasActivity,
    handleTextChange,
    clearText,
    addItem,
    toggleItem,
    deleteItem,
    clearDone,
    clearAll,
    reorderItems,
  } = useJournal(userId)

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
      next ? playJournalOpen() : playJournalClose()
      lsSet(SK.journalOpen, next)
      return next
    })
  }

  function handleToggleItem(id: string) {
    playSelectClick()
    toggleItem(id)
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
      reorderItems(
        (() => {
          if (dragId === targetId) return items
          const next = items.filter((it: CheckItem) => it.id !== dragId)
          const dragged = items.find((it: CheckItem) => it.id === dragId)!
          const insertIdx = targetId === null ? next.length : next.findIndex((it: CheckItem) => it.id === targetId)
          next.splice(insertIdx, 0, dragged)
          return next
        })()
      )
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const startY = e.clientY
    const startH = height

    function onMove(ev: PointerEvent) {
      const next = Math.min(JOURNAL_MAX_H, Math.max(JOURNAL_MIN_H, startH - (ev.clientY - startY)))
      setHeight(next)
    }
    function onUp(ev: PointerEvent) {
      const final = Math.min(JOURNAL_MAX_H, Math.max(JOURNAL_MIN_H, startH - (ev.clientY - startY)))
      lsSet(SK.journalHeight, final)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

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
        style={open ? { paddingTop: '0.5rem', paddingBottom: '0.5rem' } : { height: 48 }}
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
                onClick={() => setTab(t)}
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
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="jot something down…"
                className="w-full flex-1 bg-surface border border-border text-primary font-terminal text-sm placeholder-muted outline-none focus:border-primary resize-none px-3 py-2 leading-relaxed min-h-0"
              />
              <div className="flex items-center justify-between shrink-0">
                <SyncBadge status={userId ? syncStatus : null} />
                {text && (
                  <button
                    onClick={clearText}
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
                  {items.map((it: CheckItem) => (
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
                        onChange={() => handleToggleItem(it.id)}
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
