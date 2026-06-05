import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchCV, upsertCV, type CVContent } from '@/services/cvService'
import type { MainInfo }      from '@/components/mastercv/MainInfoCard'
import type { Experience }    from '@/components/mastercv/ExperienceCard'
import type { Education }     from '@/components/mastercv/EducationCard'
import type { Project }       from '@/components/mastercv/ProjectCard'
import type { SkillsBucket }  from '@/components/mastercv/SkillsBucketCard'
import type { Summary }       from '@/components/mastercv/SummaryCard'
import type { Certification } from '@/components/mastercv/CertificationCard'
import type { Award }         from '@/components/mastercv/AwardCard'

const EMPTY_MAIN: MainInfo = {
  fullName: '', jobTitle: '', email: '', phone: '',
  location: '', website: '', linkedin: '', github: '',
}

export interface CVState {
  mainInfo:       MainInfo
  experiences:    Experience[]
  educations:     Education[]
  projects:       Project[]
  skills:         SkillsBucket | null
  summaries:      Summary[]
  certifications: Certification[]
  awards:         Award[]
  collapsed:      Record<string, boolean>

  setMainInfo:       (v: MainInfo) => void
  setExperiences:    (v: Experience[]) => void
  setEducations:     (v: Education[]) => void
  setProjects:       (v: Project[]) => void
  setSkills:         (v: SkillsBucket | null) => void
  setSummaries:      (v: Summary[]) => void
  setCertifications: (v: Certification[]) => void
  setAwards:         (v: Award[]) => void
  toggleCollapse:    (id: string) => void

  cvContent:    CVContent
  sectionOrder: string[]
  loading:      boolean
}

export function useCVState(userId: string | null | undefined): CVState {
  const [loading, setLoading]           = useState(true)
  const [mainInfo, setMainInfo]         = useState<MainInfo>(EMPTY_MAIN)
  const [experiences, setExperiences]   = useState<Experience[]>([])
  const [educations, setEducations]     = useState<Education[]>([])
  const [projects, setProjects]         = useState<Project[]>([])
  const [skills, setSkills]             = useState<SkillsBucket | null>(null)
  const [summaries, setSummaries]       = useState<Summary[]>([])
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [awards, setAwards]             = useState<Award[]>([])
  const [collapsed, setCollapsed]       = useState<Record<string, boolean>>({ main: false })

  function toggleCollapse(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    fetchCV(userId).then((row) => {
      if (!row) { setLoading(false); return }
      const c = row.content
      if (c.mainInfo)                     setMainInfo(c.mainInfo)
      if (c.experiences?.length)          setExperiences(c.experiences)
      if (c.educations?.length)           setEducations(c.educations)
      if (c.projects?.length)             setProjects(c.projects)
      if (c.skills !== undefined)         setSkills(c.skills)
      if (c.summaries?.length)            setSummaries(c.summaries)
      if (c.certifications?.length)       setCertifications(c.certifications)
      if (c.awards?.length)               setAwards(c.awards)

      // Restore collapsed state: all loaded cards start collapsed except main
      const coll: Record<string, boolean> = { main: false }
      row.sectionOrder.forEach((id) => { if (id !== 'main') coll[id] = true })
      setCollapsed(coll)
      setLoading(false)
    })
  }, [userId])

  // ── Computed snapshot ──────────────────────────────────────────────────────
  const cvContent = useMemo<CVContent>(() => ({
    mainInfo, experiences, educations, projects,
    skills, summaries, certifications, awards,
  }), [mainInfo, experiences, educations, projects, skills, summaries, certifications, awards])

  const sectionOrder = useMemo<string[]>(() => {
    const order: string[] = ['main']
    summaries.forEach((s) => order.push(s.id))
    educations.forEach((e) => order.push(e.id))
    experiences.forEach((e) => order.push(e.id))
    projects.forEach((p) => order.push(p.id))
    if (skills) order.push('skills')
    certifications.forEach((c) => order.push(c.id))
    awards.forEach((a) => order.push(a.id))
    return order
  }, [summaries, experiences, educations, projects, skills, certifications, awards])

  // ── Debounced autosave ─────────────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userId || loading) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      upsertCV(userId, cvContent, sectionOrder)
    }, 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [cvContent, sectionOrder, userId, loading])

  return {
    mainInfo, experiences, educations, projects, skills, summaries, certifications, awards, collapsed,
    setMainInfo, setExperiences, setEducations, setProjects, setSkills,
    setSummaries, setCertifications, setAwards, toggleCollapse,
    cvContent, sectionOrder, loading,
  }
}
