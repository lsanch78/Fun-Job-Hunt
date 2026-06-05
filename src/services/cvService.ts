import { supabase } from '@/lib/supabase'
import type { MainInfo }      from '@/components/mastercv/MainInfoCard'
import type { Experience }    from '@/components/mastercv/ExperienceCard'
import type { Education }     from '@/components/mastercv/EducationCard'
import type { Project }       from '@/components/mastercv/ProjectCard'
import type { SkillsBucket }  from '@/components/mastercv/SkillsBucketCard'
import type { Summary }       from '@/components/mastercv/SummaryCard'
import type { Certification } from '@/components/mastercv/CertificationCard'
import type { Award }         from '@/components/mastercv/AwardCard'

export interface CVContent {
  mainInfo:       MainInfo
  experiences:    Experience[]
  educations:     Education[]
  projects:       Project[]
  skills:         SkillsBucket | null
  summaries:      Summary[]
  certifications: Certification[]
  awards:         Award[]
}

export async function fetchCV(
  userId: string,
): Promise<{ content: CVContent; sectionOrder: string[] } | null> {
  const { data, error } = await supabase
    .from('master_cv')
    .select('content, section_order')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return {
    content:      data.content       as CVContent,
    sectionOrder: data.section_order as string[],
  }
}

export async function upsertCV(
  userId: string,
  content: CVContent,
  sectionOrder: string[],
): Promise<void> {
  const { error } = await supabase
    .from('master_cv')
    .upsert(
      { user_id: userId, content, section_order: sectionOrder, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) console.error('[cvService] upsert:', error.message)
}
