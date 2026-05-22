import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { ResumeEditor } from './components/resume/ResumeEditor';
import { SearchProfilesScreen } from './components/search_profiles/SearchProfilesScreen';
import { SignInScreen } from './components/SignInScreen';

type Screen = 'resume' | 'search-profiles';

const NAV: { id: Screen; label: string }[] = [
  { id: 'resume', label: 'Resume' },
  { id: 'search-profiles', label: 'Search profiles' },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('search-profiles');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <p className="p-8 text-slate-500">Loading…</p>;

  if (!session) return <SignInScreen />;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-slate-200 px-4">
        <div className="max-w-3xl mx-auto flex items-center gap-1 h-12">
          <span className="font-bold text-slate-900 mr-4 text-sm">EffJobHunt</span>
          {NAV.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setScreen(id)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                screen === id
                  ? 'bg-blue-100 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400 mr-3">{session.user.email}</span>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Screen content */}
      {screen === 'resume' && <ResumeEditor session={session} />}
      {screen === 'search-profiles' && <SearchProfilesScreen session={session} />}
    </div>
  );
}
