import { useRef, useEffect } from 'react'
import { useScratchPad } from '@/hooks/hud/useScratchPad'
import type { CheckItem } from '@/types'

type SyncStatus = 'synced' | 'syncing'

function SyncBadge({ status }: { status: SyncStatus | null }) {
  if (!status) return null
  return (
    <span className={`font-pixel text-[8px] tracking-widest ${status === 'syncing' ? 'text-muted animate-pulse' : 'text-dim'}`}>
      {status === 'syncing' ? 'SYNCING…' : 'SYNCED'}
    </span>
  )
}

export default function MobileScratchPad({
  userId,
  onClose,
}: {
  userId: string | null
  onClose: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const newItemRef  = useRef<HTMLInputElement>(null)

  const {
    tab, setTab,
    text,
    items,
    newItem, setNewItem,
    syncStatus,
    doneCount,
    handleTextChange,
    clearText,
    addItem,
    toggleItem,
    deleteItem,
    clearDone,
  } = useScratchPad(userId)

  useEffect(() => {
    const id = setTimeout(() => {
      if (tab === 'pad') textareaRef.current?.focus()
      else newItemRef.current?.focus()
    }, 50)
    return () => clearTimeout(id)
  }, [tab])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const tabBtn = (t: 'pad' | 'list') =>
    `font-pixel text-[10px] px-4 py-2 border-b-2 -mb-px transition-none ${
      tab === t ? 'border-primary text-primary' : 'border-transparent text-muted'
    }`

  return (
    <div className="fixed inset-0 z-[190] bg-bg flex flex-col font-pixel">
      {/* Header */}
      <div className="flex items-center border-b border-border shrink-0">
        <button onClick={() => setTab('pad')} className={tabBtn('pad')}>NOTES</button>
        <button onClick={() => setTab('list')} className={tabBtn('list')}>CHECKLIST</button>
        <button
          onClick={onClose}
          className="ml-auto w-12 h-10 flex items-center justify-center text-muted hover:text-primary font-pixel text-xs"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Notes tab */}
      {tab === 'pad' && (
        <div className="flex flex-col flex-1 min-h-0 px-4 py-3 gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="jot something down…"
            className="w-full flex-1 bg-surface border border-border text-primary font-terminal text-base placeholder-muted outline-none focus:border-primary resize-none px-3 py-2 leading-relaxed min-h-0"
            style={{ fontSize: '16px' }}
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

      {/* Checklist tab */}
      {tab === 'list' && (
        <div className="flex flex-col flex-1 min-h-0 px-4 py-3 gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={newItemRef}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder="add item…"
              className="flex-1 bg-surface border border-border text-primary font-terminal placeholder-muted outline-none focus:border-primary px-3 py-2"
              style={{ fontSize: '16px' }}
            />
            <button
              onClick={addItem}
              disabled={!newItem.trim()}
              className="font-pixel text-[10px] px-3 py-2 border border-border text-muted hover:border-secondary hover:text-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-none"
            >
              + ADD
            </button>
          </div>

          <ul className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
            {items.map((it: CheckItem) => (
              <li key={it.id} className="flex items-center gap-3 py-2 border-b border-border">
                <input
                  type="checkbox"
                  checked={it.done}
                  onChange={() => toggleItem(it.id)}
                  className="accent-secondary cursor-pointer shrink-0 w-4 h-4"
                />
                <span className={`font-terminal flex-1 leading-snug ${it.done ? 'line-through text-muted' : 'text-primary'}`} style={{ fontSize: '16px' }}>
                  {it.text}
                </span>
                <button
                  onClick={() => deleteItem(it.id)}
                  className="font-pixel text-[10px] text-muted hover:text-warning transition-none shrink-0 px-1"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between shrink-0">
            <span className="flex items-center gap-3">
              <SyncBadge status={userId ? syncStatus : null} />
              {items.length > 0 && (
                <span className="font-pixel text-[9px] text-muted">{doneCount} / {items.length} done</span>
              )}
            </span>
            {doneCount > 0 && (
              <button onClick={clearDone} className="font-pixel text-[9px] text-muted hover:text-warning transition-none">
                CLEAR DONE
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
