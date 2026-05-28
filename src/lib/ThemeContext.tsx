import { createContext, useContext, useEffect, useState } from 'react'
import { THEMES, type Theme } from '@/config/game'

const STORAGE_KEY = 'fjobhunt:theme'
const CUSTOM_COLORS_KEY = 'fjobhunt:custom-colors'
const DEFAULT_THEME: Theme = 'terminal'

export interface CustomColors {
  bg: string
  surface: string
  border: string
  primary: string
  secondary: string
  muted: string
  dim: string
  warning: string
}

export const DEFAULT_CUSTOM_COLORS: CustomColors = {
  bg:        '#000000',
  surface:   '#111111',
  border:    '#ffffff',
  primary:   '#ff6600',
  secondary: '#ffffff',
  muted:     '#aaaaaa',
  dim:       '#cc5200',
  warning:   '#ff0000',
}

function applyCustomColors(colors: CustomColors) {
  const el = document.documentElement
  el.style.setProperty('--color-bg',        colors.bg)
  el.style.setProperty('--color-surface',   colors.surface)
  el.style.setProperty('--color-border',    colors.border)
  el.style.setProperty('--color-primary',   colors.primary)
  el.style.setProperty('--color-secondary', colors.secondary)
  el.style.setProperty('--color-muted',     colors.muted)
  el.style.setProperty('--color-dim',       colors.dim)
  el.style.setProperty('--color-warning',   colors.warning)
}

function clearCustomColors() {
  const el = document.documentElement
  el.style.removeProperty('--color-bg')
  el.style.removeProperty('--color-surface')
  el.style.removeProperty('--color-border')
  el.style.removeProperty('--color-primary')
  el.style.removeProperty('--color-secondary')
  el.style.removeProperty('--color-muted')
  el.style.removeProperty('--color-dim')
  el.style.removeProperty('--color-warning')
}

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
  customColors: CustomColors
  setCustomColors: (c: CustomColors) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return (THEMES as readonly string[]).includes(stored ?? '')
      ? (stored as Theme)
      : DEFAULT_THEME
  })

  const [customColors, setCustomColorsState] = useState<CustomColors>(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_COLORS_KEY)
      return stored ? { ...DEFAULT_CUSTOM_COLORS, ...JSON.parse(stored) } : DEFAULT_CUSTOM_COLORS
    } catch {
      return DEFAULT_CUSTOM_COLORS
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
    if (theme === 'custom') {
      applyCustomColors(customColors)
    } else {
      clearCustomColors()
    }
  }, [theme, customColors])

  // Apply on first render before any paint
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (theme === 'custom') applyCustomColors(customColors)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function setTheme(t: Theme) {
    setThemeState(t)
  }

  function setCustomColors(c: CustomColors) {
    setCustomColorsState(c)
    localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(c))
    if (theme === 'custom') applyCustomColors(c)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, customColors, setCustomColors }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
