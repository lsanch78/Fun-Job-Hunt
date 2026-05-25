import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

type Screen = 'title' | 'email' | 'otp'
type AuthError = string | null

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
  const [otp,           setOtp]           = useState('')
  const [error,         setError]         = useState<AuthError>(null)
  const [loading,       setLoading]       = useState(false)

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

  function proceedFromTitle() {
    playBlip()
    setTimeout(() => {
      if (returningName) navigate('/')
      else setScreen('email')
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

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setScreen('otp')
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    navigate('/')
  }

  async function handleOAuth(provider: 'github' | 'google') {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider })
    if (error) setError(error.message)
  }

  // ── Title screen ─────────────────────────────────────────────────────────────
  if (screen === 'title') {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center font-pixel scanlines select-none">
        <div className="mb-12 text-center">
          <p className="text-primary text-2xl tracking-widest mb-3">FJOBHUNT</p>
          <p className="text-muted text-xs tracking-widest">GAMIFIED JOB SEARCH TRACKER</p>
        </div>

        {returningName ? (
          <button className="text-center" onClick={proceedFromTitle}>
            <p className="text-secondary text-xs mb-2">WELCOME BACK,</p>
            <p className="text-primary text-sm mb-10 tracking-widest">
              {returningName.toUpperCase()}
            </p>
            <p className="text-primary text-xs animate-blink">PRESS ENTER TO CONTINUE</p>
          </button>
        ) : (
          <button className="text-primary text-xs animate-blink" onClick={proceedFromTitle}>
            PRESS ENTER TO START
          </button>
        )}
      </div>
    )
  }

  // ── OTP verify screen ────────────────────────────────────────────────────────
  if (screen === 'otp') {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center font-pixel scanlines px-4">
        <div className="w-full max-w-sm">
          <button
            onClick={() => { playBlip(); setScreen('email'); setOtp(''); setError(null) }}
            className="text-muted text-xs mb-8 hover:text-primary"
          >
            &lt; BACK
          </button>

          <h1 className="text-primary text-lg mb-2 tracking-widest">CHECK YOUR EMAIL</h1>
          <div className="border-b border-border mb-6" />

          <p className="text-muted text-xs mb-8 leading-5">
            CODE SENT TO <span className="text-primary">{email.toUpperCase()}</span>
          </p>

          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <Field
              label="ENTER CODE"
              type="text"
              value={otp}
              onChange={setOtp}
              autoFocus
            />

            {error && <p className="text-red-500 text-xs leading-5">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-bg text-xs py-3 mt-2 hover:opacity-90 disabled:opacity-40"
            >
              {loading ? 'VERIFYING...' : 'VERIFY CODE'}
            </button>
          </form>

          <p className="text-muted text-xs mt-6 text-center">
            DIDN&apos;T GET IT?{' '}
            <button
              className="text-secondary hover:text-primary"
              onClick={() => { setOtp(''); setError(null); setScreen('email') }}
            >
              RESEND
            </button>
          </p>
        </div>
      </div>
    )
  }

  // ── Email screen ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center font-pixel scanlines px-4">
      <div className="w-full max-w-sm">

        <button
          onClick={() => { playBlip(); setScreen('title') }}
          className="text-muted text-xs mb-8 hover:text-primary"
        >
          &lt; BACK
        </button>

        <h1 className="text-primary text-lg mb-2 tracking-widest">SIGN IN</h1>
        <div className="border-b border-border mb-8" />

        {/* OAuth */}
        <div className="flex flex-col gap-3 mb-8">
          <button
            onClick={() => handleOAuth('google')}
            className="w-full border border-border text-muted text-xs py-3 px-4 text-left hover:border-primary hover:text-primary transition-colors"
          >
            &gt; SIGN IN WITH GOOGLE
          </button>
          <button
            onClick={() => handleOAuth('github')}
            className="w-full border border-border text-muted text-xs py-3 px-4 text-left hover:border-primary hover:text-primary transition-colors"
          >
            &gt; SIGN IN WITH GITHUB
          </button>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 border-t border-border" />
          <span className="text-muted text-xs">OR</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* OTP email */}
        <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
          <Field
            label="EMAIL"
            type="email"
            value={email}
            onChange={setEmail}
            autoFocus
          />

          {error && <p className="text-red-500 text-xs leading-5">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-bg text-xs py-3 mt-2 hover:opacity-90 disabled:opacity-40"
          >
            {loading ? 'SENDING...' : 'SEND CODE'}
          </button>
        </form>

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
