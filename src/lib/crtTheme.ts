// Fixed CRT terminal palette — intentionally independent of the app theme system.
// These panels always render as a phosphor-green CRT regardless of user theme.
export const T = {
  green:    '#39ff14',
  greenDim: '#23a80d',
  border:   '#2a2a2a',
  borderHi: '#39ff14',
  warn:     '#ff9900',
  bg:       '#000',
}

// Shared inline styles for CRT panels — tune these to adjust readability across all panels
export const crtTextShadow = '0 0 4px rgba(57,255,20,0.15)'
export const crtBoxShadow = [
  '0 0 0 1px #111',
  '0 0 8px 1px rgba(57,255,20,0.35)',
  '0 0 28px 4px rgba(57,255,20,0.25)',
  'inset 0 0 60px 30px rgba(0,0,0,0.70)',
  'inset 0 0 10px 2px rgba(57,255,20,0.06)',
].join(', ')

// Semantic font size scale — sized against TutorialOverlay as the readability baseline
export const CRT_FONT = {
  chrome: '13px',   // decorative chrome: header labels, ESC button, close ✕
  btn:    '14px',   // buttons, footer hints
  label:  '15px',   // field labels, step counters, status text
  body:   '1.2rem', // primary body / input / output text
  sub:    '22px',   // subtitles, panel section headers
  title:  '26px',   // panel titles
}

// Tailwind class strings shared by CRT panel form fields
export const labelClass    = 'text-[15px] tracking-widest uppercase mb-1 select-none' // CRT_FONT.label
export const inputClass    = 'bg-transparent outline-none w-full px-1 py-0.5 leading-tight border-b'
export const textareaClass = `${inputClass} resize-none`

const CRT_CSS = `
@keyframes console-boot {
  0%   { opacity: 0; transform: scaleY(0.04) scaleX(0.98); filter: brightness(4); }
  40%  { opacity: 1; transform: scaleY(1.08) scaleX(1);    filter: brightness(1.2); }
  60%  { opacity: 1; transform: scaleY(0.97) scaleX(1);    filter: brightness(1); }
  80%  { opacity: 1; transform: scaleY(1.01) scaleX(1);    filter: brightness(1); }
  100% { opacity: 1; transform: scaleY(1)    scaleX(1);    filter: brightness(1); }
}
@keyframes crt-flicker {
  0%   { filter: brightness(1)    opacity(1); }
  18%  { filter: brightness(1)    opacity(1); }
  19%  { filter: brightness(0.94) opacity(0.97); }
  20%  { filter: brightness(1)    opacity(1); }
  45%  { filter: brightness(1)    opacity(1); }
  46%  { filter: brightness(0.97) opacity(0.98); }
  47%  { filter: brightness(1.02) opacity(1); }
  48%  { filter: brightness(1)    opacity(1); }
  72%  { filter: brightness(1)    opacity(1); }
  73%  { filter: brightness(0.96) opacity(0.98); }
  74%  { filter: brightness(1)    opacity(1); }
  100% { filter: brightness(1)    opacity(1); }
}
.crt-card {
  position: relative;
  overflow: hidden;
}
.crt-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 38%, rgba(57,255,20,0.04) 0%, rgba(255,255,255,0.015) 35%, transparent 65%);
  pointer-events: none;
  z-index: 10;
  border-radius: inherit;
}
.crt-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.08) 2px,
    rgba(0,0,0,0.08) 4px
  );
  pointer-events: none;
  z-index: 11;
  border-radius: inherit;
}
`

// Injects CRT keyframes and .crt-card styles once per page load.
export function ensureCrtStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById('crt-shared-styles')) return
  const el = document.createElement('style')
  el.id = 'crt-shared-styles'
  el.textContent = CRT_CSS
  document.head.appendChild(el)
}
