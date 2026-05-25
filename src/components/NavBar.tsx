import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { THEMES, type Theme } from '@/config/game'
import MusicPlayer from '@/components/MusicPlayer'
import { fireTutorial } from '@/lib/tutorialBus'

const THEME_LABELS: Record<Theme, string> = {
  terminal: 'TERMINAL',
  nes:      'NES RPG',
  gameboy:  'GAME BOY',
  arcade:   'ARCADE',
}

const NAV_LINKS = [
  { label: 'JOBS',  to: '/jobs' },
  { label: 'STATS', to: '/stats' },
  { label: 'STORY', to: '/story' },
]

// ── Sound: logo — descending terminal close blip ─────────────────────────────
function playExitBlip() {
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

// ── Sound: stats page — quick ascending data blips ────────────────────────────
function playStatsBlip() {
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
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null)
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

  async function handleSignOut() {
    await supabase.auth.signOut()
    setDropdownOpen(false)
    navigate('/auth')
  }

  // Initials avatar from email
  const initials = userEmail
    ? userEmail[0].toUpperCase()
    : '?'

  return (
    <nav data-tutorial="navbar" className="bg-surface border-b border-border font-pixel text-xs flex items-center justify-between px-4 h-10 shrink-0 z-50">

      {/* ── Left: App name + nav links ── */}
      <div className="flex items-center gap-6">
        <NavLink to="/auth" onClick={playExitBlip} className="text-primary tracking-widest whitespace-nowrap hover:text-secondary">
          FJOBHUNT
        </NavLink>

        <div className="flex items-center gap-4">
          {NAV_LINKS.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              onClick={to === '/jobs' ? playJobsBoot : to === '/stats' ? playStatsBlip : undefined}
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

      {/* ── Right: controls + avatar ── */}
      <div className="flex items-center gap-3">

        {/* Tutorial help button */}
        <button
          onClick={fireTutorial}
          className="font-pixel text-[9px] text-muted hover:text-primary border border-border hover:border-primary w-5 h-5 flex items-center justify-center leading-none transition-none"
          title="Help / Tutorial"
        >
          ?
        </button>

        {/* Music player */}
        <MusicPlayer />

        {/* Profile avatar + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
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
    </nav>
  )
}
