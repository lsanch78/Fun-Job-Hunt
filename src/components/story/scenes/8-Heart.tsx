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
    window.dispatchEvent(new CustomEvent('fjobhunt:music-fade'))
    return () => window.dispatchEvent(new CustomEvent('fjobhunt:music-resume'))
  }, [])

  useEffect(() => {
    const audio = new Audio(heartMp3)
    audio.volume = 0
    audio.play().catch(() => {})
    audioRef.current = audio
    if (!isSfxMuted()) {
      const target = 0.6
      const step = target / 30
      const interval = setInterval(() => {
        if (audio.volume + step >= target) {
          audio.volume = target
          clearInterval(interval)
        } else {
          audio.volume += step
        }
      }, 50)
    }
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
        { speaker: 'Mysterious Voice', text: `Well well well if it isn't ${name}!` },
      ],
    },
    {
      type: 'choice',
      speaker: 'You',
      prompt: '',
      options: [
        'WHO ARE YOU!?',
        'WHAT DO YOU WANT!?',
        "Hey bro, look I'm just like.. trying to get a job and stuff, can you like not?",
        'Leave me alone!',
      ],
      storyInputIndex: 1,
    },
    {
      type: 'lines',
      lines: [
        { speaker: 'Mysterious Voice', text: `What the...` },
        { speaker: 'Mysterious Voice', text: `You can talk back to me?` },
        { speaker: 'Mysterious Voice', text: `Where's ${name}? What's going on?` },
        { speaker: 'Mysterious Voice', text: `Who are you?` }
      ],
    },
    {
      type: 'choice',
      speaker: 'You',
      prompt: '',
      options: [
        'ur mom',
        'Your worst nightmare',
        "I'm YOU (deals psychic damage)",
        "I don't know, but you need to leave me alone!",
      ],
      storyInputIndex: 2,
    },
    {
      type: 'lines',
      lines: [
        { speaker: 'Mysterious Voice', text: "Well this is awkward.." },
        { speaker: 'Mysterious Voice', text: "I didn't ever think you'd talk back so uhh..." },
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
      storyInputIndex: 3,
    },
    {
      type: 'lines',
      lines: (inputs) => [
        { speaker: 'Mysterious Voice', text: BRANCH_RESPONSES[inputs[2]] ?? '...' },
        { speaker: 'Mysterious Voice', text: "Well dang. guess I should tell you who I am now." },
      ],
    },
    {
      type: 'choice',
      speaker: 'You',
      prompt: '',
      options: [
        "I don't care dude",
        "Let me guess: You're me?",
      ],
      storyInputIndex: 4,
    },
    {
      type: 'lines',
      lines: (inputs) => inputs[3] === "I don't care dude" ? [
        { speaker: 'Mysterious Voice', text: "Well I'm ... YOU!" },
        { speaker: 'You', text: "... is that it?" },
        { speaker: 'You', text: "That was the big reveal?" },
        { speaker: 'Self-Doubt', text: "Yeah uhh.. well this is awkward" },
        { speaker: 'Self-Doubt', text: "It was supposed to be like a plot" },
        { speaker: 'You', text: "Plot twist?" },
        { speaker: 'Self-Doubt', text: "You keep stealing my thunder man." },
        { speaker: 'Self-Doubt', text: "AHEM... ANYWAYS" },
        { speaker: 'Self-Doubt', text: "I think we should work together instead of you know.. being mean to one another you know?" },
      ] : [
        { speaker: 'Mysterious Voice', text: "...." },
        { speaker: 'Mysterious Voice', text: `God Damnit, ${name}.` },
        { speaker: 'Self-Doubt', text: "How'd you know that?" },
        { speaker: 'Self-Doubt', text: `I think well maybe, if we worked together, we could be friends and ${BRANCH_GOALS[inputs[2]] ?? 'get there'}.` },
        { speaker: 'Self-Doubt', text: "Anyways, I'll see you around yea?" },
        { speaker: 'Self-Doubt', text: "*god they always just steal my thunder man*" },
      ],
    },
  ], { weather: 'heartwave' })

  if (name === null) return null

  return <>{scene.node(() => { audioRef.current?.pause(); onComplete() })}</>
}
