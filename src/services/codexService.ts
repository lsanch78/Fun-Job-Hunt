import { supabase } from '@/lib/supabase'
import type { MainInfo }      from '@/components/mastercodex/MainInfoCard'
import type { Experience }    from '@/components/mastercodex/ExperienceCard'
import type { Education }     from '@/components/mastercodex/EducationCard'
import type { Project }       from '@/components/mastercodex/ProjectCard'
import type { SkillsBucket }  from '@/components/mastercodex/SkillsBucketCard'
import type { Summary }       from '@/components/mastercodex/SummaryCard'
import type { Certification } from '@/components/mastercodex/CertificationCard'
import type { Award }         from '@/components/mastercodex/AwardCard'

export interface CodexContent {
  mainInfo:       MainInfo
  experiences:    Experience[]
  educations:     Education[]
  projects:       Project[]
  skills:         SkillsBucket | null
  summaries:      Summary[]
  certifications: Certification[]
  awards:         Award[]
}

export async function fetchCodex(
  userId: string,
): Promise<{ content: CodexContent; sectionOrder: string[] } | null> {
  const { data, error } = await supabase
    .from('master_codex')
    .select('content, section_order')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return {
    content:      data.content       as CodexContent,
    sectionOrder: data.section_order as string[],
  }
}

export async function upsertCodex(
  userId: string,
  content: CodexContent,
  sectionOrder: string[],
): Promise<void> {
  const { error } = await supabase
    .from('master_codex')
    .upsert(
      { user_id: userId, content, section_order: sectionOrder, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) console.error('[codexService] upsert:', error.message)
}
