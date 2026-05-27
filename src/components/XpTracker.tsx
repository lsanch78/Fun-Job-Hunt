import { useEffect, useRef } from 'react'
import { RANK_THRESHOLDS, RANK_TITLES } from '@/config/game'
import { playLevelUp } from '@/lib/sfx'

export function getRankInfo(xp: number) {
  let rank = 1
  for (let i = 1; i < RANK_THRESHOLDS.length; i++) {
    if (xp >= RANK_THRESHOLDS[i]) rank = i
    else break
  }
  const isMax = rank >= RANK_THRESHOLDS.length - 1
  const currentFloor = RANK_THRESHOLDS[rank]
  const nextFloor = isMax ? currentFloor : RANK_THRESHOLDS[rank + 1]
  const progress = isMax ? 1 : (xp - currentFloor) / (nextFloor - currentFloor)
  return { rank, title: RANK_TITLES[rank] ?? '', progress, xp, nextFloor, isMax }
}

const avatarChars = ['◉', '◈', '◆', '▣', '★', '✦', '⬡', '⬟', '◉', '✸', '✺']

export default function XpTracker({ xp }: { xp: number }) {
  const { rank, title, progress, nextFloor, isMax } = getRankInfo(xp)
  const barPct = Math.round(progress * 100)
  const prevRankRef = useRef(rank)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      prevRankRef.current = rank
      return
    }
    if (rank > prevRankRef.current) playLevelUp()
    prevRankRef.current = rank
  }, [rank])

  const avatarChar = avatarChars[(rank - 1) % avatarChars.length]

  return (
    <div className="flex items-center gap-3 border border-border px-4 py-2.5 bg-surface font-pixel">
      <div className="text-2xl leading-none text-secondary select-none" title={`Rank ${rank}`}>
        {avatarChar}
      </div>
      <div className="flex flex-col gap-1 w-[200px]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-secondary text-[11px] tracking-widest uppercase leading-none">
            LVL {rank}
          </span>
          <span className="text-muted text-[9px] leading-none">
            {isMax ? 'MAX' : `${xp} / ${nextFloor} XP`}
          </span>
        </div>
        <div className="text-primary text-[9px] leading-tight">
          {title}
        </div>
        <div className="w-full h-1.5 bg-border">
          <div
            className="h-full bg-secondary transition-all duration-500"
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
