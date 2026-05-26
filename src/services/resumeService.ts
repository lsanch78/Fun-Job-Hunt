import { supabase } from '@/lib/supabase'

export type ResumeSlot = 'a' | 'b' | 'c'

export interface ResumeSlotRecord {
  id: string
  user_id: string
  slot: ResumeSlot
  name: string
  uploaded_at: string
}

export async function fetchResumeSlots(userId: string): Promise<ResumeSlotRecord[]> {
  const { data, error } = await supabase
    .from('resume_slots')
    .select('*')
    .eq('user_id', userId)
    .order('slot')
  if (error) {
    console.error('[resumeService] fetchResumeSlots:', error.message)
    return []
  }
  return (data ?? []) as ResumeSlotRecord[]
}

export async function upsertResumeSlot(
  userId: string,
  slot: ResumeSlot,
  name: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('resume_slots')
    .upsert(
      { user_id: userId, slot, name, uploaded_at: new Date().toISOString() },
      { onConflict: 'user_id,slot' },
    )
  if (error) {
    console.error('[resumeService] upsertResumeSlot:', error.message)
    return { error: error.message }
  }
  return { error: null }
}

export async function deleteResumeSlot(
  userId: string,
  slot: ResumeSlot,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('resume_slots')
    .delete()
    .eq('user_id', userId)
    .eq('slot', slot)
  if (error) {
    console.error('[resumeService] deleteResumeSlot:', error.message)
    return { error: error.message }
  }
  return { error: null }
}

export function resumeStoragePath(userId: string, slot: ResumeSlot, ext = 'pdf'): string {
  return `${userId}/resume_${slot}.${ext}`
}

export async function getResumeSignedUrl(
  userId: string,
  slot: ResumeSlot,
): Promise<string | null> {
  // Try docx first, fall back to pdf
  for (const ext of ['docx', 'pdf']) {
    const path = resumeStoragePath(userId, slot, ext)
    const { data } = await supabase.storage
      .from('resumes')
      .createSignedUrl(path, 3600)
    if (data?.signedUrl) return data.signedUrl
  }
  console.error('[resumeService] getResumeSignedUrl: no file found for slot', slot)
  return null
}

const MAX_RESUME_BYTES = 1 * 1024 * 1024 // 1 MB — see docs/SCALABILITY.md

const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

export async function uploadResumePdf(
  userId: string,
  slot: ResumeSlot,
  file: File,
): Promise<{ error: string | null }> {
  const ext = ALLOWED_MIME[file.type]
  if (!ext) return { error: 'Only PDF and DOCX files are supported.' }
  if (file.size > MAX_RESUME_BYTES) {
    return { error: 'Resume must be 1 MB or smaller. Try exporting at a lower quality or removing embedded images.' }
  }
  // Remove the other format if it exists so signed-URL lookup doesn't return a stale file
  const otherExt = ext === 'pdf' ? 'docx' : 'pdf'
  await supabase.storage.from('resumes').remove([resumeStoragePath(userId, slot, otherExt)])

  const path = resumeStoragePath(userId, slot, ext)
  const { error } = await supabase.storage
    .from('resumes')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) {
    console.error('[resumeService] uploadResumePdf:', error.message)
    return { error: error.message }
  }
  return { error: null }
}

export async function deleteResumePdf(
  userId: string,
  slot: ResumeSlot,
): Promise<{ error: string | null }> {
  const paths = ['pdf', 'docx'].map((ext) => resumeStoragePath(userId, slot, ext))
  const { error } = await supabase.storage.from('resumes').remove(paths)
  if (error) {
    console.error('[resumeService] deleteResumePdf:', error.message)
    return { error: error.message }
  }
  return { error: null }
}
