import { useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'
import { useAI } from '@/hooks/useAI'
import { PROMPT_CV_ORGANIZE } from '@/config/aiPrompts'
import type { CVContent, Experience, Education, Project, Summary, Certification, Award, SkillsBucket, MainInfo } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type OrgSection =
  | 'experience' | 'education' | 'project' | 'skills'
  | 'summary' | 'certification' | 'award' | 'mainInfo'

export interface OrgChange {
  action: 'add' | 'merge'
  section: OrgSection
  targetId: string | null
  label: string
  data: Record<string, unknown>
}

export interface OrgResult {
  summary: string
  changes: OrgChange[]
}

interface OrganizerDeps {
  cvContent: CVContent
  mainInfo: MainInfo
  experiences: Experience[]
  educations: Education[]
  projects: Project[]
  summaries: Summary[]
  certifications: Certification[]
  awards: Award[]
  skills: SkillsBucket | null
  setMainInfo: (v: MainInfo) => void
  setExperiences: (v: Experience[]) => void
  setEducations: (v: Education[]) => void
  setProjects: (v: Project[]) => void
  setSummaries: (v: Summary[]) => void
  setCertifications: (v: Certification[]) => void
  setAwards: (v: Award[]) => void
  setSkills: (v: SkillsBucket | null) => void
  nextId: (prefix: string) => string
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOrganizer({
  cvContent,
  mainInfo,
  experiences,
  educations,
  projects,
  summaries,
  certifications,
  awards,
  skills,
  setMainInfo,
  setExperiences,
  setEducations,
  setProjects,
  setSummaries,
  setCertifications,
  setAwards,
  setSkills,
  nextId,
}: OrganizerDeps) {
  const { run: runAI } = useAI()

  const [importPhase, setImportPhase] = useState<'idle' | 'parsing' | 'thinking' | 'error'>('idle')
  const [importError, setImportError] = useState<string | null>(null)
  const [stagingResult, setStagingResult] = useState<OrgResult | null>(null)
  const [acceptedKeys, setAcceptedKeys]   = useState<Set<string>>(new Set())

  // ── File parsing ────────────────────────────────────────────────────────────

  async function extractText(file: File): Promise<string> {
    const buf = await file.arrayBuffer()
    if (file.name.toLowerCase().endsWith('.docx')) {
      const result = await mammoth.extractRawText({ arrayBuffer: buf })
      return result.value
    }
    if (file.name.toLowerCase().endsWith('.txt')) {
      return new TextDecoder('utf-8').decode(buf)
    }
    const doc = await pdfjsLib.getDocument({ data: buf }).promise
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
    }
    return pages.join('\n\n')
  }

  async function handleDropFile(file: File) {
    if (importPhase !== 'idle') return
    setImportError(null)
    setImportPhase('parsing')

    let rawText = ''
    try {
      rawText = await extractText(file)
    } catch {
      setImportPhase('error')
      setImportError('Could not read file.')
      setTimeout(() => { setImportPhase('idle'); setImportError(null) }, 4000)
      return
    }

    setImportPhase('thinking')
    const prompt = 'PASTED TEXT:\n' + rawText + '\n\nCURRENT CV:\n' + JSON.stringify(cvContent, null, 2)
    runAI({
      system: PROMPT_CV_ORGANIZE,
      prompt,
      model: 'claude-haiku-4-5',
      onComplete: (result) => {
        try {
          const cleaned = result.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
          const parsed = JSON.parse(cleaned) as OrgResult
          setStagingResult(parsed)
          initAcceptedKeys(parsed)
          setImportPhase('idle')
        } catch {
          setImportPhase('error')
          setImportError('AI returned invalid data.')
          setTimeout(() => { setImportPhase('idle'); setImportError(null) }, 4000)
        }
      },
      onError: (msg) => {
        setImportPhase('error')
        setImportError(msg)
        setTimeout(() => { setImportPhase('idle'); setImportError(null) }, 4000)
      },
    })
  }

  // ── Staging key helpers ─────────────────────────────────────────────────────

  function initAcceptedKeys(result: OrgResult) {
    const keys = new Set<string>()
    result.changes.forEach((change, i) => {
      keys.add(String(i))
      const bullets = (change.data as Record<string, unknown>).bullets
      if (Array.isArray(bullets)) {
        bullets.forEach((_: unknown, bi: number) => keys.add(`${i}.bullet.${bi}`))
      }
    })
    setAcceptedKeys(keys)
  }

  function toggleKey(key: string) {
    setAcceptedKeys((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleBullet(changeIdx: number, bulletIdx: number) {
    toggleKey(`${changeIdx}.bullet.${bulletIdx}`)
  }

  function toggleChange(changeIdx: number, bullets: string[]) {
    setAcceptedKeys((prev) => {
      const next = new Set(prev)
      const key = String(changeIdx)
      if (next.has(key)) {
        next.delete(key)
        bullets.forEach((_, bi) => next.delete(`${changeIdx}.bullet.${bi}`))
      } else {
        next.add(key)
        bullets.forEach((_, bi) => next.add(`${changeIdx}.bullet.${bi}`))
      }
      return next
    })
  }

  function acceptedChangesCount() {
    if (!stagingResult) return 0
    return stagingResult.changes.filter((_, i) => acceptedKeys.has(String(i))).length
  }

  // ── Apply logic ─────────────────────────────────────────────────────────────

  function applyChange(change: OrgChange, changeIdx: number) {
    const d = change.data as Record<string, unknown>
    const allBullets = (d.bullets as string[] | undefined) ?? []
    const filteredBullets = allBullets.filter((_, bi) => acceptedKeys.has(`${changeIdx}.bullet.${bi}`))
    const dWithFilteredBullets = { ...d, bullets: filteredBullets }

    if (change.action === 'add') {
      const id = nextId(
        change.section === 'experience'    ? 'exp'  :
        change.section === 'education'     ? 'edu'  :
        change.section === 'project'       ? 'proj' :
        change.section === 'summary'       ? 'sum'  :
        change.section === 'certification' ? 'cert' :
        change.section === 'award'         ? 'awd'  : 'item'
      )
      if (change.section === 'experience')
        setExperiences([...experiences, { id, company: '', title: '', location: '', startDate: '', endDate: '', ...dWithFilteredBullets, bullets: filteredBullets } as Experience])
      else if (change.section === 'education')
        setEducations([...educations, { id, institution: '', degree: '', field: '', location: '', startDate: '', endDate: '', gpa: '', notes: '', ...d } as Education])
      else if (change.section === 'project')
        setProjects([...projects, { id, name: '', role: '', url: '', startDate: '', endDate: '', technologies: '', ...dWithFilteredBullets, bullets: filteredBullets } as Project])
      else if (change.section === 'summary')
        setSummaries([...summaries, { id, label: '', text: '', ...d } as Summary])
      else if (change.section === 'certification')
        setCertifications([...certifications, { id, name: '', issuer: '', issueDate: '', expiryDate: '', credentialId: '', url: '', ...d } as Certification])
      else if (change.section === 'award')
        setAwards([...awards, { id, title: '', issuer: '', date: '', description: '', ...d } as Award])
      else if (change.section === 'skills') {
        const incoming = d as Partial<SkillsBucket>
        if (!skills) {
          setSkills({ evergreen: [], modular: [], ...incoming } as SkillsBucket)
        } else {
          setSkills({
            evergreen: Array.from(new Set([...skills.evergreen, ...(incoming.evergreen ?? [])])),
            modular: [...skills.modular, ...(incoming.modular ?? [])],
          })
        }
      } else if (change.section === 'mainInfo') {
        setMainInfo({ ...mainInfo, ...(d as Partial<MainInfo>) })
      }
    } else if (change.action === 'merge' && change.targetId) {
      const tid = change.targetId
      if (change.section === 'experience')
        setExperiences(experiences.map((e) => e.id !== tid ? e : { ...e, ...d, bullets: [...e.bullets, ...filteredBullets] }))
      else if (change.section === 'education')
        setEducations(educations.map((e) => e.id !== tid ? e : { ...e, ...d }))
      else if (change.section === 'project')
        setProjects(projects.map((p) => p.id !== tid ? p : { ...p, ...d, bullets: [...p.bullets, ...filteredBullets] }))
      else if (change.section === 'summary')
        setSummaries(summaries.map((s) => s.id !== tid ? s : { ...s, ...d }))
      else if (change.section === 'certification')
        setCertifications(certifications.map((c) => c.id !== tid ? c : { ...c, ...d }))
      else if (change.section === 'award')
        setAwards(awards.map((a) => a.id !== tid ? a : { ...a, ...d }))
      else if (change.section === 'skills' && skills) {
        const incoming = d as Partial<SkillsBucket>
        setSkills({
          evergreen: Array.from(new Set([...skills.evergreen, ...(incoming.evergreen ?? [])])),
          modular: [...skills.modular, ...(incoming.modular ?? [])],
        })
      } else if (change.section === 'mainInfo') {
        setMainInfo({ ...mainInfo, ...(d as Partial<MainInfo>) })
      }
    }
  }

  function acceptStaging() {
    if (!stagingResult) return
    stagingResult.changes.forEach((change, i) => {
      if (acceptedKeys.has(String(i))) applyChange(change, i)
    })
    setStagingResult(null)
    setAcceptedKeys(new Set())
  }

  function discardStaging() {
    setStagingResult(null)
    setAcceptedKeys(new Set())
  }

  return {
    importPhase,
    importError,
    stagingResult,
    acceptedKeys,
    acceptedChangesCount,
    toggleBullet,
    toggleChange,
    handleDropFile,
    acceptStaging,
    discardStaging,
  }
}
