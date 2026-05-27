import { useState, useEffect, useRef } from 'react'
import { fetchScratchPad, upsertScratchPad, SCRATCH_PAD_LIMIT } from '@/services/scratchPadService'

const SCRATCH_PAD_KEY  = 'fjobhunt:scratchpad'
const SCRATCH_LIST_KEY = 'fjobhunt:scratchlist'
const SCRATCH_TAB_KEY  = 'fjobhunt:scratchtab'

interface CheckItem { id: string; text: string; done: boolean }

function readList(): CheckItem[] {
  try {
    const raw = localStorage.getItem(SCRATCH_LIST_KEY)
    return raw ? (JSON.parse(raw) as CheckItem[]) : []
  } catch { return [] }
}
function saveList(items: CheckItem[]) {
  try { localStorage.setItem(SCRATCH_LIST_KEY, JSON.stringify(items)) } catch { /* noop */ }
}

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
  const [tab, setTab] = useState<'pad' | 'list'>(() => {
    try { return (localStorage.getItem(SCRATCH_TAB_KEY) as 'pad' | 'list') ?? 'pad' } catch { return 'pad' }
  })
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(SCRATCH_PAD_KEY) ?? '' } catch { return '' }
  })
  const [items, setItems] = useState<CheckItem[]>(readList)
  const [newItem, setNewItem] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')

  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const newItemRef    = useRef<HTMLInputElement>(null)
  const saveTextTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveListTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hydrate from DB on mount
  useEffect(() => {
    if (!userId) return
    setSyncStatus('syncing')
    fetchScratchPad(userId).then((rec) => {
      if (rec) {
        if (rec.notes) {
          setText(rec.notes)
          try { localStorage.setItem(SCRATCH_PAD_KEY, rec.notes) } catch { /* noop */ }
        }
        if (rec.list) {
          try {
            const parsed = JSON.parse(rec.list) as CheckItem[]
            setItems(parsed)
            saveList(parsed)
          } catch { /* noop */ }
        }
      }
      setSyncStatus('synced')
    })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Focus active input when tab changes
  useEffect(() => {
    const id = setTimeout(() => {
      if (tab === 'pad') textareaRef.current?.focus()
      else newItemRef.current?.focus()
    }, 50)
    return () => clearTimeout(id)
  }, [tab])

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function switchTab(t: 'pad' | 'list') {
    setTab(t)
    try { localStorage.setItem(SCRATCH_TAB_KEY, t) } catch { /* noop */ }
  }

  function persistText(val: string) {
    try { localStorage.setItem(SCRATCH_PAD_KEY, val) } catch { /* noop */ }
    if (!userId) return
    setSyncStatus('syncing')
    if (saveTextTimer.current) clearTimeout(saveTextTimer.current)
    saveTextTimer.current = setTimeout(async () => {
      await upsertScratchPad(userId, { notes: val })
      setSyncStatus('synced')
    }, 800)
  }

  function persistItems(next: CheckItem[]) {
    saveList(next)
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

  const doneCount = items.filter((it) => it.done).length

  const tabBtn = (t: 'pad' | 'list') =>
    `font-pixel text-[10px] px-4 py-2 border-b-2 -mb-px transition-none ${
      tab === t ? 'border-primary text-primary' : 'border-transparent text-muted'
    }`

  return (
    <div className="fixed inset-0 z-[190] bg-bg flex flex-col font-pixel">
      {/* Header */}
      <div className="flex items-center border-b border-border shrink-0">
        <button onClick={() => switchTab('pad')} className={tabBtn('pad')}>NOTES</button>
        <button onClick={() => switchTab('list')} className={tabBtn('list')}>CHECKLIST</button>
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
            onChange={handleTextChange}
            placeholder="jot something down…"
            className="w-full flex-1 bg-surface border border-border text-primary font-terminal text-base placeholder-muted outline-none focus:border-primary resize-none px-3 py-2 leading-relaxed min-h-0"
            style={{ fontSize: '16px' }}
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

      {/* Checklist tab */}
      {tab === 'list' && (
        <div className="flex flex-col flex-1 min-h-0 px-4 py-3 gap-3">
          {/* Add input */}
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

          {/* List */}
          <ul className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
            {items.map((it) => (
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

          {/* Footer */}
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
