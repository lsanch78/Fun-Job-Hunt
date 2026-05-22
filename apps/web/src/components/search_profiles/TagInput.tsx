import { useState, type KeyboardEvent } from 'react';

interface TagInputProps {
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

/**
 * Comma- or Enter-delimited tag input. Renders existing tags as dismissable
 * chips and lets the user type to add more.
 */
export function TagInput({ id, values, onChange, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState('');

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraft('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  function remove(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-slate-300 rounded-lg bg-white min-h-[42px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
      {values.map((v, i) => (
        <span
          key={i}
          className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-md"
        >
          {v}
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-blue-500 hover:text-blue-800 leading-none"
            aria-label={`Remove ${v}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={values.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
      />
    </div>
  );
}
