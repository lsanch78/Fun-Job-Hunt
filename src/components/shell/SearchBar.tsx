interface SearchBarProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}

export default function SearchBar({ value, onChange, placeholder = 'search…', className = '' }: SearchBarProps) {
  return (
    <div className={`flex items-center gap-1.5 min-w-[160px] ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent outline-none border-b border-border focus:border-primary text-xs text-primary placeholder-muted font-pixel py-0.5 w-full"
      />
      {value && (
        <button
          tabIndex={-1}
          onClick={() => onChange('')}
          className="text-muted hover:text-primary text-[10px] leading-none"
        >
          ✕
        </button>
      )}
    </div>
  )
}
