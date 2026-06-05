interface Props {
  expanded: boolean
  onToggle: () => void
}

export default function MasterCodex({ expanded, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      className={`border px-3 py-1.5 text-[10px] tracking-widest transition-none ${
        expanded
          ? 'border-primary text-primary'
          : 'border-border text-muted hover:border-secondary hover:text-secondary'
      }`}
    >
      MASTER CODEX
    </button>
  )
}
