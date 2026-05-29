import { useRef } from 'react'
import { isSfxMuted } from '@/lib/sfx'
import introMp3 from '@/assets/music/1-intro.mp3'
import { useSceneFlow } from '../useSceneFlow'

export default function Intro({ onComplete }: { onComplete: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pressCount = useRef(0)

  function handleLineAdvance() {
    pressCount.current += 1
    if (pressCount.current === 1) {
      const audio = new Audio(introMp3)
      audio.volume = isSfxMuted() ? 0 : 0.6
      audio.play().catch(() => {})
      audioRef.current = audio
    }
  }

  const scene = useSceneFlow([
    {
      type: 'lines',
      fadeIn: true,
      onLineAdvance: handleLineAdvance,
      lines: [
        { speaker: 'Mysterious Voice', text: "Oh look what we have here." },
        { speaker: 'Mysterious Voice', text: 'No one is going to call you back.' },
        { speaker: 'Mysterious Voice', text: "Do you really think you're good enough for these roles?" },
        { speaker: 'Mysterious Voice', text: "You're one of 4 million other job hunters, what makes you so special?" },
      ],
    },
    {
      type: 'input',
      speaker: 'Mysterious Voice',
      prompt: "What's your name anyways?",
      placeholder: 'enter your name',
      maxLength: 24,
      storyInputIndex: 0,
      userMetaKey: 'username',
    },
    {
      type: 'lines',
      lines: (inputs) => [
        { speaker: 'Mysterious Voice', text: 'Come talk to me when you have more experience.' },
        { speaker: 'Mysterious Voice', text: `Get it, ${inputs[0]}? More experience? HAHA` },
      ],
    },
  ], { weather: 'rainThunder' })

  return <>{scene.node(() => { audioRef.current?.pause(); onComplete() })}</>
}
