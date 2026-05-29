import { useRef } from 'react'
import DialogueScene from '../DialogueScene'
import type { DialogueLine } from '../DialogueScene'
import { isSfxMuted } from '@/lib/sfx'

const LINES: DialogueLine[] = [
  { speaker: 'Mysterious Voice', text: "Oh look what we have here." },
  { speaker: 'Mysterious Voice', text: 'No one is going to call you back.' },
  { speaker: 'Mysterious Voice', text: "Do you really think you're good enough for these roles?" },
  { speaker: 'Mysterious Voice', text: 'You\'re one of 4 million other job hunters, what makes you so special?' },
  { speaker: 'Mysterious Voice', text: 'Come back when you have more experience.' },
  { speaker: 'Mysterious Voice', text: 'Get it? More experience? HAHA' }
]

export const label = '00 · Self Doubt'

export default function SelfDoubt({ onComplete }: { onComplete: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pressCount = useRef(0)

  function handleLineAdvance() {
    pressCount.current += 1
    if (pressCount.current === 1) {
      const audio = new Audio('/intro.mp3')
      audio.volume = isSfxMuted() ? 0 : 0.6
      audio.play().catch(() => {})
      audioRef.current = audio
    }
  }

  return (
    <DialogueScene
      lines={LINES}
      onComplete={() => {
        audioRef.current?.pause()
        onComplete()
      }}
      onLineAdvance={handleLineAdvance}
      weather="rainThunder"
      fadeIn
    />
  )
}
