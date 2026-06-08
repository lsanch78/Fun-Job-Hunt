import type React from 'react'
import { CRT_FONT } from '@/lib/crtTheme'
import type { AiPhase } from '@/types'

if (typeof document !== 'undefined' && !document.getElementById('ai-btn-style')) {
  const el = document.createElement('style')
  el.id = 'ai-btn-style'
  el.textContent = `
@keyframes ai-idle-bg {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes ai-idle-glow {
  0%   { box-shadow: 0 0 4px 1px rgba(99,102,241,0.3), inset 0 0 6px 1px rgba(139,92,246,0.08); border-color: rgba(139,92,246,0.45); }
  50%  { box-shadow: 0 0 10px 2px rgba(139,92,246,0.55), inset 0 0 10px 2px rgba(99,102,241,0.15); border-color: rgba(167,139,250,0.8); }
  100% { box-shadow: 0 0 4px 1px rgba(99,102,241,0.3), inset 0 0 6px 1px rgba(139,92,246,0.08); border-color: rgba(139,92,246,0.45); }
}
@keyframes ai-gen-bg {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes ai-gen-glow {
  0%   { box-shadow: 0 0 6px 2px rgba(34,197,94,0.4), inset 0 0 8px 1px rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.6); }
  50%  { box-shadow: 0 0 16px 4px rgba(74,222,128,0.65), inset 0 0 14px 2px rgba(34,197,94,0.2); border-color: rgba(134,239,172,0.95); }
  100% { box-shadow: 0 0 6px 2px rgba(34,197,94,0.4), inset 0 0 8px 1px rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.6); }
}
@keyframes ai-ready-bg {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes ai-ready-glow {
  0%   { box-shadow: 0 0 8px 2px rgba(168,85,247,0.5), inset 0 0 10px 2px rgba(168,85,247,0.15); border-color: rgba(192,132,252,0.7); }
  50%  { box-shadow: 0 0 22px 6px rgba(217,70,239,0.7), inset 0 0 18px 4px rgba(217,70,239,0.25); border-color: rgba(240,171,252,1); }
  100% { box-shadow: 0 0 8px 2px rgba(168,85,247,0.5), inset 0 0 10px 2px rgba(168,85,247,0.15); border-color: rgba(192,132,252,0.7); }
}
@keyframes ai-idle-text {
  0%   { color: #a78bfa; text-shadow: 0 0 6px rgba(139,92,246,0.5); }
  50%  { color: #c4b5fd; text-shadow: 0 0 12px rgba(167,139,250,0.8); }
  100% { color: #a78bfa; text-shadow: 0 0 6px rgba(139,92,246,0.5); }
}
@keyframes ai-gen-text {
  0%   { color: #4ade80; text-shadow: 0 0 6px rgba(34,197,94,0.6); }
  50%  { color: #86efac; text-shadow: 0 0 14px rgba(74,222,128,0.9); }
  100% { color: #4ade80; text-shadow: 0 0 6px rgba(34,197,94,0.6); }
}
@keyframes ai-ready-text {
  0%   { color: #c084fc; text-shadow: 0 0 8px rgba(168,85,247,0.7); }
  50%  { color: #f0abfc; text-shadow: 0 0 18px rgba(217,70,239,1); }
  100% { color: #c084fc; text-shadow: 0 0 8px rgba(168,85,247,0.7); }
}

.ai-btn-idle  { animation: ai-idle-bg 3.5s ease infinite, ai-idle-glow 3.5s ease infinite; }
.ai-btn-idle .ai-btn-label { animation: ai-idle-text 3.5s ease infinite; }
.ai-btn-generating { animation: ai-gen-bg 0.9s ease infinite, ai-gen-glow 0.9s ease infinite; }
.ai-btn-generating .ai-btn-label { animation: ai-gen-text 0.9s ease infinite; }
.ai-btn-ready { animation: ai-ready-bg 1.2s ease infinite, ai-ready-glow 1.2s ease infinite; }
.ai-btn-ready .ai-btn-label { animation: ai-ready-text 1.2s ease infinite; }
`
  document.head.appendChild(el)
}

interface AiButtonProps {
  label: string
  phase: AiPhase
  dots: number
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  disabled?: boolean
  title?: string
}

const PHASE_STYLE: Record<AiPhase, React.CSSProperties> = {
  idle: {
    background: 'linear-gradient(135deg, #130a2a 0%, #1e1060 40%, #0d1a2e 70%, #130a2a 100%)',
    backgroundSize: '300% 300%',
    border: '1px solid rgba(139,92,246,0.45)',
  },
  generating: {
    background: 'linear-gradient(135deg, #061a10 0%, #0d3320 35%, #162040 65%, #061a10 100%)',
    backgroundSize: '300% 300%',
    border: '1px solid rgba(34,197,94,0.6)',
  },
  ready: {
    background: 'linear-gradient(135deg, #200a40 0%, #5b0ea6 40%, #300a60 70%, #200a40 100%)',
    backgroundSize: '300% 300%',
    border: '1px solid rgba(192,132,252,0.7)',
  },
}

export default function AiButton({ label, phase, dots, onClick, onContextMenu, disabled, title }: AiButtonProps) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      disabled={disabled}
      className={[
        'px-3 py-1 transition-none hover:opacity-90 disabled:cursor-not-allowed',
        phase === 'generating' ? 'ai-btn-generating' : phase === 'ready' ? 'ai-btn-ready' : 'ai-btn-idle',
      ].join(' ')}
      style={{ ...PHASE_STYLE[phase], minWidth: '5rem', textAlign: 'center' }}
      title={title}
    >
      <span className="ai-btn-label" style={{ fontSize: CRT_FONT.btn, fontFamily: '"VT323", monospace' }}>
        {phase === 'generating' ? `GEN${'.'.repeat(dots + 1)}` : label}
      </span>
    </button>
  )
}
