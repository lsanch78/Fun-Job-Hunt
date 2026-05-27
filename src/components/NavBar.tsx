import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import { MessageText } from 'pixelarticons/react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { THEMES, type Theme } from '@/config/game'
import MusicPlayer from '@/components/MusicPlayer'
import FeedbackModal from '@/components/FeedbackModal'
import { fireTutorial, hasTutorialTrigger, registerTutorialActiveListener, unregisterTutorialActiveListener } from '@/lib/tutorialBus'
import { isSfxMuted, toggleSfxMuted, onSfxMutedChange } from '@/lib/sfx'

const DEV_EMAIL = 'luis.sanchez01994@gmail.com'

const THEME_LABELS: Record<Theme, string> = {
  terminal: 'TERMINAL',
  nes:      'NES RPG',
  gameboy:  'GAME BOY',
  arcade:   'ARCADE',
}

const NAV_LINKS = [
  { label: 'JOBS',    to: '/jobs' },
  { label: 'STATS',   to: '/stats' },
  { label: 'STORY',   to: '/story' },
  { label: 'CREDITS', to: '/credits' },
]

// ── Sound: logo — descending terminal close blip ─────────────────────────────
function playExitBlip() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const notes = [
      { freq: 880, t: 0,    dur: 0.06, vol: 0.030 },
      { freq: 440, t: 0.07, dur: 0.05, vol: 0.028 },
      { freq: 220, t: 0.13, dur: 0.12, vol: 0.026 },
    ]
    notes.forEach(({ freq, t, dur, vol }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + t)
      gain.gain.setValueAtTime(0, ctx.currentTime + t)
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + t + 0.005)
      gain.gain.setValueAtTime(vol, ctx.currentTime + t + dur - 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + dur + 0.01)
    })
  } catch { /* AudioContext blocked */ }
}

// ── Sound: jobs page — sharp terminal boot crack ──────────────────────────────
function playJobsBoot() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    // Short noise burst through a high-pass filter: crisp terminal "snap"
    const bufLen = ctx.sampleRate * 0.04
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let s = 0; s < bufLen; s++) data[s] = Math.random() * 2 - 1

    const src = ctx.createBufferSource()
    src.buffer = buf

    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2800
    hp.Q.value = 0.8

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.038)

    src.connect(hp)
    hp.connect(gain)
    gain.connect(ctx.destination)
    src.start()
    src.stop(ctx.currentTime + 0.04)
  } catch { /* AudioContext blocked */ }
}

// ── Sound: profile dropdown open — soft single blip ──────────────────────────
function playProfileBlip() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(660, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.04)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.028, ctx.currentTime + 0.006)
    gain.gain.setValueAtTime(0.028, ctx.currentTime + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.11)
  } catch { /* AudioContext blocked */ }
}

// ── Sound: sign out — descending two-note blip ────────────────────────────────
function playSignOutBlip() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const notes = [
      { freq: 440, t: 0,    dur: 0.06, vol: 0.030 },
      { freq: 220, t: 0.07, dur: 0.10, vol: 0.025 },
    ]
    notes.forEach(({ freq, t, dur, vol }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + t)
      gain.gain.setValueAtTime(0, ctx.currentTime + t)
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + t + 0.005)
      gain.gain.setValueAtTime(vol, ctx.currentTime + t + dur - 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + dur + 0.01)
    })
  } catch { /* AudioContext blocked */ }
}

// ── Sound: credits page — gentle ascending arpeggio ──────────────────────────
function playCreditsBlip() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const notes = [
      { freq: 523.25, t: 0,    dur: 0.10, vol: 0.026 }, // C5
      { freq: 659.25, t: 0.10, dur: 0.10, vol: 0.024 }, // E5
      { freq: 783.99, t: 0.20, dur: 0.14, vol: 0.021 }, // G5
    ]
    notes.forEach(({ freq, t, dur, vol }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + t)
      gain.gain.setValueAtTime(0, ctx.currentTime + t)
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + t + 0.007)
      gain.gain.setValueAtTime(vol, ctx.currentTime + t + dur - 0.012)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + dur + 0.01)
    })
  } catch { /* AudioContext blocked */ }
}

// ── Sound: stats page — quick ascending data blips ────────────────────────────
function playStatsBlip() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    // Three rapid ascending square-wave blips: D5 → F#5 → A5
    const notes = [587.33, 739.99, 880.00]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.07
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.035, t + 0.008)
      gain.gain.setValueAtTime(0.035, t + 0.045)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
      osc.start(t)
      osc.stop(t + 0.15)
    })
  } catch { /* AudioContext blocked */ }
}


