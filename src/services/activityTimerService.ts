import { supabase } from '@/lib/supabase'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import type { ActivityHeartbeat } from '@/types'

// ── Cache ─────────────────────────────────────────────────────────────────────

export function readHeartbeatCache(userId: string): ActivityHeartbeat[] {
  const parsed = lsGet<unknown>(SK.activityHeartbeats(userId), [])
  return Array.isArray(parsed) ? (parsed as ActivityHeartbeat[]) : []
}

function writeHeartbeatCache(userId: string, rows: ActivityHeartbeat[]): void {
  lsSet(SK.activityHeartbeats(userId), rows)
}

// ── insertHeartbeat ───────────────────────────────────────────────────────────

export async function insertHeartbeat(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('activity_heartbeats')
    .insert({ user_id: userId })
    .select('id')
    .single()

  if (error) {
    console.error('[activityTimerService] insertHeartbeat:', error.message)
    return null
  }

  return (data as { id: string }).id
}

// ── fetchHeartbeats ───────────────────────────────────────────────────────────

export async function fetchHeartbeats(userId: string): Promise<ActivityHeartbeat[]> {
  const { data, error } = await supabase
    .from('activity_heartbeats')
    .select('id,user_id,ts')
    .eq('user_id', userId)
    .order('ts', { ascending: false })

  if (error) {
    console.error('[activityTimerService] fetchHeartbeats:', error.message)
    return []
  }

  const rows = data as ActivityHeartbeat[]
  writeHeartbeatCache(userId, rows)
  return rows
}

// ── deleteAllHeartbeats ───────────────────────────────────────────────────────

export async function deleteAllHeartbeats(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('activity_heartbeats')
    .delete()
    .eq('user_id', userId)

  if (error) console.error('[activityTimerService] deleteAllHeartbeats:', error.message)
  return { error: error?.message ?? null }
}
