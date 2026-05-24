import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

type Screen = 'title' | 'login' | 'signup'
type AuthError = string | null

const SSO_PROVIDERS = ['GOOGLE', 'APPLE'] as const

// ── Success blip ──────────────────────────────────────────────────────────────
function playBlip() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.setValueAtTime(440, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.06)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)
  } catch { /* AudioContext blocked */ }
}

export default function AuthPage() {
  const navigate = useNavigate()

  const [screen,        setScreen]        = useState<Screen>('title')
  const [returningName, setReturningName] = useState<string | null>(null)
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [username,      setUsername]      = useState('')
  const [error,         setError]         = useState<AuthError>(null)
  const [loading,       setLoading]       = useState(false)
  const [muted,         setMuted]         = useState(true)

  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const name =
          (data.session.user.user_metadata?.['username'] as string | undefined) ??
          data.session.user.email?.split('@')[0] ??
          null
        setReturningName(name)
      }
    })
  }, [])

  // Sync muted state and volume to the audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted
      audioRef.current.volume = 0.4
    }
  }, [muted])


  function toggleMute() {
    const audio = audioRef.current
    if (!audio) return
    const nextMuted = !muted
    setMuted(nextMuted)
    if (!nextMuted) {
      audio.muted = false
      audio.play().catch(() => { /* blocked */ })
    } else {
      audio.muted = true
    }
  }

  function proceedFromTitle() {
    playBlip()
    setTimeout(() => {
      if (returningName) navigate('/')
      else setScreen('login')
    }, 80)
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (screen === 'title' && e.key === 'Enter') proceedFromTitle()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [screen, returningName],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    navigate('/')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    navigate('/')
  }

  // Render audio at the root so it persists across all screens
  const audioEl = <audio ref={audioRef} src="/theme.mp3" loop muted preload="auto" className="hidden" />

  if (screen === 'title') {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center font-pixel scanlines select-none">
        {audioEl}
        {/* Speaker toggle — top-right corner */}
        <button
          onClick={toggleMute}
          className="fixed top-4 right-4 text-muted hover:text-primary text-sm leading-none"
          title={muted ? 'Unmute theme' : 'Mute theme'}
        >
          {muted ? '🔇' : '🔊'}
        </button>

        <div className="mb-12 text-center">
          <p className="text-muted text-[10px] tracking-widest animate-pulse select-none mb-4">
            ♪ BEST WITH SOUND ON
          </p>
          <p className="text-primary text-2xl tracking-widest mb-3">FJOBHUNT</p>
          <p className="text-muted text-xs tracking-widest">GAMIFIED JOB SEARCH TRACKER</p>
        </div>

        {returningName ? (
          <div className="text-center">
            <p className="text-secondary text-xs mb-2">WELCOME BACK,</p>
            <p className="text-primary text-sm mb-10 tracking-widest">
              {returningName.toUpperCase()}
            </p>
            <p className="text-primary text-xs animate-blink">PRESS ENTER TO CONTINUE</p>
          </div>
        ) : (
          <p className="text-primary text-xs animate-blink">PRESS ENTER TO START</p>
        )}

        <button
          className="mt-16 text-muted text-xs hover:text-primary"
          onClick={proceedFromTitle}
        >
          [ or click here ]
        </button>
      </div>
    )
  }

  const isSignup = screen === 'signup'

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center font-pixel scanlines px-4">
      {audioEl}
      <div className="w-full max-w-sm">

        <button
          onClick={() => { playBlip(); setScreen('title') }}
          className="text-muted text-xs mb-8 hover:text-primary"
        >
          &lt; BACK
        </button>

        <h1 className="text-primary text-lg mb-2 tracking-widest">
          {isSignup ? 'CREATE ACCOUNT' : 'LOGIN'}
        </h1>
        <div className="border-b border-border mb-8" />

        <div className="flex flex-col gap-3 mb-8">
          {SSO_PROVIDERS.map((label) => (
            <button
              key={label}
              disabled
              className="w-full border border-border text-muted text-xs py-3 px-4 text-left opacity-40 cursor-not-allowed"
            >
              &gt; SIGN IN WITH {label} (COMING SOON)
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 border-t border-border" />
          <span className="text-muted text-xs">OR</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <form onSubmit={isSignup ? handleSignup : handleLogin} className="flex flex-col gap-4">
          {isSignup && (
            <Field
              label="USERNAME"
              type="text"
              value={username}
              onChange={setUsername}
              autoFocus
            />
          )}
          <Field
            label="EMAIL"
            type="email"
            value={email}
            onChange={setEmail}
            autoFocus={!isSignup}
          />
          <Field
            label="PASSWORD"
            type="password"
            value={password}
            onChange={setPassword}
          />

          {error && (
            <p className="text-red-500 text-xs leading-5">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-bg text-xs py-3 mt-2 hover:opacity-90 disabled:opacity-40"
          >
            {loading ? 'LOADING...' : isSignup ? 'CREATE ACCOUNT' : 'LOGIN'}
          </button>
        </form>

        <p className="text-muted text-xs mt-6 text-center">
          {isSignup ? 'ALREADY HAVE AN ACCOUNT? ' : 'NO ACCOUNT? '}
          <button
            className="text-secondary hover:text-primary"
            onClick={() => { setError(null); setScreen(isSignup ? 'login' : 'signup') }}
          >
            {isSignup ? 'LOGIN' : 'SIGN UP'}
          </button>
        </p>

      </div>
    </div>
  )
}

function Field({
  label, type, value, onChange, autoFocus = false,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-muted text-xs">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        required
        className="bg-surface border border-border text-primary text-xs px-3 py-3 outline-none w-full focus:border-primary caret-primary font-pixel"
      />
    </div>
  )
}
