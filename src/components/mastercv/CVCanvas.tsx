import { useRef, useState, useMemo, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'
import { useCVState } from '@/hooks/useCVState'
import { useAI } from '@/hooks/useAI'
import { PROMPT_CV_IMPORT, PROMPT_CV_ORGANIZE, PROMPT_CURATE_RESUME } from '@/config/aiPrompts'
import type { CVContent } from '@/services/cvService'
import MainInfoCard from './MainInfoCard'
import ExperienceCard, { type Experience } from './ExperienceCard'
import EducationCard, { type Education } from './EducationCard'
import ProjectCard, { type Project } from './ProjectCard'
import SkillsBucketCard, { type SkillsBucket } from './SkillsBucketCard'
import SummaryCard, { type Summary } from './SummaryCard'
import CertificationCard, { type Certification } from './CertificationCard'
import AwardCard, { type Award } from './AwardCard'
import CVRenderer, { type ContentChangeEvent, type CVRendererHandle } from './CVRenderer'
import { T } from '@/lib/crtTheme'
import { insertCuratedResume, fetchCuratedResume, fetchCuratedResumes } from '@/services/curatedResumeService'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// ── 3-D title keyframes ───────────────────────────────────────────────────────
const TITLE_STYLE_ID = 'cv-title-styles'
if (typeof document !== 'undefined' && !document.getElementById(TITLE_STYLE_ID)) {
  const el = document.createElement('style')
  el.id = TITLE_STYLE_ID
  el.textContent = `
@keyframes cv-rock {
  0%   { transform: perspective(600px) rotateY(-8deg) rotateX(3deg); }
  50%  { transform: perspective(600px) rotateY( 8deg) rotateX(-2deg); }
  100% { transform: perspective(600px) rotateY(-8deg) rotateX(3deg); }
}
.cv-title-3d {
  animation: cv-rock 6s ease-in-out infinite;
  transform-style: preserve-3d;
  display: inline-block;
}
@keyframes crt-glitch-h {
  0%,100% { transform: translateX(0); }
  20%     { transform: translateX(-4px); }
  40%     { transform: translateX(3px); }
  60%     { transform: translateX(-2px); }
  80%     { transform: translateX(1px); }
}
@keyframes crt-flicker2 {
  0%,100% { opacity: 1; }
  50%     { opacity: 0.85; }
}
.crt-glitch-wrap {
  animation: crt-glitch-h 0.18s steps(1) infinite, crt-flicker2 0.6s ease-in-out infinite;
  filter: saturate(0) contrast(1.4) brightness(0.7) hue-rotate(80deg);
  pointer-events: none;
  user-select: none;
}
@keyframes crt-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
.crt-blink { animation: crt-blink 1s step-start infinite; }
`
  document.head.appendChild(el)
}

// ── id helper ─────────────────────────────────────────────────────────────────
let _seq = 0
function nextId(prefix: string) { return `${prefix}-${++_seq}` }

const NEW_ITEMS = ['Summary', 'Experience', 'Education', 'Project', 'Skills', 'Certification', 'Award'] as const

// ── Organizer types ───────────────────────────────────────────────────────────
type OrgSection = 'experience' | 'education' | 'project' | 'skills' | 'summary' | 'certification' | 'award' | 'mainInfo'

interface OrgChange {
  action: 'add' | 'merge'
  section: OrgSection
  targetId: string | null
  label: string
  data: Record<string, unknown>
}

interface OrgResult {
  summary: string
  changes: OrgChange[]
}

// ── Curate types ──────────────────────────────────────────────────────────────
interface CurateExpEntry  { id: string; bullets: string[] }
interface CurateProjEntry { id: string; bullets: string[] }
interface CurateSkillGroup { id: string; label: string; skills: string[] }
interface CurateSkills { evergreen: string[]; modular: CurateSkillGroup[] }

interface CurateResult {
  matchedKeywords: string[]
  summary: string | null
  experiences: CurateExpEntry[]
  projects: CurateProjEntry[]
  skills: CurateSkills
}

interface Props {
  visible: boolean
  userName?: string | null
  userId?: string | null
  initialCurateText?: string | null
  initialCuratedResumeId?: string | null
  initialOpenCuratePanel?: boolean
  initialCompany?: string | null
  initialJobId?: string | null
  onInitialCurateConsumed?: () => void
  onResumeSaved?: (jobId: string, resumeId: string) => void
  onClose?: () => void
}

function GlitchOverlay({ width, height, words }: { width: number; height: number; words: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wordsRef = useRef(words)
  useEffect(() => { wordsRef.current = words }, [words])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const CHARS = '01█▓▒░10110100'
    let frame: number
    function draw() {
      ctx.clearRect(0, 0, width, height)
      ctx.font = '11px monospace'
      for (let y = 0; y < height; y += 14) {
        for (let x = 0; x < width; x += 9) {
          const alpha = Math.random() * 0.55 + 0.1
          ctx.fillStyle = `rgba(57,255,20,${alpha.toFixed(2)})`
          // ~8% chance to draw a job-description word instead of a binary char
          const pool = wordsRef.current
          if (pool.length > 0 && Math.random() < 0.08) {
            const word = pool[Math.floor(Math.random() * pool.length)]
            ctx.fillText(word, x, y + 11)
            x += ctx.measureText(word).width  // skip past the word
          } else {
            ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], x, y + 11)
          }
        }
      }
      const barY = (Date.now() % 1800) / 1800 * height
      const grad = ctx.createLinearGradient(0, barY - 30, 0, barY + 30)
      grad.addColorStop(0, 'rgba(57,255,20,0)')
      grad.addColorStop(0.5, 'rgba(57,255,20,0.18)')
      grad.addColorStop(1, 'rgba(57,255,20,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, barY - 30, width, 60)
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [width, height])
  return <canvas ref={canvasRef} width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}

export default function CVCanvas({ visible, userName, userId, initialCurateText, initialCuratedResumeId, initialOpenCuratePanel, initialCompany, initialJobId, onInitialCurateConsumed, onResumeSaved, onClose }: Props) {
  const {
    mainInfo, setMainInfo,
    experiences, setExperiences,
    educations, setEducations,
    projects, setProjects,
    skills, setSkills,
    summaries, setSummaries,
    certifications, setCertifications,
    awards, setAwards,
    collapsed, toggleCollapse,
    cvContent, sectionOrder, loading: cvLoading,
  } = useCVState(userId)

  const [newMenuOpen, setNewMenuOpen]   = useState(false)
  const [previewOpen, setPreviewOpen]   = useState(false)

  // Import state
  const [importPhase, setImportPhase]   = useState<'idle' | 'parsing' | 'thinking' | 'error'>('idle')
  const [importError, setImportError]   = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Organizer state
  const [organizeText, setOrganizeText]         = useState('')
  const [organizeOpen, setOrganizeOpen]         = useState(false)
  const [organizePhase, setOrganizePhase]       = useState<'idle' | 'thinking' | 'error'>('idle')
  const [organizeError, setOrganizeError]       = useState<string | null>(null)
  const [stagingResult, setStagingResult]       = useState<OrgResult | null>(null)
  // acceptedKeys: "2" = whole change accepted, "2.bullet.0" = specific bullet accepted
  const [acceptedKeys, setAcceptedKeys]         = useState<Set<string>>(new Set())

  // Curate state
  const [curateText, setCurateText]             = useState('')
  const [curateOpen, setCurateOpen]             = useState(false)
  const [curatePhase, setCuratePhase]           = useState<'idle' | 'thinking' | 'error'>('idle')
  const [curateError, setCurateError]           = useState<string | null>(null)
  const [curateResult, setCurateResult]         = useState<CurateResult | null>(null)

  // Isolated curated content — never touches cvContent / Master CV
  const [curatedContent, setCuratedContent]         = useState<CVContent | null>(null)
  const [curatedOrder, setCuratedOrder]             = useState<string[]>([])

  // Save curated resume state
  const [savePhase, setSavePhase] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Quick wins state
  const [quickWinsPhase, setQuickWinsPhase] = useState<'idle' | 'thinking' | 'error'>('idle')
  const curatedRendererRef = useRef<CVRendererHandle>(null)

  const [panelRect, setPanelRect] = useState<{ left: number; width: number; top: number; height: number } | null>(null)
  const [overflowLines, setOverflowLines] = useState(0)
  const [scanOpen, setScanOpen] = useState(false)

  useEffect(() => {
    if (!scanOpen) return
    const update = () => {
      const paper = curatedRendererRef.current?.getPaperElement()
      if (!paper) return
      const r = paper.getBoundingClientRect()
      setPanelRect({ left: r.left, width: r.width, top: r.top, height: r.height })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [scanOpen])

  // ── Auto-curation / pre-load when opened from job row context menu ────────
  const initialHandledRef = useRef(false)
  // Captures jobId at trigger time so handleSaveCurated still has it after the
  // parent clears initialJobId via onInitialCurateConsumed
  const pendingJobIdRef = useRef<string | null>(null)

  // Reset guard when the canvas closes so re-opening triggers again
  useEffect(() => {
    if (!visible) initialHandledRef.current = false
  }, [visible])

  // Fire only after the CV has finished loading so experiences/projects are populated
  useEffect(() => {
    if (!visible || cvLoading) return
    if (initialHandledRef.current) return
    initialHandledRef.current = true
    pendingJobIdRef.current = initialJobId ?? null

    if (initialOpenCuratePanel) {
      setCurateOpen(true)
      onInitialCurateConsumed?.()
    } else if (initialCuratedResumeId) {
      setCurateResult(null)
      setCuratePhase('thinking')
      fetchCuratedResume(initialCuratedResumeId).then((resume) => {
        if (!resume) { setCuratePhase('idle'); return }
        setCurateResult({
          matchedKeywords: resume.matchedKeywords,
          summary: null,
          experiences: resume.content.experiences.map((e) => ({ id: e.id, bullets: e.bullets })),
          projects:    resume.content.projects.map((p)    => ({ id: p.id, bullets: p.bullets })),
          skills:      resume.content.skills
            ? { evergreen: resume.content.skills.evergreen, modular: resume.content.skills.modular.map((g) => ({ id: g.id, label: g.label, skills: g.skills })) }
            : { evergreen: [], modular: [] },
        })
        setCuratedContent(resume.content)
        setCuratedOrder(resume.sectionOrder)
        setCuratePhase('idle')
        onInitialCurateConsumed?.()
      })
    } else if (initialCurateText) {
      setCurateText(initialCurateText)
      handleCurate(initialCurateText)
      onInitialCurateConsumed?.()
    }
  }, [visible, cvLoading]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const key = String(changeIdx)
    setAcceptedKeys((prev) => {
      const next = new Set(prev)
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

  const { run: runAI } = useAI()

  // ── Import helpers ────────────────────────────────────────────────────────

  async function extractText(file: File): Promise<string> {
    const buf = await file.arrayBuffer()
    if (file.name.toLowerCase().endsWith('.docx')) {
      const result = await mammoth.extractRawText({ arrayBuffer: buf })
      return result.value
    }
    if (file.name.toLowerCase().endsWith('.txt')) {
      return new TextDecoder('utf-8').decode(buf)
    }
    // PDF (default)
    const doc = await pdfjsLib.getDocument({ data: buf }).promise
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
    }
    return pages.join('\n\n')
  }

  function mergeImport(parsed: CVContent) {
    setMainInfo({
      fullName:  mainInfo.fullName  || parsed.mainInfo?.fullName  || '',
      jobTitle:  mainInfo.jobTitle  || parsed.mainInfo?.jobTitle  || '',
      email:     mainInfo.email     || parsed.mainInfo?.email     || '',
      phone:     mainInfo.phone     || parsed.mainInfo?.phone     || '',
      location:  mainInfo.location  || parsed.mainInfo?.location  || '',
      website:   mainInfo.website   || parsed.mainInfo?.website   || '',
      linkedin:  mainInfo.linkedin  || parsed.mainInfo?.linkedin  || '',
      github:    mainInfo.github    || parsed.mainInfo?.github    || '',
    })
    if (parsed.summaries?.length)      setSummaries([...summaries, ...parsed.summaries])
    if (parsed.experiences?.length)    setExperiences([...experiences, ...parsed.experiences])
    if (parsed.educations?.length)     setEducations([...educations, ...parsed.educations])
    if (parsed.projects?.length)       setProjects([...projects, ...parsed.projects])
    if (parsed.certifications?.length) setCertifications([...certifications, ...parsed.certifications])
    if (parsed.awards?.length)         setAwards([...awards, ...parsed.awards])
    if (parsed.skills) {
      if (!skills) {
        setSkills(parsed.skills)
      } else {
        const mergedEvergreen = Array.from(new Set([...skills.evergreen, ...parsed.skills.evergreen]))
        setSkills({ evergreen: mergedEvergreen, modular: [...skills.modular, ...parsed.skills.modular] })
      }
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!e.target) return
    e.target.value = ''
    if (!file) return

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

    runAI({
      system: PROMPT_CV_IMPORT,
      prompt: rawText,
      model: 'claude-haiku-4-5',
      onComplete: (result) => {
        try {
          const cleaned = result.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
          const parsed = JSON.parse(cleaned) as CVContent
          mergeImport(parsed)
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

  // ── Organizer helpers ─────────────────────────────────────────────────────

  function handleOrganize() {
    const text = organizeText.trim()
    if (!text) return
    setOrganizeError(null)
    setOrganizePhase('thinking')

    const prompt =
      'PASTED TEXT:\n' + text +
      '\n\nCURRENT CV:\n' + JSON.stringify(cvContent, null, 2)

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
          setOrganizePhase('idle')
          setOrganizeOpen(false)
          setOrganizeText('')
        } catch {
          setOrganizePhase('error')
          setOrganizeError('AI returned invalid data.')
          setTimeout(() => { setOrganizePhase('idle'); setOrganizeError(null) }, 4000)
        }
      },
      onError: (msg) => {
        setOrganizePhase('error')
        setOrganizeError(msg)
        setTimeout(() => { setOrganizePhase('idle'); setOrganizeError(null) }, 4000)
      },
    })
  }

  function applyChange(change: OrgChange, changeIdx: number) {
    const d = change.data as Record<string, unknown>
    // Filter bullets to only accepted ones
    const allBullets = (d.bullets as string[] | undefined) ?? []
    const filteredBullets = allBullets.filter((_, bi) => acceptedKeys.has(`${changeIdx}.bullet.${bi}`))
    const dWithFilteredBullets = { ...d, bullets: filteredBullets }

    if (change.action === 'add') {
      const id = nextId(
        change.section === 'experience'    ? 'exp' :
        change.section === 'education'     ? 'edu' :
        change.section === 'project'       ? 'proj' :
        change.section === 'summary'       ? 'sum' :
        change.section === 'certification' ? 'cert' :
        change.section === 'award'         ? 'awd' : 'item'
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
          const mergedEvergreen = Array.from(new Set([...skills.evergreen, ...(incoming.evergreen ?? [])]))
          setSkills({ evergreen: mergedEvergreen, modular: [...skills.modular, ...(incoming.modular ?? [])] })
        }
      } else if (change.section === 'mainInfo') {
        setMainInfo({ ...mainInfo, ...(d as Partial<typeof mainInfo>) })
      }

    } else if (change.action === 'merge' && change.targetId) {
      const tid = change.targetId
      if (change.section === 'experience') {
        setExperiences(experiences.map((e) => e.id !== tid ? e : {
          ...e, ...d, bullets: [...e.bullets, ...filteredBullets],
        }))
      } else if (change.section === 'education') {
        setEducations(educations.map((e) => e.id !== tid ? e : { ...e, ...d }))
      } else if (change.section === 'project') {
        setProjects(projects.map((p) => p.id !== tid ? p : {
          ...p, ...d, bullets: [...p.bullets, ...filteredBullets],
        }))
      } else if (change.section === 'summary') {
        setSummaries(summaries.map((s) => s.id !== tid ? s : { ...s, ...d }))
      } else if (change.section === 'certification') {
        setCertifications(certifications.map((c) => c.id !== tid ? c : { ...c, ...d }))
      } else if (change.section === 'award') {
        setAwards(awards.map((a) => a.id !== tid ? a : { ...a, ...d }))
      } else if (change.section === 'skills' && skills) {
        const incoming = d as Partial<SkillsBucket>
        const mergedEvergreen = Array.from(new Set([...skills.evergreen, ...(incoming.evergreen ?? [])]))
        setSkills({ evergreen: mergedEvergreen, modular: [...skills.modular, ...(incoming.modular ?? [])] })
      } else if (change.section === 'mainInfo') {
        setMainInfo({ ...mainInfo, ...(d as Partial<typeof mainInfo>) })
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

  const importLabel =
    importPhase === 'parsing'  ? 'PARSING…' :
    importPhase === 'thinking' ? 'THINKING…' :
    importPhase === 'error'    ? 'ERROR' : 'IMPORT FILE'

  const organizeLabel =
    organizePhase === 'thinking' ? 'THINKING…' :
    organizePhase === 'error'    ? 'ERROR' : 'IMPORT TEXT'

  // ── Curate handler ────────────────────────────────────────────────────────
  function handleCurate(overrideText?: string) {
    const text = (overrideText ?? curateText).trim()
    if (!text) return
    setCurateError(null)
    setCurateResult(null)
    setCuratePhase('thinking')

    const prompt =
      'JOB DESCRIPTION:\n' + text +
      '\n\nMASTER CV:\n' + JSON.stringify(cvContent, null, 2)

    runAI({
      system: PROMPT_CURATE_RESUME,
      prompt,
      model: 'claude-haiku-4-5',
      onComplete: (result) => {
        try {
          const cleaned = result.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
          const parsed = JSON.parse(cleaned) as CurateResult
          setCurateResult(parsed)

          // Build isolated curated content — never touches Master CV
          const cExperiences = parsed.experiences
            .map((entry) => { const exp = experiences.find((e) => e.id === entry.id); return exp ? { ...exp, bullets: entry.bullets } : null })
            .filter((e): e is Experience => e !== null)
          const cProjects = parsed.projects
            .map((entry) => { const proj = projects.find((p) => p.id === entry.id); return proj ? { ...proj, bullets: entry.bullets } : null })
            .filter((p): p is Project => p !== null)
          const cSkills = (parsed.skills.evergreen.length > 0 || parsed.skills.modular.length > 0) ? parsed.skills : null
          const cSummaries = parsed.summary ? summaries.filter((s) => s.id === parsed.summary) : []

          const cOrder: string[] = ['main']
          cSummaries.forEach((s) => cOrder.push(s.id))
          educations.forEach((e) => cOrder.push(e.id))
          cExperiences.forEach((e) => cOrder.push(e.id))
          cProjects.forEach((p) => cOrder.push(p.id))
          if (cSkills) cOrder.push('skills')
          certifications.forEach((c) => cOrder.push(c.id))
          awards.forEach((a) => cOrder.push(a.id))

          setCuratedContent({ mainInfo, summaries: cSummaries, experiences: cExperiences, educations, projects: cProjects, skills: cSkills, certifications, awards })
          setCuratedOrder(cOrder)

          setCuratePhase('idle')
          setCurateOpen(false)
          setCurateText('')
        } catch {
          setCuratePhase('error')
          setCurateError('AI returned invalid data.')
          setTimeout(() => { setCuratePhase('idle'); setCurateError(null) }, 4000)
        }
      },
      onError: (msg) => {
        setCuratePhase('error')
        setCurateError(msg)
        setTimeout(() => { setCuratePhase('idle'); setCurateError(null) }, 4000)
      },
    })
  }

  const curateLabel =
    curatePhase === 'thinking' ? 'THINKING…' :
    curatePhase === 'error'    ? 'ERROR' : 'CURATE'

  // ── Save curated resume handler ───────────────────────────────────────────
  async function handleSaveCurated() {
    if (!curatedContent || !curateResult || !userId) return
    setSavePhase('saving')

    // Auto-label: CompanyName_LastName, or LastName_N if no company
    const lastName = mainInfo.fullName.trim().split(/\s+/).pop() ?? 'Resume'
    let label: string
    if (initialCompany?.trim()) {
      label = `${initialCompany.trim()}_${lastName}`
    } else {
      const existing = await fetchCuratedResumes(userId)
      label = `${lastName}_${existing.length + 1}`
    }

    const { data: savedResume, error } = await insertCuratedResume(userId, label, curatedContent, curatedOrder, curateResult.matchedKeywords)

    if (error || !savedResume) {
      setSavePhase('error')
      setTimeout(() => { setSavePhase('idle') }, 4000)
    } else {
      const jobId = pendingJobIdRef.current
      if (jobId) onResumeSaved?.(jobId, savedResume.id)
      pendingJobIdRef.current = null
      setSavePhase('saved')
      setTimeout(() => { setSavePhase('idle'); onClose?.() }, 1500)
    }
  }

  function resetSaveState() {
    setSavePhase('idle')
  }

  function handlePrintCurated() {
    const paper = curatedRendererRef.current?.getPaperElement()
    if (!paper) return

    // Clone paper and strip keyword <mark> highlights
    const clone = paper.cloneNode(true) as HTMLElement
    clone.querySelectorAll('mark').forEach((mark) => {
      mark.replaceWith(...Array.from(mark.childNodes))
    })
    clone.id = 'cv-print-target'
    clone.style.boxShadow = 'none'

    // Inject print stylesheet + clone into document
    const style = document.createElement('style')
    style.id = 'cv-print-style'
    style.textContent = `
      @media print {
        body > *:not(#cv-print-target) { display: none !important; }
        #cv-print-target {
          display: block !important;
          position: fixed !important;
          inset: 0 !important;
          width: 816px !important;
          margin: 0 auto !important;
          padding: 48px !important;
          box-shadow: none !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #cv-print-target * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @page { size: letter; margin: 0; }
      }
    `
    document.head.appendChild(style)
    document.body.appendChild(clone)

    const label = initialCompany?.trim()
      ? `${initialCompany.trim()}_resume`
      : 'resume'
    const prevTitle = document.title
    document.title = label

    const cleanup = () => {
      document.title = prevTitle
      document.getElementById('cv-print-style')?.remove()
      document.getElementById('cv-print-target')?.remove()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)

    window.print()
  }

  function handleQuickWins() {
    if (!curatedContent || !curateResult) return
    setQuickWinsPhase('thinking')
    const allText = [
      ...curatedContent.experiences.flatMap((e) => e.bullets),
      ...curatedContent.projects.flatMap((p) => p.bullets),
      ...(curatedContent.skills ? [...curatedContent.skills.evergreen, ...curatedContent.skills.modular.flatMap((g) => g.skills)] : []),
      ...curatedContent.summaries.map((s) => s.text),
    ].join(' ').toLowerCase()
    const missingKeywords = curateResult.matchedKeywords.filter((kw) => !allText.includes(kw.toLowerCase()))
    const prompt =
      'MISSING KEYWORDS: ' + (missingKeywords.length ? missingKeywords.join(', ') : 'none') + '\n\n' +
      'CURATED CV:\n' + JSON.stringify(curatedContent, null, 2)
    runAI({
      system:
        'You are a resume editor. Given missing keywords and a curated CV, surface as many keywords as possible using only minimal edits. Look for ALL of these opportunities:\n\n' +
        '1. SYNONYM SWAP — bullet uses a synonym or related term; swap it for the exact keyword (e.g. "utilized" → "leveraged React").\n' +
        '2. APPEND TO TECH LIST — bullet mentions a list of tools/technologies; append the keyword if the work genuinely involved it (e.g. "...using Node and Postgres" → "...using Node, Postgres, and Docker").\n' +
        '3. PARENTHETICAL — keyword is implied by the work described; add it in parentheses (e.g. "built CI pipeline" → "built CI pipeline (GitHub Actions)").\n' +
        '4. UMBRELLA TERM — keyword is a broad concept (e.g. "software development lifecycle", "cross-functional collaboration", "stakeholder management") that the CV already demonstrates through specific bullets. Add it to skills or insert it naturally into a bullet or summary where it fits.\n' +
        '5. SKILLS ADDITION — keyword is a tool or skill the candidate clearly used (evidenced by bullets) but isn\'t listed in skills; add it to evergreen skills.\n' +
        '6. SUMMARY TWEAK — if a summary exists, insert the keyword naturally into an existing sentence.\n\n' +
        'Return ONLY a valid JSON array — no markdown, no explanation:\n' +
        '[\n' +
        '  { "type": "experience" | "project", "id": "<entry id>", "bulletIndex": <number>, "original": "<exact original>", "revised": "<edited text>" },\n' +
        '  { "type": "skill", "value": "<keyword to add to evergreen skills>" },\n' +
        '  { "type": "summary", "id": "<summary id>", "original": "<exact original>", "revised": "<edited text>" },\n' +
        '  ...\n' +
        ']\n\n' +
        'Rules:\n' +
        '• Be aggressive — surface every keyword that can honestly fit. Missing keywords on a resume are a missed opportunity.\n' +
        '• Never fabricate experience. Only add a keyword if the CV content makes clear the candidate did that work.\n' +
        '• Each edit must be minimal — change as few words as possible.\n' +
        '• If no quick wins exist, return [].',
      prompt,
      model: 'claude-haiku-4-5',
      onComplete: (result) => {
        try {
          const cleaned = result.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
          type QuickWinEdit =
            | { type: 'experience' | 'project'; id: string; bulletIndex: number; original: string; revised: string }
            | { type: 'skill'; value: string }
            | { type: 'summary'; id: string; original: string; revised: string }
          const edits = JSON.parse(cleaned) as QuickWinEdit[]
          if (edits.length === 0) { setQuickWinsPhase('idle'); return }
          setCuratedContent((prev) => {
            if (!prev) return prev
            let next = { ...prev }
            for (const edit of edits) {
              if (edit.type === 'experience') {
                next = { ...next, experiences: next.experiences.map((e) => {
                  if (e.id !== edit.id) return e
                  const bullets = [...e.bullets]
                  bullets[edit.bulletIndex] = edit.revised
                  return { ...e, bullets }
                })}
              } else if (edit.type === 'project') {
                next = { ...next, projects: next.projects.map((p) => {
                  if (p.id !== edit.id) return p
                  const bullets = [...p.bullets]
                  bullets[edit.bulletIndex] = edit.revised
                  return { ...p, bullets }
                })}
              } else if (edit.type === 'skill') {
                const existing = next.skills ?? { evergreen: [], modular: [] }
                if (!existing.evergreen.includes(edit.value)) {
                  next = { ...next, skills: { ...existing, evergreen: [...existing.evergreen, edit.value] } }
                }
              } else if (edit.type === 'summary') {
                next = { ...next, summaries: next.summaries.map((s) =>
                  s.id === edit.id ? { ...s, text: edit.revised } : s
                )}
              }
            }
            return next
          })
          // ── Section reorder by keyword density (6-second scan) ──────────
          // Pinned at top: main, summaries, educations
          // Ranked by keyword hits: experiences, projects, skills, certs, awards
          setCuratedOrder((prevOrder) => {
            if (!curateResult) return prevOrder
            const keywords = curateResult.matchedKeywords.map((k) => k.toLowerCase())

            const score = (text: string) =>
              keywords.reduce((n, kw) => n + (text.toLowerCase().includes(kw) ? 1 : 0), 0)

            // Collect IDs per section type from current order
            const pinned:   string[] = [] // main + summaries + educations — always top
            const expIds:   string[] = []
            const projIds:  string[] = []
            const skillsId: string[] = []
            const restIds:  string[] = [] // certs, awards

            for (const id of prevOrder) {
              if (id === 'main')  { pinned.push(id); continue }
              if (curatedContent?.summaries.find((s) => s.id === id))      { pinned.push(id);  continue }
              if (curatedContent?.educations.find((e) => e.id === id))     { pinned.push(id);  continue }
              if (curatedContent?.experiences.find((e) => e.id === id))    { expIds.push(id);  continue }
              if (curatedContent?.projects.find((p) => p.id === id))       { projIds.push(id); continue }
              if (id === 'skills')                                          { skillsId.push(id); continue }
              restIds.push(id)
            }

            // Score each movable section group
            const expScore   = curatedContent?.experiences.reduce((n, e) => n + e.bullets.reduce((m, b) => m + score(b), 0), 0) ?? 0
            const projScore  = curatedContent?.projects.reduce((n, p) => n + p.bullets.reduce((m, b) => m + score(b), 0), 0) ?? 0
            const skillsText = curatedContent?.skills
              ? [...(curatedContent.skills.evergreen), ...curatedContent.skills.modular.flatMap((g) => g.skills)].join(' ')
              : ''
            const skillsScore = score(skillsText)

            const ranked = [
              { ids: expIds,   s: expScore },
              { ids: projIds,  s: projScore },
              { ids: skillsId, s: skillsScore },
            ].sort((a, b) => b.s - a.s)

            return [...pinned, ...ranked.flatMap((r) => r.ids), ...restIds]
          })

          setQuickWinsPhase('idle')
        } catch {
          setQuickWinsPhase('error')
          setTimeout(() => setQuickWinsPhase('idle'), 3000)
        }
      },
      onError: () => { setQuickWinsPhase('error'); setTimeout(() => setQuickWinsPhase('idle'), 3000) },
    })
  }

  // Recompute match score locally on every edit — count keyword hits across all bullet text
  const liveMatchScore = useMemo(() => {
    if (!curateResult || !curatedContent) return 0
    const keywords = curateResult.matchedKeywords
    if (!keywords.length) return 0
    const c = curatedContent
    const allText = [
      ...c.experiences.flatMap((e) => e.bullets),
      ...c.projects.flatMap((p) => p.bullets),
      ...(c.skills ? [...c.skills.evergreen, ...c.skills.modular.flatMap((g) => g.skills)] : []),
      ...c.summaries.map((s) => s.text),
    ].join(' ').toLowerCase()
    return keywords.filter((kw) => allText.includes(kw.toLowerCase())).length
  }, [curateResult, curatedContent])

  // ── Spawn helpers ─────────────────────────────────────────────────────────
  function spawnExperience() {
    const id = nextId('exp')
    setExperiences([...experiences, { id, company: '', title: '', location: '', startDate: '', endDate: '', bullets: [''] }])
    toggleCollapse(id)
    setNewMenuOpen(false)
  }
  function spawnEducation() {
    const id = nextId('edu')
    setEducations([...educations, { id, institution: '', degree: '', field: '', location: '', startDate: '', endDate: '', gpa: '', notes: '' }])
    toggleCollapse(id)
    setNewMenuOpen(false)
  }
  function spawnProject() {
    const id = nextId('proj')
    setProjects([...projects, { id, name: '', role: '', url: '', startDate: '', endDate: '', technologies: '', bullets: [''] }])
    toggleCollapse(id)
    setNewMenuOpen(false)
  }
  function spawnSkills() {
    if (skills) return
    setSkills({ evergreen: [], modular: [] })
    setNewMenuOpen(false)
  }
  function spawnSummary() {
    const id = nextId('sum')
    setSummaries([...summaries, { id, label: '', text: '' }])
    toggleCollapse(id)
    setNewMenuOpen(false)
  }
  function spawnCertification() {
    const id = nextId('cert')
    setCertifications([...certifications, { id, name: '', issuer: '', issueDate: '', expiryDate: '', credentialId: '', url: '' }])
    toggleCollapse(id)
    setNewMenuOpen(false)
  }
  function spawnAward() {
    const id = nextId('awd')
    setAwards([...awards, { id, title: '', issuer: '', date: '', description: '' }])
    toggleCollapse(id)
    setNewMenuOpen(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="absolute inset-0"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity 400ms ease' }}
    >
      {/* ── Top toolbar ─────────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 16, left: 20, right: 20, zIndex: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>

        {/* LEFT — IMPORT FILE + IMPORT TEXT */}
        <div className="flex items-start gap-2">
          {/* Import File */}
          <div className="flex flex-col gap-1">
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleImportFile} />
            <button
              disabled={importPhase !== 'idle'}
              onClick={() => fileInputRef.current?.click()}
              style={{
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', width: 160,
                color: importPhase === 'error' ? T.warn : importPhase !== 'idle' ? T.green : T.greenDim,
                border: `1px solid ${importPhase === 'error' ? T.warn : importPhase !== 'idle' ? T.green : T.border}`,
                background: T.bg, padding: '5px 14px',
                cursor: importPhase !== 'idle' ? 'default' : 'pointer',
              }}
              onMouseEnter={(e) => { if (importPhase === 'idle') { (e.currentTarget as HTMLElement).style.color = T.green; (e.currentTarget as HTMLElement).style.borderColor = T.green } }}
              onMouseLeave={(e) => { if (importPhase === 'idle') { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border } }}
            >
              {importLabel}
            </button>
            {importError && <span style={{ fontFamily: 'monospace', fontSize: 10, color: T.warn }}>{importError}</span>}
          </div>

          {/* Import Text (Organize) */}
          <div className="flex flex-col gap-1" style={{ maxWidth: 340 }}>
            <button
              onClick={() => setOrganizeOpen((v) => !v)}
              style={{
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', width: 160,
                color: organizeOpen ? T.green : organizePhase === 'error' ? T.warn : T.greenDim,
                border: `1px solid ${organizeOpen ? T.green : organizePhase === 'error' ? T.warn : T.border}`,
                background: T.bg, padding: '5px 14px', cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.green; (e.currentTarget as HTMLElement).style.borderColor = T.green }}
              onMouseLeave={(e) => { if (!organizeOpen) { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border } }}
            >
              {organizeLabel}
            </button>

            {organizeOpen && (
              <div style={{ width: '100%', background: T.bg, border: `1px solid ${T.border}`, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: T.greenDim, letterSpacing: '0.1em', lineHeight: 1.5 }}>
                  PASTE FROM AN OLD RESUME, LINKEDIN, OR ANY CAREER DOC. HAIKU WILL FIND WHAT'S NEW AND ASK BEFORE ADDING ANYTHING.
                </div>
                <textarea
                  value={organizeText}
                  onChange={(e) => setOrganizeText(e.target.value)}
                  placeholder="Paste resume text here…"
                  rows={6}
                  style={{
                    fontFamily: 'monospace', fontSize: 11, color: T.green, background: '#050505',
                    border: `1px solid ${T.border}`, padding: '6px 8px', resize: 'vertical',
                    outline: 'none', caretColor: T.green, lineHeight: 1.5,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setOrganizeOpen(false); setOrganizeText('') }}
                    style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: T.greenDim, background: 'none', border: `1px solid ${T.border}`, padding: '4px 10px', cursor: 'pointer' }}
                  >
                    CANCEL
                  </button>
                  <button
                    disabled={organizePhase === 'thinking' || !organizeText.trim()}
                    onClick={handleOrganize}
                    style={{
                      fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em',
                      color: organizePhase === 'thinking' ? T.green : T.bg,
                      background: organizePhase === 'thinking' ? 'transparent' : T.green,
                      border: `1px solid ${T.green}`,
                      padding: '4px 10px', cursor: organizePhase === 'thinking' ? 'default' : 'pointer',
                    }}
                  >
                    {organizePhase === 'thinking' ? 'THINKING…' : 'ANALYZE →'}
                  </button>
                </div>
                {organizeError && <span style={{ fontFamily: 'monospace', fontSize: 10, color: T.warn }}>{organizeError}</span>}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — CURATE + PREVIEW */}
        <div className="flex items-start gap-2">
          {/* Curate */}
          <div className="flex flex-col gap-1" style={{ maxWidth: 260 }}>
            <button
              onClick={() => setCurateOpen((v) => !v)}
              style={{
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', width: 160,
                color: curateOpen ? T.green : curatePhase === 'error' ? T.warn : curateResult ? T.green : T.greenDim,
                border: `1px solid ${curateOpen ? T.green : curatePhase === 'error' ? T.warn : curateResult ? T.green : T.border}`,
                background: T.bg, padding: '5px 14px', cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.green; (e.currentTarget as HTMLElement).style.borderColor = T.green }}
              onMouseLeave={(e) => { if (!curateOpen) { (e.currentTarget as HTMLElement).style.color = curateResult ? T.green : T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = curateResult ? T.green : T.border } }}
            >
              {curateLabel}
            </button>

            {curateOpen && (
              <div style={{ width: '100%', background: T.bg, border: `1px solid ${T.border}`, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: T.greenDim, letterSpacing: '0.1em', lineHeight: 1.5 }}>
                  PASTE A JOB DESCRIPTION. HAIKU WILL REORDER YOUR BULLETS AND SURFACE KEYWORD MATCHES — NO REWRITING.
                </div>
                <textarea
                  value={curateText}
                  onChange={(e) => setCurateText(e.target.value)}
                  placeholder="Paste job description here…"
                  rows={6}
                  style={{
                    fontFamily: 'monospace', fontSize: 11, color: T.green, background: '#050505',
                    border: `1px solid ${T.border}`, padding: '6px 8px', resize: 'vertical',
                    outline: 'none', caretColor: T.green, lineHeight: 1.5,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setCurateOpen(false); setCurateText('') }}
                    style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: T.greenDim, background: 'none', border: `1px solid ${T.border}`, padding: '4px 10px', cursor: 'pointer' }}
                  >
                    CANCEL
                  </button>
                  <button
                    disabled={curatePhase === 'thinking' || !curateText.trim()}
                    onClick={() => handleCurate()}
                    style={{
                      fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em',
                      color: curatePhase === 'thinking' ? T.green : T.bg,
                      background: curatePhase === 'thinking' ? 'transparent' : T.green,
                      border: `1px solid ${T.green}`,
                      padding: '4px 10px', cursor: curatePhase === 'thinking' ? 'default' : 'pointer',
                    }}
                  >
                    {curatePhase === 'thinking' ? 'THINKING…' : 'CURATE →'}
                  </button>
                </div>
                {curateError && <span style={{ fontFamily: 'monospace', fontSize: 10, color: T.warn }}>{curateError}</span>}
              </div>
            )}
          </div>

          {/* Preview */}
          <button
            onClick={() => setPreviewOpen((v) => !v)}
            style={{
              fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', width: 160,
              color: previewOpen ? T.green : T.greenDim,
              border: `1px solid ${previewOpen ? T.green : T.border}`,
              background: T.bg, padding: '5px 14px', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.green; (e.currentTarget as HTMLElement).style.borderColor = T.green }}
            onMouseLeave={(e) => { if (!previewOpen) { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border } }}
          >
            {previewOpen ? 'EDIT' : 'PREVIEW'}
          </button>
        </div>
      </div>

      {/* ── Staging screen ───────────────────────────────────────────────── */}
      {stagingResult && (
        <div className="absolute inset-0" style={{ zIndex: 50, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ borderBottom: `1px solid ${T.border}`, padding: '18px 24px 14px', flexShrink: 0 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 15, letterSpacing: '0.18em', color: T.green, marginBottom: 8 }}>
              CV UPDATE STAGING
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: T.greenDim, letterSpacing: '0.06em', lineHeight: 1.6 }}>
              {stagingResult.summary}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: T.border, letterSpacing: '0.08em', marginTop: 6 }}>
              TOGGLE ITEMS OR INDIVIDUAL BULLETS. ONLY CHECKED ITEMS WILL BE APPLIED.
            </div>
          </div>

          {/* Change list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px' }}>
            {stagingResult.changes.length === 0 ? (
              <div style={{ fontFamily: 'monospace', fontSize: 14, color: T.greenDim, padding: '32px 0' }}>
                Nothing new found — everything is already in your CV.
              </div>
            ) : stagingResult.changes.map((change, i) => {
              const accepted = acceptedKeys.has(String(i))
              const actionColor = change.action === 'add' ? '#34d399' : '#38bdf8'
              const bullets = ((change.data as Record<string, unknown>).bullets as string[] | undefined) ?? []
              const nonBulletFields = Object.entries(change.data).filter(([k, v]) => {
                if (k === 'bullets') return false
                if (Array.isArray(v)) return (v as unknown[]).length > 0
                if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0
                return v !== '' && v !== null && v !== undefined && !k.startsWith('id')
              })
              return (
                <div key={i} style={{ marginBottom: 12, border: `1px solid ${accepted ? actionColor + '55' : T.border}`, background: accepted ? actionColor + '07' : 'transparent' }}>
                  {/* Card header — toggle whole change */}
                  <div
                    onClick={() => toggleChange(i, bullets)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}
                  >
                    <div style={{
                      width: 16, height: 16, flexShrink: 0,
                      border: `1px solid ${accepted ? actionColor : T.border}`,
                      background: accepted ? actionColor : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {accepted && <span style={{ color: '#000', fontSize: 11, fontWeight: 'bold', lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em', color: actionColor, flexShrink: 0 }}>
                      {change.action.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.1em', color: T.greenDim, flexShrink: 0 }}>
                      {change.section.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: 14, color: T.green, letterSpacing: '0.05em', fontWeight: 'bold' }}>
                      {change.label}
                    </span>
                  </div>

                  {/* Non-bullet fields */}
                  {nonBulletFields.length > 0 && (
                    <div style={{ padding: '0 14px 8px 42px', display: 'flex', flexWrap: 'wrap', gap: '2px 16px' }}>
                      {nonBulletFields.map(([k, v]) => (
                        <span key={k} style={{ fontFamily: 'monospace', fontSize: 12, color: T.greenDim, lineHeight: 1.8 }}>
                          <span style={{ color: T.border }}>{k}: </span>{String(v)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Bullets — each individually toggleable */}
                  {bullets.length > 0 && (
                    <div style={{ padding: '0 14px 10px 42px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: T.border, letterSpacing: '0.1em', marginBottom: 2 }}>BULLETS</div>
                      {bullets.map((bullet, bi) => {
                        const bulletAccepted = acceptedKeys.has(`${i}.bullet.${bi}`)
                        return (
                          <div
                            key={bi}
                            onClick={(e) => { e.stopPropagation(); toggleBullet(i, bi) }}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 10,
                              padding: '6px 10px',
                              border: `1px solid ${bulletAccepted ? actionColor + '44' : T.border}`,
                              background: bulletAccepted ? actionColor + '09' : 'transparent',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{
                              width: 13, height: 13, marginTop: 2, flexShrink: 0,
                              border: `1px solid ${bulletAccepted ? actionColor : T.border}`,
                              background: bulletAccepted ? actionColor : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {bulletAccepted && <span style={{ color: '#000', fontSize: 9, fontWeight: 'bold', lineHeight: 1 }}>✓</span>}
                            </div>
                            <span style={{ fontFamily: 'monospace', fontSize: 13, color: bulletAccepted ? T.green : T.greenDim, lineHeight: 1.5 }}>
                              {bullet}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${T.border}`, padding: '14px 28px', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
            <button
              onClick={() => { setStagingResult(null); setAcceptedKeys(new Set()) }}
              style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.12em', color: T.greenDim, background: 'none', border: `1px solid ${T.border}`, padding: '7px 20px', cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.warn; (e.currentTarget as HTMLElement).style.borderColor = T.warn }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border }}
            >
              DISCARD ALL
            </button>
            <button
              disabled={acceptedChangesCount() === 0}
              onClick={acceptStaging}
              style={{
                fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.12em',
                color: acceptedChangesCount() === 0 ? T.border : '#000',
                background: acceptedChangesCount() === 0 ? 'transparent' : T.green,
                border: `1px solid ${acceptedChangesCount() === 0 ? T.border : T.green}`,
                padding: '7px 20px', cursor: acceptedChangesCount() === 0 ? 'default' : 'pointer',
              }}
            >
              APPLY {acceptedChangesCount() > 0 ? `(${acceptedChangesCount()})` : ''}
            </button>
          </div>
        </div>
      )}

      {/* ── Curate thinking screen (auto-curate path only) ──────────────── */}
      {curatePhase === 'thinking' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div className="crt-glitch-wrap" style={{ position: 'relative', width: 816, maxWidth: '90%', aspectRatio: '816/1056', border: `1px solid ${T.border}`, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0.04 }} />
            <GlitchOverlay width={816} height={1056} words={curateText.split(/\s+/).filter(w => w.length > 4).map(w => w.replace(/[^a-zA-Z0-9+#]/g, ''))} />
          </div>
          <div style={{ marginTop: 24, fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.2em', color: T.green }}>
            TAILORING RESUME<span className="crt-blink">…</span>
          </div>
          <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.12em', color: T.greenDim }}>
            HAIKU IS MATCHING YOUR BULLETS TO THE JOB DESCRIPTION
          </div>
        </div>
      )}

      {/* ── Curate result panel ─────────────────────────────────────────── */}
      {curateResult && (
        <div className="absolute inset-0" style={{ zIndex: 50, background: '#000', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ borderBottom: `1px solid ${T.border}`, padding: '18px 24px 14px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 15, letterSpacing: '0.18em', color: T.green }}>
                CURATED VIEW
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
                {overflowLines > 0 && (
                  <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.1em', textAlign: 'right', color: T.warn }}>
                    <div>⚠ PAGE OVERFLOW</div>
                    <div style={{ fontSize: 9, marginTop: 2, color: T.warn + 'aa' }}>SHORTEN BY ~{overflowLines} LINE{overflowLines !== 1 ? 'S' : ''}</div>
                  </div>
                )}
                {(() => {
                  const total = curateResult.matchedKeywords.length
                  const score = total > 0 ? Math.round((liveMatchScore / total) * 100) : 0
                  const color = score >= 70 ? T.green : score >= 40 ? '#facc15' : T.warn
                  return (
                    <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em', textAlign: 'right' }}>
                      <span style={{ color: T.greenDim }}>KEYWORD MATCH SCORE </span>
                      <span style={{ fontSize: 22, color, fontWeight: 'bold' }}>{score}</span>
                      <span style={{ color: T.greenDim, fontSize: 13 }}>%</span>
                    </div>
                  )
                })()}
              </div>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.08em', marginBottom: 10 }}>
              <span style={{ color: T.green, flexShrink: 0 }}>
                {liveMatchScore}/{curateResult.matchedKeywords.length} KEYWORDS
              </span>
            </div>

            {/* Keywords — green = found in bullets, orange = missing */}
            {curateResult.matchedKeywords.length > 0 && curatedContent && (() => {
              const c = curatedContent
              const allText = [
                ...c.experiences.flatMap((e) => e.bullets),
                ...c.projects.flatMap((p) => p.bullets),
                ...(c.skills ? [...c.skills.evergreen, ...c.skills.modular.flatMap((g) => g.skills)] : []),
                ...c.summaries.map((s) => s.text),
              ].join(' ').toLowerCase()
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {curateResult.matchedKeywords.map((kw) => {
                    const hit = allText.includes(kw.toLowerCase())
                    return (
                      <span key={kw} style={{ fontFamily: 'monospace', fontSize: 10, color: hit ? T.green : T.warn, border: `1px solid ${hit ? T.green : T.warn}33`, padding: '1px 7px' }}>
                        {kw}
                      </span>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* 6-second scan overlay — fixed to the paper element, never scrolls */}
          {scanOpen && panelRect && (
            <div style={{
              position: 'fixed', zIndex: 60, pointerEvents: 'none',
              top: panelRect.top, left: panelRect.left, width: panelRect.width,
              height: panelRect.height ?? '100vh',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '38%', border: `2px solid ${T.green}55`, boxSizing: 'border-box' }}>
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
                  background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.85) 100%)',
                }} />
                <div style={{
                  position: 'absolute', top: 6, right: 10,
                  fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.15em', color: T.green, opacity: 0.7,
                }}>
                  6-SEC SCAN ZONE
                </div>
              </div>
              <div style={{ position: 'absolute', top: '38%', left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)' }} />
            </div>
          )}

          {/* Live editable preview */}
          {curatedContent && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <CVRenderer
                ref={curatedRendererRef}
                content={curatedContent}
                sectionOrder={curatedOrder}
                keywords={curateResult.matchedKeywords}
                onOverflowChange={setOverflowLines}
                onChange={(evt: ContentChangeEvent) => {
                  setCuratedContent((prev) => {
                    if (!prev) return prev
                    if (evt.type === 'mainInfo')      return { ...prev, mainInfo: { ...prev.mainInfo, ...evt.data } }
                    if (evt.type === 'summary')       return { ...prev, summaries:      prev.summaries.map((s) => s.id === evt.id ? { ...s, ...evt.data } : s) }
                    if (evt.type === 'experience')    return { ...prev, experiences:    prev.experiences.map((e) => e.id === evt.id ? { ...e, ...evt.data } : e) }
                    if (evt.type === 'education')     return { ...prev, educations:     prev.educations.map((e) => e.id === evt.id ? { ...e, ...evt.data } : e) }
                    if (evt.type === 'project')       return { ...prev, projects:       prev.projects.map((p) => p.id === evt.id ? { ...p, ...evt.data } : p) }
                    if (evt.type === 'certification') return { ...prev, certifications: prev.certifications.map((c) => c.id === evt.id ? { ...c, ...evt.data } : c) }
                    if (evt.type === 'award')         return { ...prev, awards:         prev.awards.map((a) => a.id === evt.id ? { ...a, ...evt.data } : a) }
                    if (evt.type === 'skills')        return { ...prev, skills: prev.skills ? { ...prev.skills, ...evt.data } : null }
                    return prev
                  })
                }}
              />
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${T.border}`, padding: '14px 28px', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => { setCurateResult(null); setCuratedContent(null); setCuratedOrder([]); resetSaveState() }}
              style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.12em', color: T.greenDim, background: 'none', border: `1px solid ${T.border}`, padding: '7px 20px', cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.warn; (e.currentTarget as HTMLElement).style.borderColor = T.warn }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border }}
            >
              CLOSE
            </button>

            <button
              onClick={() => setScanOpen((v) => !v)}
              style={{
                fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.12em', padding: '7px 20px', cursor: 'pointer',
                color: scanOpen ? T.green : T.greenDim,
                border: `1px solid ${scanOpen ? T.green : T.border}`,
                background: 'none',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.green; (e.currentTarget as HTMLElement).style.borderColor = T.green }}
              onMouseLeave={(e) => { if (!scanOpen) { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border } }}
            >
              6-SEC SCAN
            </button>

            <button
              onClick={handleQuickWins}
              disabled={quickWinsPhase === 'thinking'}
              style={{
                fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.12em', padding: '7px 20px', cursor: quickWinsPhase === 'thinking' ? 'default' : 'pointer',
                color: quickWinsPhase === 'error' ? T.warn : quickWinsPhase === 'thinking' ? T.green : T.greenDim,
                border: `1px solid ${quickWinsPhase === 'error' ? T.warn : quickWinsPhase === 'thinking' ? T.green : T.border}`,
                background: 'none',
              }}
              onMouseEnter={(e) => { if (quickWinsPhase === 'idle') { (e.currentTarget as HTMLElement).style.color = T.green; (e.currentTarget as HTMLElement).style.borderColor = T.green } }}
              onMouseLeave={(e) => { if (quickWinsPhase === 'idle') { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border } }}
            >
              {quickWinsPhase === 'thinking' ? 'THINKING…' : quickWinsPhase === 'error' ? 'ERROR' : 'QUICK WINS ✦'}
            </button>

            <button
              onClick={handlePrintCurated}
              style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.12em', color: T.greenDim, background: 'none', border: `1px solid ${T.border}`, padding: '7px 20px', cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.green; (e.currentTarget as HTMLElement).style.borderColor = T.green }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border }}
            >
              DOWNLOAD PDF
            </button>

            {/* Save resume */}
            {savePhase === 'idle' && userId && (
              <button
                onClick={handleSaveCurated}
                style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.12em', color: T.greenDim, background: 'none', border: `1px solid ${T.border}`, padding: '7px 20px', cursor: 'pointer' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.green; (e.currentTarget as HTMLElement).style.borderColor = T.green }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border }}
              >
                SAVE RESUME
              </button>
            )}
            {savePhase === 'saving' && (
              <span style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.12em', color: T.greenDim }}>SAVING…</span>
            )}
            {savePhase === 'saved' && (
              <span style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.12em', color: T.green }}>SAVED ✓</span>
            )}
            {savePhase === 'error' && (
              <span style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.12em', color: T.warn }}>SAVE FAILED</span>
            )}

          </div>
        </div>
      )}

      {/* ── Editor ──────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-y-auto" style={{ display: previewOpen ? 'none' : 'block' }}>
        <div className="mx-auto flex flex-col gap-2 px-4 pb-8" style={{ width: 'min(72vw, 860px)', paddingTop: 100 }}>

          {userName && (
            <div className="flex justify-center pointer-events-none mb-6">
              <span
                className="cv-title-3d select-none"
                style={{
                  fontFamily: 'monospace', fontSize: 'clamp(1.8rem, 4vw, 3.2rem)', fontWeight: 700,
                  letterSpacing: '0.18em', color: T.green, textTransform: 'uppercase',
                  textShadow: [
                    '1px 1px 0 #1a7a06', '2px 2px 0 #166604', '3px 3px 0 #124f03',
                    '4px 4px 0 #0d3a02', '5px 5px 0 #092601',
                    '6px 6px 12px rgba(0,0,0,0.8)',
                    '0 0 20px rgba(57,255,20,0.15)', '0 0 50px rgba(57,255,20,0.06)',
                  ].join(', '),
                }}
              >
                {userName}
              </span>
            </div>
          )}

          <MainInfoCard data={mainInfo} collapsed={collapsed.main ?? false} onChange={setMainInfo} onToggleCollapse={() => toggleCollapse('main')} />

          {summaries.map((sum) => (
            <SummaryCard key={sum.id} data={sum} collapsed={collapsed[sum.id] ?? false}
              onChange={(updated: Summary) => setSummaries(summaries.map((s) => s.id === updated.id ? updated : s))}
              onToggleCollapse={() => toggleCollapse(sum.id)}
              onDelete={() => setSummaries(summaries.filter((s) => s.id !== sum.id))} />
          ))}

          {educations.map((edu) => (
            <EducationCard key={edu.id} data={edu} collapsed={collapsed[edu.id] ?? false}
              onChange={(updated: Education) => setEducations(educations.map((e) => e.id === updated.id ? updated : e))}
              onToggleCollapse={() => toggleCollapse(edu.id)}
              onDelete={() => setEducations(educations.filter((e) => e.id !== edu.id))} />
          ))}

          {experiences.map((exp) => (
            <ExperienceCard key={exp.id} data={exp} collapsed={collapsed[exp.id] ?? false}
              onChange={(updated: Experience) => setExperiences(experiences.map((e) => e.id === updated.id ? updated : e))}
              onToggleCollapse={() => toggleCollapse(exp.id)}
              onDelete={() => setExperiences(experiences.filter((e) => e.id !== exp.id))} />
          ))}

          {projects.map((proj) => (
            <ProjectCard key={proj.id} data={proj} collapsed={collapsed[proj.id] ?? false}
              onChange={(updated: Project) => setProjects(projects.map((p) => p.id === updated.id ? updated : p))}
              onToggleCollapse={() => toggleCollapse(proj.id)}
              onDelete={() => setProjects(projects.filter((p) => p.id !== proj.id))} />
          ))}

          {skills && (
            <SkillsBucketCard data={skills} collapsed={collapsed.skills ?? false}
              onChange={(updated: SkillsBucket) => setSkills(updated)}
              onToggleCollapse={() => toggleCollapse('skills')}
              onDelete={() => setSkills(null)} />
          )}

          {certifications.map((cert) => (
            <CertificationCard key={cert.id} data={cert} collapsed={collapsed[cert.id] ?? false}
              onChange={(updated: Certification) => setCertifications(certifications.map((c) => c.id === updated.id ? updated : c))}
              onToggleCollapse={() => toggleCollapse(cert.id)}
              onDelete={() => setCertifications(certifications.filter((c) => c.id !== cert.id))} />
          ))}

          {awards.map((awd) => (
            <AwardCard key={awd.id} data={awd} collapsed={collapsed[awd.id] ?? false}
              onChange={(updated: Award) => setAwards(awards.map((a) => a.id === updated.id ? updated : a))}
              onToggleCollapse={() => toggleCollapse(awd.id)}
              onDelete={() => setAwards(awards.filter((a) => a.id !== awd.id))} />
          ))}

          {/* NEW… button */}
          <div className="relative mt-2">
            <button
              onClick={() => setNewMenuOpen((v) => !v)}
              style={{
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em',
                color: newMenuOpen ? T.green : T.greenDim,
                border: `1px solid ${newMenuOpen ? T.green : T.border}`,
                background: T.bg, padding: '5px 16px', cursor: 'pointer',
              }}
            >
              +
            </button>

            {newMenuOpen && (
              <div className="absolute left-0 flex flex-col" style={{ top: 'calc(100% + 4px)', background: T.bg, border: `1px solid ${T.border}`, minWidth: 160, boxShadow: '0 0 8px rgba(57,255,20,0.06)', zIndex: 30 }}>
                {NEW_ITEMS.map((item) => {
                  const disabled = item === 'Skills' && skills !== null
                  return (
                    <button key={item} disabled={disabled}
                      onClick={() => {
                        if (item === 'Summary')       spawnSummary()
                        else if (item === 'Experience')    spawnExperience()
                        else if (item === 'Education')     spawnEducation()
                        else if (item === 'Project')       spawnProject()
                        else if (item === 'Skills')        spawnSkills()
                        else if (item === 'Certification') spawnCertification()
                        else if (item === 'Award')         spawnAward()
                      }}
                      style={{
                        fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em',
                        color: disabled ? T.border : T.greenDim,
                        background: 'transparent', border: 'none',
                        borderBottom: `1px solid ${T.border}`,
                        padding: '7px 14px', textAlign: 'left',
                        cursor: disabled ? 'default' : 'pointer',
                      }}
                      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.color = T.green }}
                      onMouseLeave={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.color = T.greenDim }}
                    >
                      + {item.toUpperCase()}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Preview ──────────────────────────────────────────────────────── */}
      {previewOpen && (
        <div className="absolute inset-0 overflow-y-auto">
          <CVRenderer content={cvContent} sectionOrder={sectionOrder} />
        </div>
      )}
    </div>
  )
}
