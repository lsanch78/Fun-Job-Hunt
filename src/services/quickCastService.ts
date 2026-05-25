import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuickCastLink {
  id: string
  label: string
  url: string
  icon: string
  position: number
}

interface DbRow {
  id: string
  user_id: string
  label: string
  url: string
  icon: string
  position: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToLink(row: DbRow): QuickCastLink {
  return { id: row.id, label: row.label, url: row.url, icon: row.icon, position: row.position }
}

// ── API ───────────────────────────────────────────────────────────────────────

/** Fetch all links for the signed-in user, ordered by position. */
export async function fetchLinks(userId: string): Promise<QuickCastLink[]> {
  const { data, error } = await supabase
    .from('quick_cast_links')
    .select('id, user_id, label, url, icon, position')
    .eq('user_id', userId)
    .order('position', { ascending: true })
  if (error) {
    console.error('[quickCastService] fetchLinks:', error.message)
    return []
  }
  return (data as DbRow[]).map(rowToLink)
}

/** Insert a new link; returns the created row id or null on failure. */
export async function createLink(
  userId: string,
  link: Omit<QuickCastLink, 'id'>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('quick_cast_links')
    .insert({ user_id: userId, label: link.label, url: link.url, icon: link.icon, position: link.position })
    .select('id')
    .single()
  if (error) {
    console.error('[quickCastService] createLink:', error.message)
    return null
  }
  return (data as { id: string }).id
}

/** Update label, url, icon, and position for an existing link. */
export async function updateLink(link: QuickCastLink): Promise<void> {
  const { error } = await supabase
    .from('quick_cast_links')
    .update({ label: link.label, url: link.url, icon: link.icon, position: link.position })
    .eq('id', link.id)
  if (error) console.error('[quickCastService] updateLink:', error.message)
}

/** Delete a link by id. */
export async function deleteLink(id: string): Promise<void> {
  const { error } = await supabase.from('quick_cast_links').delete().eq('id', id)
  if (error) console.error('[quickCastService] deleteLink:', error.message)
}

/** Replace all positions after a reorder. Fire-and-forget bulk update. */
export async function reorderLinks(links: QuickCastLink[]): Promise<void> {
  const updates = links.map((l, i) =>
    supabase
      .from('quick_cast_links')
      .update({ position: i })
      .eq('id', l.id),
  )
  await Promise.all(updates)
}
