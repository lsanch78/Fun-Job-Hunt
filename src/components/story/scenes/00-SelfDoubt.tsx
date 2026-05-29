import { useRef, useState } from 'react'
import DialogueScene from '../DialogueScene'
import DialogueInputScene from '../DialogueInputScene'
import type { DialogueLine } from '../DialogueScene'
import { isSfxMuted } from '@/lib/sfx'
import { supabase } from '@/lib/supabase'
import { setStoryInput } from '@/services/storyInputService'

const LINES_BEFORE: DialogueLine[] = [
  { speaker: 'Mysterious Voice', text: "Oh look what we have here." },
  { speaker: 'Mysterious Voice', text: 'No one is going to call you back.' },
  { speaker: 'Mysterious Voice', text: "Do you really think you're good enough for these roles?" },
  { speaker: 'Mysterious Voice', text: "You're one of 4 million other job hunters, what makes you so special?" },
]

// Filled in at runtime once the player submits their name
function buildAfterLines(name: string): DialogueLine[] {
  return [
    { speaker: 'Mysterious Voice', text: 'Come talk to me when you have more experience.' },
    { speaker: 'Mysterious Voice', text: `Get it, ${name}? More experience? HAHA` },
  ]
}

type Phase = 'before' | 'input' | 'after'

export const label = '00 · Self Doubt'

export default function SelfDoubt({ onComplete }: { onComplete: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pressCount = useRef(0)
  const [phase, setPhase] = useState<Phase>('before')
  const [playerName, setPlayerName] = useState('')

  function handleLineAdvance() {
    pressCount.current += 1
    if (pressCount.current === 1) {
      const audio = new Audio('/intro.mp3')
      audio.volume = isSfxMuted() ? 0 : 0.6
      audio.play().catch(() => {})
      audioRef.current = audio
    }
  }

  async function handleNameSubmit(name: string) {
    setPlayerName(name)

    // Update DB username and persist to story inputs
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.auth.updateUser({ data: { username: name } })
      setStoryInput(user.id, 0, name)
    }

    setPhase('after')
  }

  if (phase === 'input') {
    return (
      <DialogueInputScene
        speaker="Mysterious Voice"
        prompt="What's your name anyways?"
        placeholder="enter your name"
        maxLength={24}
        weather="rainThunder"
        onSubmit={handleNameSubmit}
      />
    )
  }

  if (phase === 'after') {
    return (
      <DialogueScene
        lines={buildAfterLines(playerName)}
        onComplete={() => {
          audioRef.current?.pause()
          onComplete()
        }}
        weather="rainThunder"
      />
    )
  }

  return (
    <DialogueScene
      lines={LINES_BEFORE}
      onComplete={() => setPhase('input')}
      onLineAdvance={handleLineAdvance}
      weather="rainThunder"
      fadeIn
    />
  )
}
