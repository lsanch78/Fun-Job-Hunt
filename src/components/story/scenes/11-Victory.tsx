import congratulationsMp3 from '@/assets/music/11-victory.mp3'
import ScrollingTextCutscene from './6-Movement'

const SCROLL_DURATION = 55000

const CREDITS_TEXT = [
  '— Fun Job Hunt —',
  '',
  '',
  'Original Music by Farewell Blu for Intro, Mid-game, and Victory themes',
  '',
  '',
  'FROM THE DEV',
  '',
  'Hi! Congratulations on your successful job hunt!',
  '',
  'I worked food and beverage for 10 years before pursuing a software engineering degree at ASU and my biggest takeaway from that experience was that a little bit of dignity in the process goes a long way.',
  'I made this app to help me navigate my first "office" job hunting experience in a way that felt fun and rewarding.',
  'If it brought you joy in any capacity, please reach out. I\'m always happy to make a new friend!',
  '',
  'Thank you,',
  'Luis'
]

export function Victory({ onComplete }: { onComplete: () => void }) {
  return (
    <ScrollingTextCutscene
      lines={CREDITS_TEXT}
      audioSrc={congratulationsMp3}
      duration={SCROLL_DURATION}
      onComplete={onComplete}
      fadeIn
    />
  )
}
