import { useState, useEffect, useCallback } from 'react'
import { XP, RANK_THRESHOLDS, RANK_TITLES } from '@/config/game'
import { supabase } from '@/lib/supabase'
import { lsGet, lsSet, lsRemove } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'

// Returns the XP delta for committing the nth job (1-indexed).
// Every 10th job earns a double award.
export function xpForJob(newCount: number): number {
  return newCount % 10 === 0 ? XP.ADD_JOB * 2 : XP.ADD_JOB
}


export async function awardXp(userId: string, delta: number, onOptimistic?: (delta: number) => void): Promise<void> {
  onOptimistic?.(delta)
  const { error } = await supabase.rpc('increment_xp', { p_user_id: userId, p_delta: delta })
  if (error) console.error('[xpService] awardXp:', error.message)
}

export async function resetProfileXp(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('game_progress')
    .upsert({ user_id: userId, xp: 0, updated_at: new Date().toISOString() })
  if (error) console.error('[xpService] resetProfileXp:', error.message)
  // Remove both the new key and the legacy key (xp:${userId} → fjobhunt:xp:${userId})
  lsRemove(SK.xp(userId))
  lsRemove(`xp:${userId}`)
  return { error: error?.message ?? null }
}

function readXpCache(userId: string): number | null {
  // Check new key first, fall back to legacy key from before the rename
  const fromNew = lsGet<number | null>(SK.xp(userId), null)
  if (fromNew !== null) return fromNew
  const fromLegacy = lsGet<number | null>(`xp:${userId}`, null)
  return fromLegacy
}

function writeXpCache(userId: string, xp: number): void {
  lsSet(SK.xp(userId), xp)
}

export function useXp(userId: string | null): { xp: number | null; bumpXp: (delta: number) => void } {
  const [xp, setXp] = useState<number | null>(() => userId ? readXpCache(userId) : null)

  useEffect(() => {
    if (!userId) return

    supabase
      .from('game_progress')
      .select('xp')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setXp(data.xp)
          writeXpCache(userId, data.xp)
        }
      })

    const channel = supabase
      .channel(`game_progress:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_progress',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new as { xp?: number }
        if (typeof row.xp === 'number') {
          setXp(row.xp)
          writeXpCache(userId, row.xp)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const bumpXp = useCallback((delta: number) => setXp(x => {
    const next = (x ?? 0) + delta
    if (userId) writeXpCache(userId, next)
    return next
  }), [userId])

  return { xp, bumpXp }
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