export default function NavBar() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [tutorialActive, setTutorialActive] = useState(false)
  const [sfxMuted, setSfxMutedState] = useState(isSfxMuted)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    registerTutorialActiveListener(setTutorialActive)
    return () => unregisterTutorialActiveListener()
  }, [])

  useEffect(() => onSfxMutedChange(setSfxMutedState), [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null)
      setUserId(data.session?.user.id ?? null)
    })
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Lock scroll when mobile drawer is open
  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  async function handleSignOut() {
    playSignOutBlip()
    await supabase.auth.signOut()
    setDropdownOpen(false)
    navigate('/auth')
  }

  // Initials avatar from email
  const initials = userEmail
    ? userEmail[0].toUpperCase()
    : '?'

  const mobileDrawer = drawerOpen ? createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[9994]"
        onClick={() => setDrawerOpen(false)}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-64 bg-surface border-l border-border flex flex-col z-[9995] overflow-y-auto font-pixel text-xs">
        {/* Close */}
        <div className="flex items-center justify-between px-4 h-10 border-b border-border shrink-0">
          <span className="text-primary tracking-widest">MENU</span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-10 h-10 flex items-center justify-center text-muted hover:text-primary"
          >
            ✕
          </button>
        </div>

        {/* Nav links — mobile: JOBS and CREDITS only */}
        {NAV_LINKS.filter(({ to }) => to === '/jobs' || to === '/credits').map(({ label, to }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => {
              setDrawerOpen(false)
              if (to === '/jobs') playJobsBoot()
              else if (to === '/credits') playCreditsBlip()
            }}
            className={({ isActive }) =>
              `px-4 py-3 border-b border-border tracking-widest transition-none ${
                isActive ? 'text-primary' : 'text-muted'
              }`
            }
          >
            {label}
          </NavLink>
        ))}

        {/* Theme */}
        <div className="border-b border-border">
          <p className="px-4 pt-3 pb-1 text-muted text-[9px] tracking-widest">THEME</p>
          {THEMES.map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`w-full text-left px-4 py-2 transition-none ${theme === t ? 'text-primary' : 'text-muted'}`}
            >
              {theme === t ? '> ' : '  '}{THEME_LABELS[t]}
            </button>
          ))}
        </div>

        {/* SFX */}
        <div className="px-4 py-3 border-b border-border">
          <button
            onClick={() => setSfxMutedState(toggleSfxMuted())}
            className={`w-full text-left py-1 text-[10px] transition-none ${sfxMuted ? 'text-muted line-through' : 'text-primary'}`}
          >
            SFX {sfxMuted ? '(MUTED)' : '(ON)'}
          </button>
        </div>

        {/* Tutorial + Feedback */}
        <div className="px-4 py-3 border-b border-border flex flex-col gap-1">
          <button
            onClick={() => {
              setDrawerOpen(false)
              playProfileBlip()
              if (hasTutorialTrigger()) fireTutorial()
              else navigate('/jobs?tutorial=1')
            }}
            className={`w-full text-left py-2 text-[10px] transition-none ${tutorialActive ? 'text-primary' : 'text-muted'}`}
          >
            ? HELP / TUTORIAL
          </button>
          {userId && (
            <button
              onClick={() => { setDrawerOpen(false); playProfileBlip(); setFeedbackOpen(true) }}
              className="w-full text-left py-2 text-[10px] text-muted transition-none"
            >
              ✉ SEND FEEDBACK
            </button>
          )}
        </div>

        {/* Settings + Dev */}
        <div className="px-4 py-3 border-b border-border flex flex-col gap-1">
          <button
            onClick={() => { setDrawerOpen(false); navigate('/settings') }}
            className="w-full text-left py-2 text-[10px] text-muted transition-none"
          >
            SETTINGS
          </button>
          {userEmail === DEV_EMAIL && (
            <button
              onClick={() => { setDrawerOpen(false); navigate('/dev') }}
              className="w-full text-left py-2 text-[10px] text-muted transition-none"
            >
              DEV PORTAL
            </button>
          )}
        </div>

        {/* User info + sign out */}
        <div className="px-4 py-3 flex flex-col gap-2 mt-auto">
          {userEmail && (
            <span className="text-muted text-[9px] truncate">{userEmail}</span>
          )}
          {userEmail ? (
            <button
              onClick={() => { setDrawerOpen(false); handleSignOut() }}
              className="w-full text-left py-2 text-[10px] text-warning transition-none"
            >
              SIGN OUT
            </button>
          ) : (
            <button
              onClick={() => { setDrawerOpen(false); navigate('/auth') }}
              className="w-full text-left py-2 text-[10px] text-muted transition-none"
            >
              SIGN IN
            </button>
          )}
        </div>
      </div>
    </>,
    document.body
  ) : null

  return (
    <>
    <nav data-tutorial="navbar" className="bg-surface border-b border-border font-pixel text-xs flex items-center justify-between px-4 h-10 shrink-0 z-50">

      {/* ── Left: App name + nav links (desktop) ── */}
      <div className="flex items-center gap-6">
        <NavLink to="/auth" onClick={playExitBlip} className="text-primary tracking-widest whitespace-nowrap hover:text-secondary flex items-center gap-2">
          FJOBHUNT
          <span className="sm:hidden text-muted text-[8px] tracking-widest">[MOBILE]</span>
        </NavLink>

        <div className="hidden sm:flex items-center gap-4">
          {NAV_LINKS.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              onClick={to === '/jobs' ? playJobsBoot : to === '/stats' ? playStatsBlip : to === '/credits' ? playCreditsBlip : undefined}
              className={({ isActive }) =>
                `whitespace-nowrap transition-none ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted hover:text-secondary'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* ── Right: controls + avatar (desktop) ── */}
      <div className="hidden sm:flex items-center gap-3">

        {/* Tutorial help button */}
        <button
          onClick={() => { playProfileBlip(); if (hasTutorialTrigger()) { fireTutorial() } else { navigate('/jobs?tutorial=1') } }}
          className={`w-6 h-6 border flex items-center justify-center leading-none hover:opacity-80 font-pixel text-xs ${tutorialActive ? 'bg-primary text-bg border-primary' : 'bg-surface text-muted border-border hover:text-primary hover:border-primary'}`}
          title="Help / Tutorial"
        >
          ?
        </button>

        {/* Feedback button */}
        {userId && (
          <button
            onClick={() => { playProfileBlip(); setFeedbackOpen(true) }}
            className="w-6 h-6 border border-border flex items-center justify-center leading-none hover:opacity-80 text-muted hover:text-primary hover:border-primary"
            title="Send Feedback"
          >
            <MessageText className="w-3.5 h-3.5" />
          </button>
        )}

        {/* SFX mute toggle */}
        <button
          onClick={() => setSfxMutedState(toggleSfxMuted())}
          className={`w-6 h-6 border flex items-center justify-center leading-none hover:opacity-80 font-pixel text-[8px] ${sfxMuted ? 'bg-surface text-muted border-border line-through' : 'bg-surface text-primary border-primary'}`}
          title={sfxMuted ? 'Unmute SFX' : 'Mute SFX'}
        >
          SFX
        </button>

        {/* Music player */}
        <MusicPlayer />

        {/* Profile avatar + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => { playProfileBlip(); setDropdownOpen((o) => !o) }}
            className="w-6 h-6 bg-primary text-bg flex items-center justify-center leading-none hover:opacity-80"
            title={userEmail ?? 'Account'}
          >
            {initials}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-8 bg-surface border border-border min-w-[180px] flex flex-col z-50">

              {/* User info */}
              {userEmail && (
                <div className="px-3 py-2 border-b border-border text-muted truncate">
                  {userEmail}
                </div>
              )}

              {/* Theme submenu */}
              <div className="border-b border-border">
                <p className="px-3 pt-2 pb-1 text-muted">THEME</p>
                {THEMES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`w-full text-left px-3 py-1.5 hover:bg-border ${
                      theme === t ? 'text-primary' : 'text-muted'
                    }`}
                  >
                    {theme === t ? '> ' : '  '}{THEME_LABELS[t]}
                  </button>
                ))}
              </div>

              {/* Settings */}
              <button
                onClick={() => { navigate('/settings'); setDropdownOpen(false) }}
                className="text-left px-3 py-2 text-muted hover:text-primary hover:bg-border"
              >
                SETTINGS
              </button>

              {/* Dev portal — only visible to dev account */}
              {userEmail === DEV_EMAIL && (
                <button
                  onClick={() => { navigate('/dev'); setDropdownOpen(false) }}
                  className="text-left px-3 py-2 text-muted hover:text-primary hover:bg-border"
                >
                  DEV PORTAL
                </button>
              )}

              {/* Sign in / Sign out */}
              {userEmail ? (
                <button
                  onClick={handleSignOut}
                  className="text-left px-3 py-2 text-red-500 hover:bg-border border-t border-border"
                >
                  SIGN OUT
                </button>
              ) : (
                <button
                  onClick={() => { navigate('/auth'); setDropdownOpen(false) }}
                  className="text-left px-3 py-2 text-muted hover:text-primary hover:bg-border border-t border-border"
                >
                  SIGN IN
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Hamburger (mobile only) ── */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="sm:hidden w-8 h-8 flex flex-col items-center justify-center gap-1.5 text-muted hover:text-primary"
        title="Menu"
        aria-label="Open menu"
      >
        <span className="block w-5 h-px bg-current" />
        <span className="block w-5 h-px bg-current" />
        <span className="block w-5 h-px bg-current" />
      </button>

    </nav>

    {/* Mobile drawer portal */}
    {mobileDrawer}

    {feedbackOpen && userId && (
      <FeedbackModal userId={userId} onClose={() => setFeedbackOpen(false)} />
    )}
    </>
  )
}
