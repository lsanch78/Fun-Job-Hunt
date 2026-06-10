import { useEffect, useState, useCallback, useRef } from 'react'
import { getSession, signInWithIdToken, signInWithOtp, verifyOtp, signInWithOAuth } from '@/services/authService'
import { startStatsPoll } from '@/services/globalStatsService'
import type { GlobalStats } from '@/types'
import { startTerminalHum, playAuthBlip as playBlip } from '@/lib/sfx'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import type { Screen, AuthError } from '@/types'

async function generateNonce(): Promise<[string, string]> {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  const encoded = new TextEncoder().encode(nonce)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashedNonce = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return [nonce, hashedNonce]
}

export function useAuthFlow(introMp3: string) {
  const [screen,        setScreen]        = useState<Screen>('title')
  const [returningName, setReturningName] = useState<string | null>(null)
  const [email,         setEmail]         = useState('')
  const [stayLoggedIn,  setStayLoggedIn]  = useState(true)
  const [otp,           setOtp]           = useState('')
  const [error,         setError]         = useState<AuthError>(null)
  const [loading,       setLoading]       = useState(false)
  const [globalStats,   setGlobalStats]   = useState<GlobalStats | null>(null)
  const [soundOn,       setSoundOn]       = useState(() => lsGet<number>(SK.authSound, 0) === 1)
  const stopHumRef = useRef<(() => void) | null>(null)
  const introRef   = useRef<HTMLAudioElement | null>(null)
  const nonceRef   = useRef<string | null>(null)

  useEffect(() => {
    getSession().then((session) => {
      if (session) {
        const name = (session.user.user_metadata?.['username'] as string | undefined) ?? null
        setReturningName(name)
      }
    })
  }, [])

  useEffect(() => {
    const stop = startStatsPoll(setGlobalStats)
    return stop
  }, [])

  useEffect(() => {
    return () => {
      stopHumRef.current?.()
      if (introRef.current) { introRef.current.pause(); introRef.current.src = '' }
      window.google?.accounts.id.cancel()
    }
  }, [])

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
    const { error } = await signInWithIdToken(response.credential, nonceRef.current ?? undefined)
    setLoading(false)
    if (error) { setError(error); return }
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
      if (!returningName) setScreen('email')
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
    const { error } = await signInWithOtp(email, stayLoggedIn)
    setLoading(false)
    if (error) { setError(error); return }
    setScreen('code')
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await verifyOtp(email, otp)
    if (error) { setLoading(false); setError(error); return }
    setLoading(false)
  }

  async function handleOAuthRedirect() {
    setError(null)
    setLoading(true)
    const { error } = await signInWithOAuth()
    if (error) { setError(error); setLoading(false) }
  }

  return {
    screen, setScreen,
    returningName,
    email, setEmail,
    stayLoggedIn, setStayLoggedIn,
    otp, setOtp,
    error,
    loading,
    globalStats,
    soundOn,
    toggleSound,
    proceedFromTitle,
    handleSendOtp,
    handleVerifyOtp,
    handleOAuthRedirect,
  }
}
