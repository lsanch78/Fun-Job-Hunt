import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { SearchProfile, SearchProfileWrite } from '@effjobhunt/shared/search_profile';
import { supabase } from '../../lib/supabase';
import { ProfileCard } from './ProfileCard';
import { ProfileForm } from './ProfileForm';

type LoadState = 'loading' | 'ready' | 'error';

interface Props {
  session: Session;
}

export function SearchProfilesScreen({ session: _session }: Props) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [formTarget, setFormTarget] = useState<SearchProfile | null | 'new'>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('search_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setLoadError(error.message);
        setLoadState('error');
        return;
      }
      setProfiles((data ?? []) as SearchProfile[]);
      setLoadState('ready');
    }
    load();
  }, []);

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate(data: SearchProfileWrite) {
    setActionError(null);
    const { data: created, error } = await supabase
      .from('search_profiles')
      .insert(data)
      .select()
      .single();

    if (error) {
      setActionError(error.message);
      throw error;
    }
    setProfiles((prev) => [created as SearchProfile, ...prev]);
    setFormTarget(null);
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async function handleUpdate(id: string, data: SearchProfileWrite) {
    setActionError(null);
    const { data: updated, error } = await supabase
      .from('search_profiles')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      setActionError(error.message);
      throw error;
    }
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? (updated as SearchProfile) : p))
    );
    setFormTarget(null);
  }

  // ── Toggle active ─────────────────────────────────────────────────────────
  async function handleToggle(id: string, active: boolean) {
    setActionError(null);
    const { error } = await supabase
      .from('search_profiles')
      .update({ active })
      .eq('id', id);

    if (error) {
      setActionError(error.message);
      return;
    }
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, active } : p)));
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Delete this profile? This cannot be undone.')) return;
    setActionError(null);
    const { error } = await supabase.from('search_profiles').delete().eq('id', id);

    if (error) {
      setActionError(error.message);
      return;
    }
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  }

  // ── Banner: no active profiles ────────────────────────────────────────────
  const hasActiveProfile = profiles.some((p) => p.active);
  const showNoActiveWarning = loadState === 'ready' && !hasActiveProfile;

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadState === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-500 text-sm">Loading search profiles…</p>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-red-600 text-sm">Failed to load profiles: {loadError}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Search profiles</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tell the scraper what to hunt for. Multiple profiles can run simultaneously.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormTarget('new')}
          className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
        >
          + New profile
        </button>
      </div>

      {/* No active profile warning */}
      {showNoActiveWarning && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Scraper is idle.</strong> At least one active profile is required for the
          scraper to run. Activate a profile or create a new one.
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Profile list */}
      {profiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center gap-3 py-14 text-center">
          <p className="text-slate-500 text-sm">No search profiles yet.</p>
          <button
            type="button"
            onClick={() => setFormTarget('new')}
            className="text-blue-600 text-sm underline hover:text-blue-800"
          >
            Create your first profile
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Active profiles first, then inactive */}
          {[...profiles]
            .sort((a, b) => Number(b.active) - Number(a.active))
            .map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onEdit={setFormTarget}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {formTarget !== null && (
        <ProfileForm
          initial={formTarget === 'new' ? undefined : formTarget}
          onSave={(data) =>
            formTarget === 'new'
              ? handleCreate(data)
              : handleUpdate(formTarget.id!, data)
          }
          onCancel={() => setFormTarget(null)}
        />
      )}
    </div>
  );
}
