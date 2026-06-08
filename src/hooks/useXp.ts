import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'

function readXpCache(userId: string): number | null {
  const fromNew = lsGet<number | null>(SK.xp(userId), null)
  if (fromNew !== null) return fromNew
  return lsGet<number | null>(`xp:${userId}`, null)
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
