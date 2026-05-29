import { supabase } from '@/lib/supabase'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GlobalStats {
  hunters:           number   // users actively job-hunting
  employed:          number   // users who landed an offer
  interviews:        number   // total interview-stage events
  avg_interview_rate: number | null  // platform avg interview conversion %
  avg_days_to_offer: number | null   // platform avg days to first offer
  total_apps:        number   // total applications across all users
}

// ── Cache ─────────────────────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes in ms

interface CachedStats {
  stats:      GlobalStats
  fetchedAt:  number  // Date.now()
}

function readStatsCache(): GlobalStats | null {
  const cached = lsGet<CachedStats | null>(SK.globalStats, null)
  if (!cached) return null
  if (Date.now() - cached.fetchedAt < CACHE_TTL) return cached.stats
  return null  // expired
}

function writeStatsCache(stats: GlobalStats): void {
  lsSet(SK.globalStats, { stats, fetchedAt: Date.now() })
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchFromDb(): Promise<GlobalStats | null> {
  const { data, error } = await supabase.rpc('get_global_stats')
  if (error) {
    console.error('[globalStatsService] fetch failed:', error.message)
    return null
  }
  return data as GlobalStats
}

/**
 * Returns global stats, serving from a 5-minute localStorage cache.
 * Falls back to stale cache on DB error so the marquee never goes blank.
 */
export async function getGlobalStats(): Promise<GlobalStats | null> {
  const cached = readStatsCache()
  if (cached) return cached

  const fresh = await fetchFromDb()
  if (fresh) {
    writeStatsCache(fresh)
    return fresh
  }

  // DB failed — try returning stale cache rather than nothing
  const stale = lsGet<CachedStats | null>(SK.globalStats, null)
  if (stale) return stale.stats

  return null
}

// ── Background poller ─────────────────────────────────────────────────────────
let _pollTimer: ReturnType<typeof setInterval> | null = null

/**
 * Starts a background interval that refreshes the cache every 5 minutes.
 * Safe to call multiple times — only one interval runs at a time.
 * Returns a cleanup function to stop polling.
 */
export function startStatsPoll(onUpdate: (stats: GlobalStats) => void): () => void {
  if (_pollTimer !== null) stopStatsPoll()

  // Immediate first fetch
  getGlobalStats().then((s) => { if (s) onUpdate(s) })

  _pollTimer = setInterval(async () => {
    // Force a fresh DB fetch by bypassing the cache check
    const fresh = await fetchFromDb()
    if (fresh) {
      writeStatsCache(fresh)
      onUpdate(fresh)
    }
  }, CACHE_TTL)

  return stopStatsPoll
}

export function stopStatsPoll(): void {
  if (_pollTimer !== null) {
    clearInterval(_pollTimer)
    _pollTimer = null
  }
}
