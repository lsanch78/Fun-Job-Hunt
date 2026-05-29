import { useEffect, useRef, useState } from 'react'
import { isSfxMuted } from '@/lib/sfx'
import heartMp3 from '@/assets/music/3-heart.mp3'
import { useSceneFlow } from '../useSceneFlow'
import { supabase } from '@/lib/supabase'
import { getStoryInput } from '@/services/storyInputService'

const BRANCH_RESPONSES: Record<string, string> = {
  'A better future':      "A better future... that's actually admirable.",
  'More money':           "Money. Honest answer. Nothing wrong with that.",
  'Less stress':          "Less stress. Yeah. This process isn't exactly helping with that.",
  'Hate my current job':  "You hate your current job. Well... at least you know what you want.",
}

const BRANCH_GOALS: Record<string, string> = {
  'A better future':      'build a better future',
  'More money':           'make more money',
  'Less stress':          'find something less stressful',
  'Hate my current job':  'get you out of that job',
}

export default function Heart({ onComplete }: { onComplete: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const audio = new Audio(heartMp3)
    audio.volume = isSfxMuted() ? 0 : 0.6
    audio.play().catch(() => {})
    audioRef.current = audio
    return () => { audio.pause() }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setName(user ? getStoryInput(user.id, 0) : '')
    })
  }, [])

  const scene = useSceneFlow([
    {
      type: 'lines',
      fadeIn: true,
      lines: name === null ? [] : [
        { speaker: 'Mysterious Voice', text: "..." },
        { speaker: 'Mysterious Voice', text: `Who is this version of you, ${name}?` },
        { speaker: 'Mysterious Voice', text: "I really didn't think you would be so persistent." },
        { speaker: 'Mysterious Voice', text: "What are you doing this for anyways?" },
      ],
    },
    {
      type: 'choice',
      speaker: 'Mysterious Voice',
      prompt: 'What are you doing this for anyways?',
      options: [
        'A better future',
        'More money',
        'Less stress',
        'Hate my current job',
      ],
      storyInputIndex: 1,
    },
    {
      type: 'lines',
      lines: (inputs) => [
        { speaker: 'Mysterious Voice', text: BRANCH_RESPONSES[inputs[0]] ?? '...' },
        { speaker: 'Mysterious Voice', text: "I guess I should tell you who I am now." },
        { speaker: 'Mysterious Voice', text: "...." },
        { speaker: 'Mysterious Voice', text: `I'm you, ${name}.` },
        { speaker: 'Self-Doubt', text: "I've always been here, gnawing away at you. You know that right?" },
        { speaker: 'Self-Doubt', text: `I think maybe, if we worked together, we could be friends and ${BRANCH_GOALS[inputs[0]] ?? 'get there'}.` },
        { speaker: 'Self-Doubt', text: "Anyways, I'll see you around yea? Don't be too hard on yourself." },
      ],
    },
  ], { weather: 'heartwave' })

  if (name === null) return null

  return <>{scene.node(() => { audioRef.current?.pause(); onComplete() })}</>
}
