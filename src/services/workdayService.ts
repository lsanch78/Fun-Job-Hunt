import { supabase } from '@/lib/supabase'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import type { WorkdayRow } from '@/types'

// ── Cache ─────────────────────────────────────────────────────────────────────
export function readWorkdayCache(userId: string): WorkdayRow[] {
  const parsed = lsGet<unknown>(SK.workdays(userId), [])
  return Array.isArray(parsed) ? (parsed as WorkdayRow[]) : []
}

function writeWorkdayCache(userId: string, rows: WorkdayRow[]): void {
  lsSet(SK.workdays(userId), rows)
}

// Insert a new workday row when the user punches in.
// Returns the new row's id (needed to close it on punch-out), or null on error.
export async function startWorkday(userId: string, punchIn: Date): Promise<string | null> {
  const date = punchIn.toISOString().slice(0, 10) // YYYY-MM-DD in UTC; acceptable for grouping

  const { data, error } = await supabase
    .from('workdays')
    .insert({
      user_id:  userId,
      punch_in: punchIn.toISOString(),
      date,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[workdayService] startWorkday:', error.message)
    return null
  }

  return (data as { id: string }).id
}

// Update the punch_out timestamp on an existing workday row.
export async function endWorkday(workdayId: string, punchOut: Date): Promise<void> {
  const { error } = await supabase
    .from('workdays')
    .update({ punch_out: punchOut.toISOString() })
    .eq('id', workdayId)

  if (error) {
    console.error('[workdayService] endWorkday:', error.message, workdayId)
  }
}

export async function deleteAllWorkdays(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('workdays').delete().eq('user_id', userId)
  if (error) console.error('[workdayService] deleteAllWorkdays:', error.message)
  return { error: error?.message ?? null }
}

// Fetch all workday rows for a user, newest first.
export async function fetchWorkdays(userId: string): Promise<WorkdayRow[]> {
  const { data, error } = await supabase
    .from('workdays')
    .select('id,user_id,punch_in,punch_out,date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('punch_in', { ascending: false })

  if (error) {
    console.error('[workdayService] fetchWorkdays:', error.message)
    return []
  }

  const rows = data as WorkdayRow[]
  writeWorkdayCache(userId, rows)
  return rows
}
