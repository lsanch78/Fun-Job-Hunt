import { useEffect, useRef, useState } from 'react'
import { isSfxMuted } from '@/lib/sfx'
import runMp3 from '@/assets/music/4-run.mp3'
import { useSceneFlow } from '../useSceneFlow'
import { supabase } from '@/lib/supabase'
import { readWorkdayCache } from '@/services/workdayService'
import { readCache } from '@/services/jobService'

interface RunStats {
  days: number
  hours: number
  workedHours: number
  appCount: number
  rejections: number
  ghosted: number
  interviews: number
  offers: number
}

function calcStats(
  userId: string,
  createdAt: string,
  workdays: { punch_in: string; punch_out: string | null }[]
): RunStats {
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
  const jobs = readCache(userId)
  return {
    days,
    hours,
    workedHours: Math.floor(workedMs / (1000 * 60 * 60)),
    appCount: jobs.length,
    rejections: jobs.filter(j => j.status === 'REJECTED').length,
    ghosted: jobs.filter(j => j.status === 'GHOSTED').length,
    interviews: jobs.filter(j => j.status === 'INTERVIEW').length,
    offers: jobs.filter(j => j.status === 'OFFER').length,
  }
}

export default function Run({ onComplete }: { onComplete: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [stats, setStats] = useState<RunStats | null>(null)

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('fjobhunt:music-fade'))
    return () => window.dispatchEvent(new CustomEvent('fjobhunt:music-resume'))
  }, [])

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
      setStats(calcStats(user.id, user.created_at, readWorkdayCache(user.id)))
    })
  }, [])

  const scene = useSceneFlow([
    {
      type: 'lines',
      fadeIn: true,
      lines: stats === null ? [] : [
        { speaker: 'Time', text: `It's been ${stats.days} days and ${stats.hours} hours since you started.` },
        { speaker: 'Time', text: `You've put in ${stats.workedHours} hours of actual work.` },
        { speaker: 'Time', text: `${stats.appCount} applications sent.` },
        ...(stats.rejections > 0 ? [{ speaker: 'Time', text: `${stats.rejections} rejection${stats.rejections === 1 ? '' : 's'}.` }] : []),
        ...(stats.ghosted > 0 ? [{ speaker: 'Time', text: `${stats.ghosted} ghosted you.` }] : []),
        ...(stats.interviews > 0 ? [{ speaker: 'Time', text: `${stats.interviews} interview${stats.interviews === 1 ? '' : 's'} though.` }] : []),
        ...(stats.offers > 0 ? [{ speaker: 'Time', text: `And ${stats.offers} offer${stats.offers === 1 ? '' : 's'}.` }] : []),
        { speaker: 'Time', text: "And the yarn of time unwinds..." },
      ],
    },
    {
      type: 'choice',
      speaker: 'You',
      prompt: '',
      options: [
        "I'm sorry did you just say YARN of time? why yarn?",
        "*Ignore the weird metaphor*",
      ],
      storyInputIndex: 1,
    },
    {
      type: 'lines',
      lines: (inputs) => inputs[0] === "I'm sorry did you just say YARN of time? why yarn?" ? [
        { speaker: 'Time', text: "..." },
        { speaker: 'Time', text: "I thought it was poetic." },
        { speaker: 'You', text: "It's not." },
        { speaker: 'Time', text: "Anyways." },
        { speaker: 'Time', text: "I was going to say..." },
        { speaker: 'Time', text: "The yarn of time unwinds so that grandma can knit.." },
      ] : [
        { speaker: 'Time', text: "The yarn of time unwinds so that grandma can knit.." },
      ],
    },
    {
      type: 'choice',
      speaker: 'You',
      prompt: '',
      options: [
        "DUDE GET TO THE POINT!",
        "ARE YOU GONNA HELP ME GET A JOB OR NOT!?",
        "bro.. i'm just like straight chillin and your energy is just like.. messing with me",
        "anus",
      ],
      storyInputIndex: 2,
    },
    {
      type: 'lines',
      lines: (inputs) => {
        const reply = inputs[1]
        if (reply === "DUDE GET TO THE POINT!")
          return [
            { speaker: 'Time', text: "The point IS—" },
            { speaker: 'Time', text: "You're still here." },
            { speaker: 'Time', text: "That's the point." },
          ]
        if (reply === "ARE YOU GONNA HELP ME GET A JOB OR NOT!?")
          return [
            { speaker: 'Time', text: "No." },
            { speaker: 'Time', text: "That's not really my thing." },
            { speaker: 'Time', text: "I just sort of chill here dawg." },
            { speaker: 'Time', text: "You do the rest." },
          ]
        if (reply === "bro.. i'm just like straight chillin and your energy is just like.. messing with me")
          return [
            { speaker: 'Time', text: "my bad g" },
            { speaker: 'Time', text: "i'll just like chill out with the whole omnipotence thing" },
          ]
        return [
          { speaker: 'Time', text: "? Anus?" },
          { speaker: 'Time', text: "Who told you my name?" },
          { speaker: 'Anus Jr. III', text: "I really shouldn't be telling you this but.." },
          { speaker: 'Anus Jr. III', text: "I am Anus Jr. III. son of Anus II. grandchild of Anus I." },
          { speaker: 'Anus Jr. III', text: "I am the lord of the underworld. I control the flow of time and space." },
          { speaker: 'Anus Jr. III', text: "I grant you passage to the afterlife, but only if you can answer my riddle." },
          { speaker: 'Anus Jr. III', text: "What has no head, no tail, is brown, and lives within you and outside you?" },
          { speaker: 'You', text: "Anus?" },
          { speaker: 'Anus Jr. III', text: "Yes. You got it... congrats." },
          { speaker: 'Anus Jr. III', text: "Even though I gave you passage you still have to get a job. But hey, at least you have access to the afterlife. So that's pretty cool!" },
        ]
      },
    },
    {
      type: 'lines',
      lines: [
        { speaker: 'Time', text: "Yeah well.. Just like idk take care of your time and stuff i guess. cause you only get one life you know? so yeah really go for it" },
        { speaker: 'You', text: "Wow great advice. truly inspiring is that it?" },
        { speaker: 'Time', text: "Is what it?" },
        { speaker: 'You', text: "like the game? is that the whole point of this game?" },
        { speaker: 'Time', text: "Oh that. Yeah I guess that is it." },
        { speaker: 'Time', text: "Yeah I really doubt anyone would get this far so yeah it just kinda ends" },
        { speaker: 'Time', text: "mb lil bro" },
      ],
    },
  ], { weather: 'resumeTimePassing' })

  if (stats === null) return null

  return <>{scene.node(() => { audioRef.current?.pause(); onComplete() })}</>
}
