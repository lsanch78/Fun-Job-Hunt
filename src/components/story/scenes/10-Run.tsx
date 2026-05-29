import { useEffect, useRef, useState } from 'react'
import { isSfxMuted } from '@/lib/sfx'
import runMp3 from '@/assets/music/4-run.mp3'
import { useSceneFlow } from '../useSceneFlow'
import { supabase } from '@/lib/supabase'
import { readWorkdayCache } from '@/services/workdayService'

interface TimeStats {
  days: number
  hours: number
  workedHours: number
}

function calcTimeStats(createdAt: string, workdays: { punch_in: string; punch_out: string | null }[]): TimeStats {
  const start = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  const totalHours = diffMs / (1000 * 60 * 60)
  const days = Math.floor(totalHours / 24)
  const hours = Math.floor(totalHours % 24)
  const workedMs = workdays.reduce((sum, w) => {
    if (!w.punch_out) return sum
    return sum + (new Date(w.punch_out).getTime() - new Date(w.punch_in).getTime())
  }, 0)
  return { days, hours, workedHours: Math.floor(workedMs / (1000 * 60 * 60)) }
}

export default function Run({ onComplete }: { onComplete: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [timeStats, setTimeStats] = useState<TimeStats | null>(null)

  useEffect(() => {
    const audio = new Audio(runMp3)
    audio.volume = isSfxMuted() ? 0 : 0.6
    audio.currentTime = 31
    audio.play().catch(() => {})
    audioRef.current = audio
    return () => { audio.pause() }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setTimeStats(calcTimeStats(user.created_at, readWorkdayCache(user.id)))
    })
  }, [])

  const scene = useSceneFlow([
    {
      type: 'lines',
      fadeIn: true,
      lines: timeStats === null ? [] : [
        { speaker: 'Time', text: `It's been ${timeStats.days} days and ${timeStats.hours} hours since you started.` },
        { speaker: 'Time', text: `You've worked for ${timeStats.workedHours} hours since starting your job hunt.` },
        { speaker: 'Time', text: "I think you've got enough time, right?" },
      ],
    },
  ], { weather: 'resumeTimePassing' })

  if (timeStats === null) return null

  return <>{scene.node(() => { audioRef.current?.pause(); onComplete() })}</>
}
