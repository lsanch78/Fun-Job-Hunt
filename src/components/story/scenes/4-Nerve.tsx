import { useRef, useEffect, useState } from 'react'
import { isSfxMuted, startThudAmbience } from '@/lib/sfx'
import nerveMp3 from '@/assets/music/2-nerve.mp3'
import { useSceneFlow } from '../useSceneFlow'
import { supabase } from '@/lib/supabase'
import { countJobs } from '@/services/jobService'
import { getStoryInput } from '@/services/storyInputService'

interface Stats { appCount: number; contactCount: number; name: string }

export default function Nerve({ onComplete }: { onComplete: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('fjobhunt:music-fade'))
    return () => { window.dispatchEvent(new CustomEvent('fjobhunt:music-resume')) }
  }, [])

  // Start music + ambient typing on mount
  useEffect(() => {
    const audio = new Audio(nerveMp3)
    audio.volume = isSfxMuted() ? 0 : 0.6
    audio.currentTime = 4.3
    audio.play().catch(() => {})
    audioRef.current = audio
    const stopTyping = startThudAmbience()
    return () => { audio.pause(); stopTyping() }
  }, [])

  // Fetch app + contact counts
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const [appCount, { count }] = await Promise.all([
        countJobs(user.id),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ])
      const name = getStoryInput(user.id, 0)
      setStats({ appCount, contactCount: count ?? 0, name })
    })
  }, [])

  const scene = useSceneFlow([
    {
      type: 'lines',
      fadeIn: true,
      lines: stats === null ? [] : [
        { speaker: 'Mysterious Voice', text: "You're still here?" },
        { speaker: 'Mysterious Voice', text: "I didn't think you'd make it this far." },
        { speaker: 'Mysterious Voice', text: "Lets see here... " },
        { speaker: 'Mysterious Voice', text: `${stats.appCount} applications and ${stats.contactCount} contacts so far?` },
        { speaker: 'Mysterious Voice', text: "Hey you're doing great so far." },
        { speaker: 'Mysterious Voice', text: "HAHAHA" },
        { speaker: 'Mysterious Voice', text: "JUST KIDDING!" },
        { speaker: 'Mysterious Voice', text: `See you around ${stats.name}.` }, 
        { speaker: 'Mysterious Voice', text: `Hah ${stats.appCount} applications having ass...` },
      ],
    },
  ], { weather: 'resumeStorm' })

  if (stats === null) return null

  return <>{scene.node(() => { audioRef.current?.pause(); onComplete() })}</>
}
