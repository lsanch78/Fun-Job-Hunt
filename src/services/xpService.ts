import { XP, RANK_THRESHOLDS, RANK_TITLES } from '@/config/game'

// ── XP formula ────────────────────────────────────────────────────────────────
//
// Base:  each committed job earns XP.ADD_JOB
// Bonus: every 10th job earns an extra XP.ADD_JOB (the "mega milestone")
//
// xp = jobs * ADD_JOB + floor(jobs / 10) * ADD_JOB

export function calculateXp(committedJobCount: number): number {
  const base = committedJobCount * XP.ADD_JOB
  const bonus = Math.floor(committedJobCount / 10) * XP.ADD_JOB
  return base + bonus
}

// ── Rank info ─────────────────────────────────────────────────────────────────

export interface RankInfo {
  rank: number
  title: string
  progress: number
  xp: number
  nextFloor: number
  isMax: boolean
}

export function getRankInfo(xp: number): RankInfo {
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
