import { supabase } from '@/lib/supabase'
import type { MusicTrack } from '@/types'

interface DbRow {
  id: string
  user_id: string
  url: string
  video_id: string
  title: string
  position: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToTrack(row: DbRow): MusicTrack {
  return { id: row.id, url: row.url, videoId: row.video_id, title: row.title, position: row.position }
}

// ── API ───────────────────────────────────────────────────────────────────────

export async function fetchTracks(userId: string): Promise<MusicTrack[]> {
  const { data, error } = await supabase
    .from('music_tracks')
    .select('id, user_id, url, video_id, title, position')
    .eq('user_id', userId)
    .order('position', { ascending: true })
  if (error) {
    console.error('[musicService] fetchTracks:', error.message)
    return []
  }
  return (data as DbRow[]).map(rowToTrack)
}

/** Insert a new track; returns the real DB id or null on failure. */
export async function createTrack(
  userId: string,
  track: Omit<MusicTrack, 'id'>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('music_tracks')
    .insert({ user_id: userId, url: track.url, video_id: track.videoId, title: track.title, position: track.position })
    .select('id')
    .single()
  if (error) {
    console.error('[musicService] createTrack:', error.message)
    return null
  }
  return (data as { id: string }).id
}

/** Rename a track. */
export async function renameTrack(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('music_tracks').update({ title }).eq('id', id)
  if (error) console.error('[musicService] renameTrack:', error.message)
}

/** Delete a track by id. */
export async function deleteTrack(id: string): Promise<void> {
  const { error } = await supabase.from('music_tracks').delete().eq('id', id)
  if (error) console.error('[musicService] deleteTrack:', error.message)
}

/** Delete all tracks for a user. */
export async function deleteAllTracks(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('music_tracks').delete().eq('user_id', userId)
  if (error) console.error('[musicService] deleteAllTracks:', error.message)
  return { error: error?.message ?? null }
}
