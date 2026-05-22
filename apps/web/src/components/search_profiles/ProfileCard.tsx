import type { SearchProfile } from '@effjobhunt/shared/search_profile';

interface Props {
  profile: SearchProfile;
  onEdit: (profile: SearchProfile) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}

export function ProfileCard({ profile, onEdit, onDelete, onToggle }: Props) {
  const sourceLabels: Record<string, string> = {
    linkedin: 'LinkedIn',
    handshake: 'Handshake',
  };

  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-3 transition-colors ${
        profile.active
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-slate-50 border-slate-200 opacity-60'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
              profile.active ? 'bg-green-500' : 'bg-slate-400'
            }`}
            aria-label={profile.active ? 'Active' : 'Inactive'}
          />
          <h3 className="font-semibold text-slate-900 truncate">{profile.name}</h3>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
              profile.active
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-200 text-slate-500'
            }`}
          >
            {profile.active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => onToggle(profile.id!, !profile.active)}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            {profile.active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            onClick={() => onEdit(profile)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(profile.id!)}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Detail rows */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {profile.locations.length > 0 && (
          <>
            <dt className="text-slate-500 font-medium">Locations</dt>
            <dd className="text-slate-800">{profile.locations.join(', ')}</dd>
          </>
        )}

        <dt className="text-slate-500 font-medium">Sources</dt>
        <dd className="text-slate-800">
          {profile.sources.map((s) => sourceLabels[s] ?? s).join(', ')}
        </dd>

        <dt className="text-slate-500 font-medium">Threshold</dt>
        <dd className="text-slate-800">{profile.min_match_score}% match score</dd>
      </dl>

      {/* Tags */}
      {profile.job_titles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-slate-500 font-medium self-center">Titles:</span>
          {profile.job_titles.map((t) => (
            <span
              key={t}
              className="text-xs bg-violet-100 text-violet-800 px-2 py-0.5 rounded-md font-medium"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {profile.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-slate-500 font-medium self-center">Keywords:</span>
          {profile.keywords.map((k) => (
            <span
              key={k}
              className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-medium"
            >
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
