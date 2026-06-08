import { useState, useEffect, useCallback } from 'react'
import { fetchXp, subscribeToXp } from '@/services/xpService'
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

    fetchXp(userId).then((value) => {
      if (value !== null) {
        setXp(value)
        writeXpCache(userId, value)
      }
    })

    const channel = subscribeToXp(userId, (value) => {
      setXp(value)
      writeXpCache(userId, value)
    })

    return () => { channel.unsubscribe() }
  }, [userId])

  const bumpXp = useCallback((delta: number) => setXp(x => {
    const next = (x ?? 0) + delta
    if (userId) writeXpCache(userId, next)
    return next
  }), [userId])

  return { xp, bumpXp }
}
