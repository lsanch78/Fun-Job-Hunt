import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { type GlobalStats, startStatsPoll } from '@/services/globalStatsService'

// ── Terminal hum (same as AppDetailCard) ─────────────────────────────────────
function startTerminalHum(): () => void {
  try {
    const ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.setValueAtTime(0, ctx.currentTime)
    master.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 2.5)
    master.connect(ctx.destination)

    const globalHpf = ctx.createBiquadFilter()
    globalHpf.type = 'highpass'
    globalHpf.frequency.value = 100
    globalHpf.Q.value = 0.7
    globalHpf.connect(master)

    const rumble = ctx.createOscillator()
    rumble.type = 'sine'
    rumble.frequency.setValueAtTime(120, ctx.currentTime)
    rumble.frequency.setValueAtTime(118.5, ctx.currentTime + 1.7)
    rumble.frequency.setValueAtTime(121.2, ctx.currentTime + 3.4)
    rumble.frequency.setValueAtTime(119.4, ctx.currentTime + 5.1)
    const rumbleGain = ctx.createGain()
    rumbleGain.gain.setValueAtTime(0, ctx.currentTime)
    rumbleGain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + 2.5)
    rumble.connect(rumbleGain)
    rumbleGain.connect(globalHpf)
    rumble.start()

    const chopBufLen = ctx.sampleRate * 3
    const chopBuf = ctx.createBuffer(1, chopBufLen, ctx.sampleRate)
    const chopData = chopBuf.getChannelData(0)
    for (let i = 0; i < chopBufLen; i++) chopData[i] = Math.random() * 2 - 1
    const chopSrc = ctx.createBufferSource()
    chopSrc.buffer = chopBuf
    chopSrc.loop = true
    const chopBp = ctx.createBiquadFilter()
    chopBp.type = 'bandpass'
    chopBp.frequency.value = 210
    chopBp.Q.value = 3.5
    const chopGain = ctx.createGain()
    chopGain.gain.setValueAtTime(0, ctx.currentTime)
    chopGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 2.5)
    chopSrc.connect(chopBp)
    chopBp.connect(chopGain)
    chopGain.connect(globalHpf)
    chopSrc.start()

    const hissBufLen = ctx.sampleRate * 5
    const hissBuf = ctx.createBuffer(1, hissBufLen, ctx.sampleRate)
    const hissData = hissBuf.getChannelData(0)
    for (let i = 0; i < hissBufLen; i++) hissData[i] = Math.random() * 2 - 1
    const hissSrc = ctx.createBufferSource()
    hissSrc.buffer = hissBuf
    hissSrc.loop = true
    const hissHpf = ctx.createBiquadFilter()
    hissHpf.type = 'highpass'
    hissHpf.frequency.value = 3800
    const hissGain = ctx.createGain()
    hissGain.gain.setValueAtTime(0, ctx.currentTime)
    hissGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2.5)
    hissSrc.connect(hissHpf)
    hissHpf.connect(hissGain)
    hissGain.connect(globalHpf)
    hissSrc.start()

    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.18
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = 0.018
    lfo.connect(lfoDepth)
    lfoDepth.connect(master.gain)
    lfo.start()

    return () => {
      try {
        const t = ctx.currentTime
        master.gain.cancelScheduledValues(t)
        master.gain.setValueAtTime(master.gain.value, t)
        master.gain.linearRampToValueAtTime(0, t + 0.3)
        setTimeout(() => ctx.close(), 400)
      } catch { /* ignore */ }
    }
  } catch {
    return () => {}
  }
}

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
  const [globalStats,   setGlobalStats]   = useState<GlobalStats | null>(null)
  const [soundOn,       setSoundOn]       = useState(() => localStorage.getItem('fjobhunt:auth_sound') === '1')
  const stopHumRef = useRef<(() => void) | null>(null)

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

  // Start stats polling — refreshes every 5 min, serves cache in between
  useEffect(() => {
    const stop = startStatsPoll(setGlobalStats)
    return stop
  }, [])

  // Stop hum on unmount
  useEffect(() => {
    return () => { stopHumRef.current?.() }
  }, [])

  function toggleSound() {
    if (soundOn) {
      stopHumRef.current?.()
      stopHumRef.current = null
      setSoundOn(false)
      localStorage.setItem('fjobhunt:auth_sound', '0')
    } else {
      stopHumRef.current = startTerminalHum()
      setSoundOn(true)
      localStorage.setItem('fjobhunt:auth_sound', '1')
    }
  }

  function proceedFromTitle() {
    // Start hum here (first user gesture) if preference is on and not already running
    if (soundOn && !stopHumRef.current) {
      stopHumRef.current = startTerminalHum()
    }
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

    // Duplicate items so the scroll feels seamless
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
