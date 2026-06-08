import { useEffect, useRef } from 'react'
import { playLevelUp } from '@/lib/sfx'
import { getRankInfo } from '@/services/xpService'

const avatarChars = ['◉', '◈', '◆', '▣', '★', '✦', '⬡', '⬟', '◉', '✸', '✺']

export default function XpTracker({ xp }: { xp: number | null }) {
  const loaded = xp !== null
  const { rank, title, progress, nextFloor, isMax } = getRankInfo(xp ?? 0)
  const barPct = Math.round(progress * 100)
  const prevRankRef = useRef<number | null>(null)

  useEffect(() => {
    if (!loaded) return
    if (prevRankRef.current === null) {
      prevRankRef.current = rank
      return
    }
    if (rank > prevRankRef.current) playLevelUp()
    prevRankRef.current = rank
  }, [rank, loaded])

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
