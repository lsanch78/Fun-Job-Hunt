import type { WorkExperience } from '@effjobhunt/shared';
import { RESUME_BULLET_MAX } from '@effjobhunt/shared';
import { FormField } from './FormField';
import { CharCount } from './CharCount';

const INPUT =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const TEXTAREA = `${INPUT} resize-y min-h-[60px]`;

function emptyRole(): WorkExperience {
  return { company: '', title: '', startDate: '', bullets: [] };
}

interface Props {
  experience: WorkExperience[];
  onChange: (updated: WorkExperience[]) => void;
}

export function ExperienceSection({ experience, onChange }: Props) {
  function updateRole(idx: number, updated: WorkExperience) {
    onChange(experience.map((r, i) => (i === idx ? updated : r)));
  }
  function removeRole(idx: number) {
    onChange(experience.filter((_, i) => i !== idx));
  }
  function addRole() {
    onChange([...experience, emptyRole()]);
  }

  function updateBullet(roleIdx: number, bulletIdx: number, value: string) {
    const role = experience[roleIdx];
    if (!role) return;
    const bullets = role.bullets.map((b, i) => (i === bulletIdx ? value : b));
    updateRole(roleIdx, { ...role, bullets });
  }
  function removeBullet(roleIdx: number, bulletIdx: number) {
    const role = experience[roleIdx];
    if (!role) return;
    updateRole(roleIdx, {
      ...role,
      bullets: role.bullets.filter((_, i) => i !== bulletIdx),
    });
  }
  function addBullet(roleIdx: number) {
    const role = experience[roleIdx];
    if (!role) return;
    updateRole(roleIdx, { ...role, bullets: [...role.bullets, ''] });
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Work Experience</h2>
      <div className="flex flex-col gap-6">
        {experience.map((role, idx) => (
          <div
            key={idx}
            className="relative border border-slate-200 rounded-xl p-4"
          >
            <button
              type="button"
              onClick={() => removeRole(idx)}
              className="absolute top-3 right-3 text-sm text-red-400 hover:text-red-600"
              aria-label="Remove role"
            >
              ✕
            </button>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-4">
              <FormField id={`exp-company-${idx}`} label="Company *">
                <input
                  id={`exp-company-${idx}`}
                  type="text"
                  className={INPUT}
                  value={role.company}
                  onChange={(e) => updateRole(idx, { ...role, company: e.target.value })}
                  maxLength={120}
                  required
                />
              </FormField>

              <FormField id={`exp-title-${idx}`} label="Title *">
                <input
                  id={`exp-title-${idx}`}
                  type="text"
                  className={INPUT}
                  value={role.title}
                  onChange={(e) => updateRole(idx, { ...role, title: e.target.value })}
                  maxLength={120}
                  required
                />
              </FormField>

              <FormField id={`exp-start-${idx}`} label="Start date">
                <input
                  id={`exp-start-${idx}`}
                  type="text"
                  className={INPUT}
                  value={role.startDate}
                  onChange={(e) => updateRole(idx, { ...role, startDate: e.target.value })}
                  maxLength={20}
                  placeholder="Jan 2022"
                />
              </FormField>

              <FormField id={`exp-end-${idx}`} label="End date">
                <input
                  id={`exp-end-${idx}`}
                  type="text"
                  className={INPUT}
                  value={role.endDate ?? ''}
                  onChange={(e) =>
                    updateRole(idx, { ...role, endDate: e.target.value || undefined })
                  }
                  maxLength={20}
                  placeholder="Dec 2024 (blank = Present)"
                />
              </FormField>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-slate-700">Bullet points</p>
              {role.bullets.map((bullet, bIdx) => (
                <div key={bIdx} className="flex flex-col gap-1">
                  <div className="flex items-start gap-2">
                    <textarea
                      className={TEXTAREA}
                      value={bullet}
                      onChange={(e) => updateBullet(idx, bIdx, e.target.value)}
                      maxLength={RESUME_BULLET_MAX}
                      placeholder="Describe an accomplishment or responsibility…"
                    />
                    <button
                      type="button"
                      onClick={() => removeBullet(idx, bIdx)}
                      className="mt-2 text-sm text-red-400 hover:text-red-600 shrink-0"
                      aria-label="Remove bullet"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <CharCount value={bullet} max={RESUME_BULLET_MAX} />
                  </div>
                </div>
              ))}
              {role.bullets.length < 10 && (
                <button
                  type="button"
                  onClick={() => addBullet(idx)}
                  className="self-start text-sm text-blue-600 hover:text-blue-800 font-medium mt-1"
                >
                  + Add bullet
                </button>
              )}
            </div>
          </div>
        ))}
        {experience.length < 20 && (
          <button
            type="button"
            onClick={addRole}
            className="self-start text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            + Add role
          </button>
        )}
      </div>
    </section>
  );
}
