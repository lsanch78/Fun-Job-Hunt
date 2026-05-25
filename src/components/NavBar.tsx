import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { THEMES, type Theme } from '@/config/game'
import MusicPlayer from '@/components/MusicPlayer'

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
    <nav className="bg-surface border-b border-border font-pixel text-xs flex items-center justify-between px-4 h-10 shrink-0 z-50">

      {/* ── Left: App name + nav links ── */}
      <div className="flex items-center gap-6">
        <NavLink to="/auth" className="text-primary tracking-widest whitespace-nowrap hover:text-secondary">
          FJOBHUNT
        </NavLink>

        <div className="flex items-center gap-4">
          {NAV_LINKS.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
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
