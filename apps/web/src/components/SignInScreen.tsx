import { useState } from 'react';
import { supabase } from '../lib/supabase';

type State = 'idle' | 'sending' | 'sent' | 'error';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });

    if (error) {
      setError(error.message);
      setState('error');
    } else {
      setState('sent');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">EffJobHunt</h1>
        <p className="text-sm text-slate-500 mb-7">Sign in to continue.</p>

        {state === 'sent' ? (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-800">
            <p className="font-semibold mb-1">Check your email</p>
            <p>
              We sent a sign-in link to <span className="font-medium">{email}</span>. Click it to
              continue — no password needed.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={state === 'sending'}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {state === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
