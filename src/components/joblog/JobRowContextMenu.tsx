import { useEffect } from 'react'

interface JobRowContextMenuProps {
  x: number
  y: number
  jobId: string
  isPremium: boolean
  searching: boolean
  onFindContacts: () => void
  onClose: () => void
}

const btn = 'w-full text-left px-4 py-1.5 text-xs font-pixel text-primary hover:bg-surface transition-none disabled:opacity-40 disabled:cursor-not-allowed'

export default function JobRowContextMenu({ x, y, isPremium, searching, onFindContacts, onClose }: JobRowContextMenuProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 border border-border bg-bg py-1 min-w-[160px]"
        style={{ left: x, top: y }}
      >
        <button
          className={btn}
          disabled={!isPremium || searching}
          onClick={() => { onFindContacts(); onClose() }}
          title={!isPremium ? 'Premium feature' : undefined}
        >
          {searching ? 'Searching…' : !isPremium ? '🔒 Find Contacts' : 'Find Contacts'}
        </button>
      </div>
    </>
  )
}
