const INPUT =
  'flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

interface Props {
  skills: string[];
  onChange: (updated: string[]) => void;
}

export function SkillsSection({ skills, onChange }: Props) {
  function update(idx: number, value: string) {
    onChange(skills.map((s, i) => (i === idx ? value : s)));
  }
  function remove(idx: number) {
    onChange(skills.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...skills, '']);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Skills</h2>
      <div className="flex flex-col gap-2">
        {skills.map((skill, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              className={INPUT}
              value={skill}
              onChange={(e) => update(idx, e.target.value)}
              maxLength={60}
              placeholder="e.g. TypeScript"
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-sm text-red-400 hover:text-red-600 px-1"
              aria-label="Remove skill"
            >
              ✕
            </button>
          </div>
        ))}
        {skills.length < 60 && (
          <button
            type="button"
            onClick={add}
            className="self-start text-sm text-blue-600 hover:text-blue-800 font-medium mt-1"
          >
            + Add skill
          </button>
        )}
      </div>
    </section>
  );
}
