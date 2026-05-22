import { useState } from 'react';
import {
  SearchProfileWriteSchema,
  SOURCES,
  type SearchProfile,
  type SearchProfileWrite,
} from '@effjobhunt/shared/search_profile';
import { FormField } from '../resume/FormField';
import { TagInput } from './TagInput';

interface Props {
  initial?: SearchProfile;
  onSave: (data: SearchProfileWrite) => Promise<void>;
  onCancel: () => void;
}

function defaultDraft(): SearchProfileWrite {
  return {
    name: '',
    job_titles: [],
    keywords: [],
    locations: [],
    sources: ['linkedin', 'handshake'],
    active: true,
    min_match_score: 50,
  };
}

function profileToDraft(p: SearchProfile): SearchProfileWrite {
  return {
    name: p.name,
    job_titles: p.job_titles,
    keywords: p.keywords,
    locations: p.locations,
    sources: p.sources,
    active: p.active,
    min_match_score: p.min_match_score,
  };
}

export function ProfileForm({ initial, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<SearchProfileWrite>(
    initial ? profileToDraft(initial) : defaultDraft()
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof SearchProfileWrite, string>>>({});

  function set<K extends keyof SearchProfileWrite>(key: K, value: SearchProfileWrite[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function toggleSource(src: (typeof SOURCES)[number]) {
    const current = draft.sources;
    if (current.includes(src)) {
      set('sources', current.filter((s) => s !== src) as typeof current);
    } else {
      set('sources', [...current, src] as typeof current);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = SearchProfileWriteSchema.safeParse(draft);

    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof SearchProfileWrite, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof SearchProfileWrite;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      await onSave(parsed.data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-lg flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {initial ? 'Edit profile' : 'New search profile'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Name */}
        <FormField id="sp-name" label="Profile name" error={errors.name}>
          <input
            id="sp-name"
            type="text"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Senior Frontend Engineer"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </FormField>

        {/* Job titles */}
        <FormField
          id="sp-job-titles"
          label="Target job titles"
          error={errors.job_titles as string | undefined}
        >
          <TagInput
            id="sp-job-titles"
            values={draft.job_titles}
            onChange={(v) => set('job_titles', v)}
            placeholder="Type a title and press Enter…"
          />
          <p className="text-xs text-slate-400">Press Enter or comma to add</p>
        </FormField>

        {/* Keywords */}
        <FormField
          id="sp-keywords"
          label="Keywords"
          error={errors.keywords as string | undefined}
        >
          <TagInput
            id="sp-keywords"
            values={draft.keywords}
            onChange={(v) => set('keywords', v)}
            placeholder="TypeScript, React, Node.js…"
          />
          <p className="text-xs text-slate-400">
            Used to compute the match score against job postings
          </p>
        </FormField>

        {/* Locations */}
        <fieldset>
          <legend className="text-sm font-medium text-slate-700 mb-2">
            Locations <span className="text-slate-400 font-normal">(optional)</span>
          </legend>

          {/* Remote quick-toggle */}
          <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={draft.locations.includes('Remote')}
              onChange={(e) => {
                if (e.target.checked) {
                  set('locations', ['Remote', ...draft.locations.filter((l) => l !== 'Remote')]);
                } else {
                  set('locations', draft.locations.filter((l) => l !== 'Remote'));
                }
              }}
              className="w-4 h-4 accent-blue-600"
            />
            <span className="font-medium">Remote</span>
          </label>

          <TagInput
            id="sp-locations"
            values={draft.locations.filter((l) => l !== 'Remote')}
            onChange={(v) => {
              const hasRemote = draft.locations.includes('Remote');
              set('locations', hasRemote ? ['Remote', ...v] : v);
            }}
            placeholder="San Francisco, CA…"
          />
          <p className="text-xs text-slate-400 mt-1">
            Press Enter or comma to add a city. Leave empty to search all locations.
          </p>
        </fieldset>

        {/* Sources */}
        <fieldset>
          <legend className="text-sm font-medium text-slate-700 mb-2">Sources</legend>
          {errors.sources && (
            <p className="text-xs text-red-600 mb-1">{errors.sources}</p>
          )}
          <div className="flex gap-4">
            {SOURCES.map((src) => (
              <label key={src} className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.sources.includes(src)}
                  onChange={() => toggleSource(src)}
                  className="w-4 h-4 accent-blue-600"
                />
                {src.charAt(0).toUpperCase() + src.slice(1)}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Threshold */}
        <FormField
          id="sp-threshold"
          label={`Match score threshold: ${draft.min_match_score}%`}
          error={errors.min_match_score as string | undefined}
        >
          <input
            id="sp-threshold"
            type="range"
            min={0}
            max={100}
            step={5}
            value={draft.min_match_score}
            onChange={(e) => set('min_match_score', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>0% (show all)</span>
            <span>100% (exact match only)</span>
          </div>
        </FormField>

        {/* Active toggle */}
        <label className="flex items-center gap-3 text-sm text-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => set('active', e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <span>
            <span className="font-medium">Active</span>
            <span className="text-slate-500"> — scraper polls this profile</span>
          </span>
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200 hover:border-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
