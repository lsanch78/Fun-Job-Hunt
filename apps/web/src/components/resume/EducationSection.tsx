import type { Education } from '@effjobhunt/shared';
import { FormField } from './FormField';

const INPUT =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

function emptyEntry(): Education {
  return { institution: '' };
}

interface Props {
  education: Education[];
  onChange: (updated: Education[]) => void;
}

export function EducationSection({ education, onChange }: Props) {
  function update(idx: number, updated: Education) {
    onChange(education.map((e, i) => (i === idx ? updated : e)));
  }
  function remove(idx: number) {
    onChange(education.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...education, emptyEntry()]);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Education</h2>
      <div className="flex flex-col gap-6">
        {education.map((entry, idx) => (
          <div
            key={idx}
            className="relative border border-slate-200 rounded-xl p-4"
          >
            <button
              type="button"
              onClick={() => remove(idx)}
              className="absolute top-3 right-3 text-sm text-red-400 hover:text-red-600"
              aria-label="Remove education entry"
            >
              ✕
            </button>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                id={`edu-institution-${idx}`}
                label="Institution *"
              >
                <input
                  id={`edu-institution-${idx}`}
                  type="text"
                  className={INPUT}
                  value={entry.institution}
                  onChange={(e) => update(idx, { ...entry, institution: e.target.value })}
                  maxLength={160}
                  required
                />
              </FormField>

              <FormField id={`edu-degree-${idx}`} label="Degree">
                <input
                  id={`edu-degree-${idx}`}
                  type="text"
                  className={INPUT}
                  value={entry.degree ?? ''}
                  onChange={(e) => update(idx, { ...entry, degree: e.target.value })}
                  maxLength={80}
                  placeholder="B.S., M.S., Ph.D. …"
                />
              </FormField>

              <FormField id={`edu-field-${idx}`} label="Field of study">
                <input
                  id={`edu-field-${idx}`}
                  type="text"
                  className={INPUT}
                  value={entry.field ?? ''}
                  onChange={(e) => update(idx, { ...entry, field: e.target.value })}
                  maxLength={120}
                />
              </FormField>

              <FormField id={`edu-year-${idx}`} label="Graduation year">
                <input
                  id={`edu-year-${idx}`}
                  type="number"
                  className={INPUT}
                  value={entry.graduationYear ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                    update(idx, { ...entry, graduationYear: val });
                  }}
                  min={1950}
                  max={2040}
                />
              </FormField>
            </div>
          </div>
        ))}
        {education.length < 10 && (
          <button
            type="button"
            onClick={add}
            className="self-start text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            + Add education
          </button>
        )}
      </div>
    </section>
  );
}
