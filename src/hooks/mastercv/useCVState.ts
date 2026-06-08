import { useEffect, useRef, useState } from 'react'
import { fetchCV, upsertCV } from '@/services/cvService'
import type { CVContent, CVState, MainInfo, Experience, Education, Project, SkillsBucket, Summary, Certification, Award } from '@/types'

const EMPTY_MAIN: MainInfo = {
  fullName: '', jobTitle: '', email: '', phone: '',
  location: '', website: '', linkedin: '', github: '',
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
  const [sectionOrder, setSectionOrder] = useState<string[]>(['main'])

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

      // Restore saved order, or build default if none saved
      if (row.sectionOrder.length > 0) {
        setSectionOrder(row.sectionOrder)
      } else {
        const order: string[] = ['main']
        c.summaries?.forEach((s) => order.push(s.id))
        c.educations?.forEach((e) => order.push(e.id))
        c.experiences?.forEach((e) => order.push(e.id))
        c.projects?.forEach((p) => order.push(p.id))
        if (c.skills) order.push('skills')
        c.certifications?.forEach((cert) => order.push(cert.id))
        c.awards?.forEach((a) => order.push(a.id))
        setSectionOrder(order)
      }

      // Restore collapsed state: all loaded cards start collapsed except main
      const coll: Record<string, boolean> = { main: false }
      row.sectionOrder.forEach((id) => { if (id !== 'main') coll[id] = true })
      setCollapsed(coll)
      setLoading(false)
    })
  }, [userId])

  // ── Keep sectionOrder in sync when items are added or deleted ──────────────
  // Append new ids that aren't in the order yet; remove ids that no longer exist.
  useEffect(() => {
    if (loading) return
    const allIds = new Set<string>(['main'])
    summaries.forEach((s) => allIds.add(s.id))
    educations.forEach((e) => allIds.add(e.id))
    experiences.forEach((e) => allIds.add(e.id))
    projects.forEach((p) => allIds.add(p.id))
    if (skills) allIds.add('skills')
    certifications.forEach((c) => allIds.add(c.id))
    awards.forEach((a) => allIds.add(a.id))

    setSectionOrder((prev) => {
      const kept = prev.filter((id) => allIds.has(id))
      const added = [...allIds].filter((id) => !prev.includes(id))
      if (kept.length === prev.length && added.length === 0) return prev
      return [...kept, ...added]
    })
  }, [summaries, educations, experiences, projects, skills, certifications, awards, loading])

  // ── Computed content snapshot ──────────────────────────────────────────────
  const cvContent: CVContent = {
    mainInfo, experiences, educations, projects,
    skills, summaries, certifications, awards,
  }

  // ── Debounced autosave ─────────────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cvContentRef = useRef(cvContent)
  cvContentRef.current = cvContent
  const sectionOrderRef = useRef(sectionOrder)
  sectionOrderRef.current = sectionOrder

  useEffect(() => {
    if (!userId || loading) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      upsertCV(userId, cvContentRef.current, sectionOrderRef.current)
    }, 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [cvContent, sectionOrder, userId, loading])

  return {
    mainInfo, experiences, educations, projects, skills, summaries, certifications, awards, collapsed,
    setMainInfo, setExperiences, setEducations, setProjects, setSkills,
    setSummaries, setCertifications, setAwards, toggleCollapse,
    cvContent, sectionOrder, setSectionOrder, loading,
  }
}
