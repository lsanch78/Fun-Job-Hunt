import { useState } from 'react'
import { playDialogueConfirm } from '@/lib/sfx'
import RainOverlay from './RainOverlay'
import ResumeStormOverlay from './ResumeStormOverlay'
import HeartwaveOverlay from './HeartwaveOverlay'
import ResumeTimePassingOverlay from './ResumeTimePassingOverlay'
import type { DialogueWeather } from './DialogueScene'

export interface DialogueChoiceSceneProps {
  speaker?: string
  prompt: string
  options: string[]
  weather?: DialogueWeather
  onSubmit: (value: string) => void
}

export default function DialogueChoiceScene({
  speaker,
  prompt,
  options,
  weather,
  onSubmit,
}: DialogueChoiceSceneProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function handleSelect(i: number) {
    if (submitted) return
    setSelected(i)
  }

  function handleConfirm() {
    if (selected === null || submitted) return
    setSubmitted(true)
    playDialogueConfirm()
    onSubmit(options[selected])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight')
      setSelected(i => i === null ? 0 : Math.min((i + 1), options.length - 1))
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft')
      setSelected(i => i === null ? 0 : Math.max((i ?? 1) - 1, 0))
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-end justify-center pb-16 px-6"
      style={{ fontFamily: '"Press Start 2P", monospace' }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {weather === 'rainThunder' && <RainOverlay />}
      {weather === 'resumeStorm' && <ResumeStormOverlay />}
      {weather === 'heartwave' && <HeartwaveOverlay />}
      {weather === 'resumeTimePassing' && <ResumeTimePassingOverlay />}

      <div className="w-full max-w-lg flex flex-col gap-2" style={{ zIndex: 1 }}>
        {speaker && (
          <div className="text-[9px] text-secondary tracking-widest px-1">{speaker}</div>
        )}

        <div className="border-2 border-primary bg-black p-5 min-h-[160px] flex flex-col justify-between gap-4">
          <p className="text-xs text-primary leading-relaxed">{prompt}</p>

          <div className="flex flex-col gap-2">
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => { handleSelect(i); }}
                onDoubleClick={handleConfirm}
                disabled={submitted}
                className="text-left text-[9px] px-3 py-2 border transition-colors disabled:opacity-40"
                style={{
                  borderColor: selected === i ? 'var(--color-primary)' : 'var(--color-border)',
                  color: selected === i ? 'var(--color-primary)' : 'var(--color-muted)',
                  background: selected === i ? 'rgba(255,255,255,0.04)' : 'transparent',
                }}
              >
                {selected === i ? '▶ ' : '  '}{opt}
              </button>
            ))}

            <button
              onClick={handleConfirm}
              disabled={selected === null || submitted}
              className="self-end text-[9px] text-muted border border-muted px-3 py-1 mt-1 disabled:opacity-30"
              style={{ animation: selected !== null && !submitted ? 'dialogue-prompt-pulse 1.2s ease-in-out infinite' : undefined }}
            >
              [ ENTER ] confirm
            </button>
          </div>
        </div>

        <div className="text-[9px] text-muted text-right px-1 invisible">0 / 0</div>
      </div>
    </div>
  )
}
