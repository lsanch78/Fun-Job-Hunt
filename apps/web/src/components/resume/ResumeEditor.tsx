import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ResumeSchema,
  resumeToRawText,
  type Resume,
  type ContactInfo,
  type WorkExperience,
  type Education,
} from '@effjobhunt/shared';
import { supabase } from '../../lib/supabase';
import { ContactSection } from './ContactSection';
import { SummarySection } from './SummarySection';
import { ExperienceSection } from './ExperienceSection';
import { EducationSection } from './EducationSection';
import { SkillsSection } from './SkillsSection';

function emptyResume(): Partial<Resume> {
  return {
    contact: { name: '', email: '' },
    summary: '',
    experience: [],
    education: [],
    skills: [],
  };
}

type LoadState = 'loading' | 'ready' | 'error';

interface Props {
  session: Session;
}

export function ResumeEditor({ session }: Props) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resume, setResume] = useState<Partial<Resume>>(emptyResume());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    ReturnType<typeof ResumeSchema.safeParse> extends { success: false; error: infer E }
      ? import('zod').ZodFormattedError<Resume>
      : never
    | null
  >(null);

  // ── Load existing resume on mount ─────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('resume')
        .select('structured_json')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) {
        setLoadError(error.message);
        setLoadState('error');
        return;
      }
      if (data?.structured_json) {
        const parsed = ResumeSchema.safeParse(data.structured_json);
        if (parsed.success) {
          setResume(parsed.data);
        }
        // If parse fails (schema mismatch on old data) start with empty form
      }
      setLoadState('ready');
    }
    load();
  }, [session.user.id]);

  // ── Section change handlers ────────────────────────────────────────────────
  function setContact(contact: Partial<ContactInfo>) {
    setResume((r) => ({ ...r, contact: contact as ContactInfo }));
  }
  function setSummary(summary: string) {
    setResume((r) => ({ ...r, summary }));
  }
  function setExperience(experience: WorkExperience[]) {
    setResume((r) => ({ ...r, experience }));
  }
  function setEducation(education: Education[]) {
    setResume((r) => ({ ...r, education }));
  }
  function setSkills(skills: string[]) {
    setResume((r) => ({ ...r, skills }));
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setFieldErrors(null);

    const parsed = ResumeSchema.safeParse(resume);
    if (!parsed.success) {
      setFieldErrors(parsed.error.format() as never);
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('resume').upsert(
      {
        user_id: session.user.id,
        structured_json: parsed.data,
        raw_text: resumeToRawText(parsed.data),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      setSaveError(error.message);
    } else {
      setLastSaved(new Date());
    }
    setSaving(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading resume…</p>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-red-600 text-sm">Failed to load resume: {loadError}</p>
      </div>
    );
  }

  const contactErrors = fieldErrors?.contact;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <form
        onSubmit={handleSave}
        className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8"
      >
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Resume</h1>
          <span className="text-xs text-slate-400">{session.user.email}</span>
        </div>

        <div className="flex flex-col gap-8">
          <ContactSection
            contact={resume.contact ?? {}}
            onChange={setContact}
            errors={
              contactErrors && typeof contactErrors === 'object' && '_errors' in contactErrors
                ? undefined
                : (contactErrors as Partial<Record<keyof ContactInfo, string[]>>)
            }
          />

          <hr className="border-slate-100" />

          <SummarySection
            summary={resume.summary ?? ''}
            onChange={setSummary}
            error={fieldErrors?.summary?._errors[0]}
          />

          <hr className="border-slate-100" />

          <ExperienceSection
            experience={resume.experience ?? []}
            onChange={setExperience}
          />

          <hr className="border-slate-100" />

          <EducationSection
            education={resume.education ?? []}
            onChange={setEducation}
          />

          <hr className="border-slate-100" />

          <SkillsSection
            skills={resume.skills ?? []}
            onChange={setSkills}
          />
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {saveError && (
            <p className="text-sm text-red-600">Save failed: {saveError}</p>
          )}
          {lastSaved && !saveError && (
            <p className="text-sm text-green-600">
              Saved at {lastSaved.toLocaleTimeString()}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save resume'}
          </button>
        </div>
      </form>
    </div>
  );
}
