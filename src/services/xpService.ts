import { XP, RANK_THRESHOLDS, RANK_TITLES } from '@/config/game'
import { supabase } from '@/lib/supabase'
import { lsRemove } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import type { RealtimeChannel } from '@supabase/supabase-js'

export async function fetchXp(userId: string): Promise<number | null> {
  const { data } = await supabase
    .from('game_progress')
    .select('xp')
    .eq('user_id', userId)
    .single()
  return data ? (data.xp as number) : null
}

export function subscribeToXp(userId: string, onUpdate: (xp: number) => void): RealtimeChannel {
  return supabase
    .channel(`game_progress:${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'game_progress',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      const row = payload.new as { xp?: number }
      if (typeof row.xp === 'number') onUpdate(row.xp)
    })
    .subscribe()
}

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

export async function resetEmployed(userId: string): Promise<void> {
  await supabase.from('game_progress').upsert({ user_id: userId, employed: false })
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
