/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        pixel:    ['"Press Start 2P"', 'monospace'],
        terminal: ['"VT323"', 'monospace'],
      },
      colors: {
        // All theme colors via CSS custom properties.
        // Use these everywhere — never hardcode hex values in components.
        bg:        'var(--color-bg)',
        surface:   'var(--color-surface)',
        border:    'var(--color-border)',
        primary:   'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        muted:     'var(--color-muted)',
        dim:       'var(--color-dim)',
        warning:   'var(--color-warning)',
      },
      animation: {
        blink: 'blink 1s step-end infinite',
        scanline: 'scanline 8s linear infinite',
        'xp-pop': 'xp-pop 0.9s ease-out forwards',
        'xp-pop-mega': 'xp-pop-mega 1.2s ease-out forwards',
        'pixel-spin': 'pixel-spin 0.8s steps(8, end) infinite',
        marquee: 'marquee 40s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%':   { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'pixel-spin': {
          '0%':    { transform: 'translate(0px,  -3px)' },
          '12.5%': { transform: 'translate(2px,  -2px)' },
          '25%':   { transform: 'translate(3px,   0px)' },
          '37.5%': { transform: 'translate(2px,   2px)' },
          '50%':   { transform: 'translate(0px,   3px)' },
          '62.5%': { transform: 'translate(-2px,  2px)' },
          '75%':   { transform: 'translate(-3px,  0px)' },
          '87.5%': { transform: 'translate(-2px, -2px)' },
          '100%':  { transform: 'translate(0px,  -3px)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'xp-pop': {
          '0%':   { opacity: '0', transform: 'translateX(-50%) translateY(0) scale(0.8)' },
          '15%':  { opacity: '1', transform: 'translateX(-50%) translateY(-10px) scale(1.15)' },
          '70%':  { opacity: '1', transform: 'translateX(-50%) translateY(-32px) scale(1.05)' },
          '100%': { opacity: '0', transform: 'translateX(-50%) translateY(-52px) scale(0.95)' },
        },
        'xp-pop-mega': {
          '0%':   { opacity: '0', transform: 'translateX(-50%) translateY(0) scale(0.8)' },
          '12%':  { opacity: '1', transform: 'translateX(-50%) translateY(-8px) scale(1.6)' },
          '45%':  { opacity: '1', transform: 'translateX(-50%) translateY(-32px) scale(1.35)' },
          '80%':  { opacity: '0.8', transform: 'translateX(-50%) translateY(-56px) scale(1.1)' },
          '100%': { opacity: '0', transform: 'translateX(-50%) translateY(-76px) scale(0.9)' },
        },
      },
    },
  },
  plugins: [],
}
