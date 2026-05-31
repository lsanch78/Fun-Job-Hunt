import { useEffect, useState, useCallback, useRef } from 'react'
import introMp3 from '@/assets/music/1-intro.mp3'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { type GlobalStats, startStatsPoll } from '@/services/globalStatsService'
import { startTerminalHum, playAuthBlip as playBlip } from '@/lib/sfx'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'

type Screen = 'title' | 'email' | 'code'
type AuthError = string | null

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          prompt: () => void
          cancel: () => void
        }
      }
    }
  }
}

async function generateNonce(): Promise<[string, string]> {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  const encoded = new TextEncoder().encode(nonce)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashedNonce = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return [nonce, hashedNonce]
}

export default function AuthPage() {
  const navigate = useNavigate()

  const [screen,        setScreen]        = useState<Screen>('title')
  const [returningName, setReturningName] = useState<string | null>(null)
  const [email,         setEmail]         = useState('')
  const [stayLoggedIn,  setStayLoggedIn]  = useState(true)
  const [otp,           setOtp]           = useState('')
  const [error,         setError]         = useState<AuthError>(null)
  const [loading,       setLoading]       = useState(false)
  const [globalStats,   setGlobalStats]   = useState<GlobalStats | null>(null)
  const [soundOn,       setSoundOn]       = useState(() => lsGet<number>(SK.authSound, 0) === 1)
  const stopHumRef  = useRef<(() => void) | null>(null)
  const introRef    = useRef<HTMLAudioElement | null>(null)
  const nonceRef    = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const name =
          (data.session.user.user_metadata?.['username'] as string | undefined) ??
          null
        setReturningName(name)
      }
    })
  }, [])

  // Start stats polling — refreshes every 5 min, serves cache in between
  useEffect(() => {
    const stop = startStatsPoll(setGlobalStats)
    return stop
  }, [])

  // Stop hum + intro on unmount
  useEffect(() => {
    return () => {
      stopHumRef.current?.()
      if (introRef.current) { introRef.current.pause(); introRef.current.src = '' }
      window.google?.accounts.id.cancel()
    }
  }, [])

  // Load Google GSI script and initialize One Tap when on the email screen
  useEffect(() => {
    if (screen !== 'email') return

    const clientId = import.meta.env['VITE_GOOGLE_CLIENT_ID'] as string | undefined
    if (!clientId) return

    async function initOneTap() {
      const [nonce, hashedNonce] = await generateNonce()
      nonceRef.current = nonce

      const scriptId = 'gsi-script'
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script')
        script.id = scriptId
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        script.onload = () => setupOneTap(hashedNonce)
        document.head.appendChild(script)
      } else {
        setupOneTap(hashedNonce)
      }
    }

    function setupOneTap(hashedNonce: string) {
      window.google?.accounts.id.initialize({
        client_id: import.meta.env['VITE_GOOGLE_CLIENT_ID'],
        callback: handleOneTapResponse,
        nonce: hashedNonce,
        use_fedcm_for_prompt: true,
      })
      window.google?.accounts.id.prompt()
    }

    initOneTap()
  }, [screen]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleOneTapResponse(response: { credential: string }) {
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.credential,
      nonce: nonceRef.current ?? undefined,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    navigate('/jobs')
  }

  function toggleSound() {
    if (soundOn) {
      stopHumRef.current?.()
      stopHumRef.current = null
      if (introRef.current) { introRef.current.pause(); introRef.current.src = ''; introRef.current = null }
      setSoundOn(false)
      lsSet(SK.authSound, 0)
    } else {
      stopHumRef.current = startTerminalHum()
      const audio = new Audio(introMp3)
      audio.volume = 0.8
      audio.play().catch(() => {})
      introRef.current = audio
      setSoundOn(true)
      lsSet(SK.authSound, 1)
    }
  }

  function proceedFromTitle() {
    if (soundOn && !stopHumRef.current) {
      stopHumRef.current = startTerminalHum()
    }
    playBlip()
    setTimeout(() => {
      if (returningName) navigate('/jobs')
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
      options: {
        shouldCreateUser: true,
        data: { stayLoggedIn },
      },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setScreen('code')
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
    if (error) { setLoading(false); setError(error.message); return }
    // Refresh session so the JWT reflects metadata set by the DB trigger on insert
    await supabase.auth.refreshSession()
    setLoading(false)
    navigate('/jobs')
  }

  // Fallback: full-page redirect for browsers where One Tap is blocked
  async function handleOAuthRedirect() {
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  // ── Title screen ─────────────────────────────────────────────────────────────
  if (screen === 'title') {
    const fmt = (n: number | null | undefined, fallback = '—') =>
      n == null ? fallback : n.toLocaleString()

    const marqueeItems = globalStats
      ? [
          `HUNTERS ONLINE: ${fmt(globalStats.hunters)}`,
          `TOTAL JOBS FOUND: ${fmt(globalStats.employed)}`,
          `TOTAL INTERVIEWS: ${fmt(globalStats.interviews)}`,
          `AVG INTERVIEW RATE: ${globalStats.avg_interview_rate == null ? '—' : `${globalStats.avg_interview_rate}%`}`,
          `AVG DAYS TO OFFER: ${fmt(globalStats.avg_days_to_offer)}`,
          `TOTAL APPLICATIONS SUBMITTED: ${fmt(globalStats.total_apps)}`,
        ]
      : ['LOADING STATS...']

    const ticker = [...marqueeItems, ...marqueeItems].join('   ·   ')

    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center font-pixel scanlines select-none relative">

        {/* Main content */}
        <div className="mb-12 text-center">
          <button
            onClick={toggleSound}
            className="mb-6 flex items-center gap-2 mx-auto text-muted hover:opacity-70"
            style={{ fontSize: '8px', letterSpacing: '0.15em' }}
          >
            <span>♪</span>
            <span>[{soundOn ? 'SOUND ON' : 'BEST EXPERIENCED WITH SOUND ON'}]</span>
            <span>♪</span>
          </button>
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

        {/* Mobile disclaimer */}
        <p className="sm:hidden absolute bottom-8 left-0 right-0 text-center text-muted font-pixel tracking-widest" style={{ fontSize: '8px' }}>
          [ BEST EXPERIENCED ON DESKTOP ]
        </p>

        {/* Stats ticker — absolutely positioned at top third */}
        <div
          className="absolute left-0 right-0 overflow-hidden py-2 bg-bg"
          style={{
            top: '20vh',
            boxShadow: '0 0 8px 1px rgba(57,255,20,0.35), 0 0 28px 4px rgba(57,255,20,0.15)',
          }}
        >
          <div
            className="flex whitespace-nowrap"
            style={{ animation: 'marquee-scroll 40s linear infinite' }}
          >
            <span className="text-primary text-xs tracking-widest pr-16 shrink-0">{ticker}</span>
            <span className="text-primary text-xs tracking-widest pr-16 shrink-0" aria-hidden>{ticker}</span>
          </div>
        </div>

        <style>{`
          @keyframes marquee-scroll {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </div>
    )
  }

  // ── Code entry screen ─────────────────────────────────────────────────────────
  if (screen === 'code') {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center font-pixel scanlines px-4">
        <div className="w-full max-w-sm">
          <button
            className="text-muted text-xs mb-8 hover:text-primary"
            onClick={() => { setError(null); setOtp(''); setScreen('email') }}
          >
            &lt; BACK
          </button>

          <h1 className="text-primary text-lg mb-2 tracking-widest">CHECK YOUR EMAIL</h1>
          <div className="border-b border-border mb-6" />

          <p className="text-muted text-xs mb-6 leading-5">
            ENTER THE 6-DIGIT CODE SENT TO{' '}
            <span className="text-primary">{email.toUpperCase()}</span>
          </p>

          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <Field
              label="CODE"
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
            onClick={handleOAuthRedirect}
            disabled={loading}
            className="w-full border border-border text-muted text-xs py-3 px-4 text-left hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
          >
            {loading ? '> WAITING FOR GOOGLE...' : '> SIGN IN WITH GOOGLE'}
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

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={stayLoggedIn}
              onChange={(e) => setStayLoggedIn(e.target.checked)}
              className="accent-primary cursor-pointer"
            />
            <span className="text-muted text-xs">STAY LOGGED IN</span>
          </label>

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
