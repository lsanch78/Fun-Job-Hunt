import { useRef, useState, useMemo, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'
import { useCVState } from '@/hooks/cv/useCVState'
import { useAI } from '@/hooks/useAI'
import { PROMPT_CV_ORGANIZE, PROMPT_CURATE_RESUME } from '@/config/aiPrompts'
import type { CVContent, ContentChangeEvent, CVRendererHandle, Experience, Education, Project, SkillsBucket, Summary, Certification, Award } from '@/types'
import MainInfoCard from './MainInfoCard'
import ExperienceCard from './ExperienceCard'
import EducationCard from './EducationCard'
import ProjectCard from './ProjectCard'
import SkillsBucketCard from './SkillsBucketCard'
import SummaryCard from './SummaryCard'
import CertificationCard from './CertificationCard'
import AwardCard from './AwardCard'
import CVRenderer from './CVRenderer'
import CanvasShell from '@/components/canvas/CanvasShell'
import { T } from '@/lib/crtTheme'
import { P, CV_FONT } from '@/lib/CVCardTheme'
import { playCloseBlip, playAiDing } from '@/lib/sfx'
import { fetchCuratedResume } from '@/services/curatedResumeService'
import { useCuratedResume } from '@/hooks/cv/useCuratedResume'

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
  visible?: boolean
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

export default function CVCanvas({ visible = true, userName: _userName, userId, initialCurateText, initialCuratedResumeId, initialOpenCuratePanel, initialCompany, initialJobId, onInitialCurateConsumed, onResumeSaved, onClose: _onClose }: Props) {
  const {
    resumes: savedResumes,
    handleCreate: createCuratedResume,
    handleUpdate: updateCuratedResumeRecord,
  } = useCuratedResume(userId ?? null)

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
    cvContent, sectionOrder, setSectionOrder, loading: cvLoading,
  } = useCVState(userId)

  const [newMenuOpen, setNewMenuOpen]   = useState(false)
  const [previewOpen, setPreviewOpen]   = useState(false)

  // Card drag-to-reorder state
  const [dragId, setDragId]         = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragFromHandle              = useRef(false)

  // Import state
  const [importPhase, setImportPhase]   = useState<'idle' | 'parsing' | 'thinking' | 'error'>('idle')
  const [importError, setImportError]   = useState<string | null>(null)
  const [dropActive, setDropActive]     = useState(false)
  const dropZoneInputRef = useRef<HTMLInputElement>(null)

  // Organizer state (staging screen — populated programmatically)
  const [stagingResult, setStagingResult]       = useState<OrgResult | null>(null)
  const [acceptedKeys, setAcceptedKeys]         = useState<Set<string>>(new Set())

  // Curate state
  const [curateText, setCurateText]             = useState('')
  const [curateOpen, setCurateOpen]             = useState(false)
  const [curatePhase, setCuratePhase]           = useState<'idle' | 'thinking' | 'error'>('idle')
  const [curateError, setCurateError]           = useState<string | null>(null)
  const [curateResult, setCurateResult]         = useState<CurateResult | null>(null)

  // Isolated curated content — never touches cvContent / CV
  const [curatedContent, setCuratedContent]         = useState<CVContent | null>(null)
  const [curatedOrder, setCuratedOrder]             = useState<string[]>([])

  // Save curated resume state
  const [savePhase, setSavePhase] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Quick wins state
  const [quickWinsPhase, setQuickWinsPhase] = useState<'idle' | 'thinking' | 'error'>('idle')
  const curatedRendererRef = useRef<CVRendererHandle>(null)

  const [panelRect, setPanelRect] = useState<{ left: number; width: number; top: number; height: number } | null>(null)
  const [overflowLines, setOverflowLines] = useState(0)
  const [scanOpen, setScanOpen] = useState(() => localStorage.getItem('cv-scan-open') === 'true')

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
          experiences: resume.content.experiences.map((e: { id: string; bullets: string[] }) => ({ id: e.id, bullets: e.bullets })),
          projects:    resume.content.projects.map((p: { id: string; bullets: string[] })    => ({ id: p.id, bullets: p.bullets })),
          skills:      resume.content.skills
            ? { evergreen: resume.content.skills.evergreen, modular: resume.content.skills.modular.map((g: { id: string; label: string; skills: string[] }) => ({ id: g.id, label: g.label, skills: g.skills })) }
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

  // ── Organizer helpers ─────────────────────────────────────────────────────

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

  // ── Curate handler ────────────────────────────────────────────────────────
  function handleCurate(overrideText?: string) {
    const text = (overrideText ?? curateText).trim()
    if (!text) return
    setCurateError(null)
    setCurateResult(null)
    setCuratePhase('thinking')

    const prompt =
      'JOB DESCRIPTION:\n' + text +
      '\n\nCV:\n' + JSON.stringify(cvContent, null, 2)

    runAI({
      system: PROMPT_CURATE_RESUME,
      prompt,
      model: 'claude-haiku-4-5',
      onComplete: (result) => {
        try {
          const cleaned = result.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
          const parsed = JSON.parse(cleaned) as CurateResult
          setCurateResult(parsed)
          playAiDing()

          // Build isolated curated content — never touches CV
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

          freshCuratedRef.current = true
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

  // ── Auto-save when curation completes from a job context ─────────────────
  // Only fires for newly-curated resumes (not when loading an existing one).

  const autoSavedRef    = useRef(false)
  const freshCuratedRef = useRef(false) // true only after a live AI curation run

  useEffect(() => {
    if (!visible) { autoSavedRef.current = false; freshCuratedRef.current = false; return }
  }, [visible])

  useEffect(() => {
    if (curatePhase !== 'idle' || !curatedContent || !curateResult || !userId) return
    if (!pendingJobIdRef.current) return
    if (!freshCuratedRef.current) return
    if (autoSavedRef.current) return
    if (savePhase !== 'idle') return
    autoSavedRef.current = true
    handleSaveCurated()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curatePhase, curatedContent, curateResult, userId, savePhase])

  // ── Auto-update in view mode (save on blur) ──────────────────────────────
  // Tracks the ID of the resume currently loaded for viewing so edits persist.
  // CVRenderer fires onChange only on blur, so each state change == a blur event.

  const viewResumeIdRef = useRef<string | null>(null)
  const viewLoadedRef   = useRef(false) // skips the initial load-triggered change

  useEffect(() => {
    if (!visible) { viewResumeIdRef.current = null; viewLoadedRef.current = false; return }
  }, [visible])

  useEffect(() => {
    if (initialCuratedResumeId && curatePhase === 'idle' && curatedContent && !freshCuratedRef.current) {
      if (viewResumeIdRef.current !== initialCuratedResumeId) {
        viewResumeIdRef.current = initialCuratedResumeId
        viewLoadedRef.current = false
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curatePhase, curatedContent])

  useEffect(() => {
    if (!viewResumeIdRef.current || !curatedContent) return
    if (!viewLoadedRef.current) { viewLoadedRef.current = true; return }
    updateCuratedResumeRecord(viewResumeIdRef.current, curatedContent, curatedOrder)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curatedContent, curatedOrder])

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
      label = `${lastName}_${savedResumes.length + 1}`
    }

    const savedResume = await createCuratedResume(userId, label, curatedContent, curatedOrder, curateResult.matchedKeywords)

    if (!savedResume) {
      setSavePhase('error')
      setTimeout(() => { setSavePhase('idle') }, 4000)
    } else {
      const jobId = pendingJobIdRef.current
      if (jobId) onResumeSaved?.(jobId, savedResume.id)
      pendingJobIdRef.current = null
      setSavePhase('saved')
      setTimeout(() => { setSavePhase('idle') }, 1500)
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

  // Esc closes the curated result panel
  useEffect(() => {
    if (!curateResult) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { playCloseBlip(); setCurateResult(null); setCuratedContent(null); setCuratedOrder([]); resetSaveState() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [curateResult])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="absolute inset-0"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity 400ms ease' }}
    >
      {/* ── Top toolbar ─────────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 16, left: 20, right: 20, zIndex: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>

        {/* LEFT — spacer */}
        <div />

        {/* RIGHT — CURATE + PREVIEW */}
        <div className="flex items-start gap-2">
          {/* Curate */}
          <div className="flex flex-col gap-1" style={{ maxWidth: 300 }}>
            <button
              onClick={() => setCurateOpen((v) => !v)}
              style={{
                fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.04em',
                color: curateOpen ? P.text : curatePhase === 'error' ? '#ef4444' : curateResult ? P.text : P.textMuted,
                border: `1px solid ${curateOpen ? P.rule : curatePhase === 'error' ? '#ef4444' : curateResult ? P.textMuted : P.border}`,
                borderRadius: 3, background: P.bg, padding: '5px 16px', cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = P.textMuted; (e.currentTarget as HTMLElement).style.color = P.text }}
              onMouseLeave={(e) => { if (!curateOpen) { (e.currentTarget as HTMLElement).style.borderColor = curateResult ? P.textMuted : P.border; (e.currentTarget as HTMLElement).style.color = curateResult ? P.text : P.textMuted } }}
            >
              {curateLabel}
            </button>

            {curateOpen && (
              <div style={{ width: '100%', background: P.bg, border: `1px solid ${P.border}`, borderRadius: 3, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                <div style={{ fontFamily: CV_FONT.family, fontSize: 11, color: P.textMuted, lineHeight: 1.5 }}>
                  Paste a job description. Haiku will reorder your bullets and surface keyword matches — no rewriting.
                </div>
                <textarea
                  value={curateText}
                  onChange={(e) => setCurateText(e.target.value)}
                  placeholder="Paste job description here…"
                  rows={6}
                  style={{
                    fontFamily: CV_FONT.family, fontSize: 13, color: P.text, background: '#f9fafb',
                    border: `1px solid ${P.border}`, borderRadius: 3, padding: '6px 8px', resize: 'vertical',
                    outline: 'none', lineHeight: 1.5,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setCurateOpen(false); setCurateText('') }}
                    style={{ fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em', color: P.textMuted, background: 'none', border: `1px solid ${P.border}`, borderRadius: 3, padding: '4px 12px', cursor: 'pointer' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = P.textMuted }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = P.border }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={curatePhase === 'thinking' || !curateText.trim()}
                    onClick={() => handleCurate()}
                    style={{
                      fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em',
                      color: curatePhase === 'thinking' ? P.textMuted : P.bg,
                      background: curatePhase === 'thinking' ? 'transparent' : P.text,
                      border: `1px solid ${curatePhase === 'thinking' ? P.border : P.text}`,
                      borderRadius: 3, padding: '4px 12px', cursor: curatePhase === 'thinking' ? 'default' : 'pointer',
                    }}
                  >
                    {curatePhase === 'thinking' ? 'Thinking…' : 'Curate →'}
                  </button>
                </div>
                {curateError && <span style={{ fontFamily: CV_FONT.family, fontSize: 12, color: '#ef4444' }}>{curateError}</span>}
              </div>
            )}
          </div>

          {/* Preview */}
          <button
            onClick={() => setPreviewOpen((v) => !v)}
            style={{
              fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.04em',
              color: previewOpen ? P.text : P.textMuted,
              border: `1px solid ${previewOpen ? P.rule : P.border}`,
              borderRadius: 3, background: P.bg, padding: '5px 16px', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = P.textMuted; (e.currentTarget as HTMLElement).style.color = P.text }}
            onMouseLeave={(e) => { if (!previewOpen) { (e.currentTarget as HTMLElement).style.borderColor = P.border; (e.currentTarget as HTMLElement).style.color = P.textMuted } }}
          >
            {previewOpen ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>


      {/* ── Staging screen ───────────────────────────────────────────────── */}
      {stagingResult && (
        <div className="absolute inset-0" style={{ zIndex: 50, background: 'rgba(255,255,255,0.97)', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ borderBottom: `1px solid ${P.border}`, padding: '18px 28px 14px', flexShrink: 0 }}>
            <div style={{ fontFamily: CV_FONT.family, fontSize: '14pt', fontVariant: 'small-caps', letterSpacing: '0.03em', color: P.text, marginBottom: 6 }}>
              CV Update Staging
            </div>
            <div style={{ fontFamily: CV_FONT.family, fontSize: 13, color: P.textMuted, lineHeight: 1.6 }}>
              {stagingResult.summary}
            </div>
            <div style={{ fontFamily: CV_FONT.family, fontSize: 11, color: P.border, marginTop: 4 }}>
              Toggle items or individual bullets — only checked items will be applied.
            </div>
          </div>

          {/* Change list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stagingResult.changes.length === 0 ? (
              <div style={{ fontFamily: CV_FONT.family, fontSize: 14, color: P.textMuted, padding: '32px 0' }}>
                Nothing new found — everything is already in your CV.
              </div>
            ) : stagingResult.changes.map((change, i) => {
              const accepted = acceptedKeys.has(String(i))
              const bullets = ((change.data as Record<string, unknown>).bullets as string[] | undefined) ?? []
              const nonBulletFields = Object.entries(change.data).filter(([k, v]) => {
                if (k === 'bullets') return false
                if (Array.isArray(v)) return (v as unknown[]).length > 0
                if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0
                return v !== '' && v !== null && v !== undefined && !k.startsWith('id')
              })
              const sectionAccent: Record<string, string> = {
                experience: '#f97316', education: '#22c55e', project: '#a855f7',
                skills: '#06b6d4', summary: '#64748b', certification: '#ec4899',
                award: '#eab308', mainInfo: '#3b82f6',
              }
              const accent = sectionAccent[change.section] ?? P.rule
              const sectionTitle: Record<string, string> = {
                experience: 'EXPERIENCE', education: 'EDUCATION', project: 'PROJECT',
                skills: 'SKILLS', summary: 'SUMMARY', certification: 'CERTIFICATION',
                award: 'AWARD / HONOR', mainInfo: 'MAIN INFO',
              }
              return (
                <div key={i} style={{ background: P.bg, border: `1px solid ${P.border}`, borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', fontFamily: CV_FONT.family, opacity: accepted ? 1 : 0.5, transition: 'opacity 150ms' }}>
                  {/* Header — mirrors CVCard header row */}
                  <div
                    className="flex items-center px-5 pt-4 pb-3 cursor-pointer"
                    style={{ borderBottom: `2px solid ${accent}` }}
                    onClick={() => toggleChange(i, bullets)}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: 15, height: 15, flexShrink: 0, borderRadius: 2, marginRight: 10,
                      border: `1.5px solid ${accepted ? accent : P.border}`,
                      background: accepted ? accent : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 150ms, border-color 150ms',
                    }}>
                      {accepted && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                    </div>
                    {/* Section title */}
                    <span style={{ fontFamily: CV_FONT.family, fontSize: CV_FONT.section, fontVariant: 'small-caps', letterSpacing: '0.03em', fontWeight: 'normal', color: P.text }}>
                      {sectionTitle[change.section] ?? change.section.toUpperCase()}
                    </span>
                    {/* Label / summary */}
                    <span className="truncate" style={{ fontSize: CV_FONT.body, color: P.textMuted, marginLeft: 8 }}>
                      — {change.label}
                    </span>
                    {/* Add/Merge badge */}
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontVariant: 'small-caps', letterSpacing: '0.06em', color: accent, flexShrink: 0 }}>
                      {change.action}
                    </span>
                    <span style={{ color: P.textMuted, fontSize: CV_FONT.body, flexShrink: 0, marginLeft: 8 }}>▾</span>
                  </div>

                  {/* Body — mirrors CVCard body */}
                  <div className="flex flex-col gap-4 px-5 py-4">
                    {/* Non-bullet fields as label/value pairs */}
                    {nonBulletFields.length > 0 && (
                      <div className="flex flex-wrap" style={{ gap: '4px 24px' }}>
                        {nonBulletFields.map(([k, v]) => (
                          <div key={k}>
                            <div style={{ fontFamily: CV_FONT.family, fontSize: CV_FONT.label, letterSpacing: '0.08em', textTransform: 'uppercase', color: P.textMuted, marginBottom: 2 }}>{k}</div>
                            <div style={{ fontFamily: CV_FONT.family, fontSize: CV_FONT.body, color: P.text }}>{String(v)}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bullets — individually toggleable, styled like ExperienceCard bullets */}
                    {bullets.length > 0 && (
                      <div className="flex flex-col">
                        <div style={{ fontFamily: CV_FONT.family, fontSize: CV_FONT.label, letterSpacing: '0.08em', textTransform: 'uppercase', color: P.textMuted, marginBottom: 6 }}>Bullets</div>
                        <div className="flex flex-col" style={{ gap: 6 }}>
                          {bullets.map((bullet, bi) => {
                            const bulletAccepted = acceptedKeys.has(`${i}.bullet.${bi}`)
                            return (
                              <div
                                key={bi}
                                onClick={(e) => { e.stopPropagation(); toggleBullet(i, bi) }}
                                className="flex items-start"
                                style={{ gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 3, background: bulletAccepted ? '#f9fafb' : 'transparent', border: `1px solid ${bulletAccepted ? P.border : 'transparent'}`, transition: 'background 150ms' }}
                              >
                                {/* Bullet checkbox */}
                                <div style={{
                                  width: 13, height: 13, marginTop: 3, flexShrink: 0, borderRadius: 2,
                                  border: `1.5px solid ${bulletAccepted ? accent : P.border}`,
                                  background: bulletAccepted ? accent : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'background 150ms, border-color 150ms',
                                }}>
                                  {bulletAccepted && <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                                </div>
                                <span style={{ color: P.textMuted, fontSize: CV_FONT.body, lineHeight: 1.5, flexShrink: 0 }}>•</span>
                                <span style={{ fontFamily: CV_FONT.family, fontSize: CV_FONT.body, color: P.text, lineHeight: 1.5, opacity: bulletAccepted ? 1 : 0.45 }}>
                                  {bullet}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${P.border}`, padding: '14px 28px', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
            <button
              onClick={() => { setStagingResult(null); setAcceptedKeys(new Set()) }}
              style={{ fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em', color: P.textMuted, background: 'none', border: `1px solid ${P.border}`, borderRadius: 3, padding: '7px 20px', cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.borderColor = '#ef4444' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = P.textMuted; (e.currentTarget as HTMLElement).style.borderColor = P.border }}
            >
              Discard All
            </button>
            <button
              disabled={acceptedChangesCount() === 0}
              onClick={acceptStaging}
              style={{
                fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em',
                color: acceptedChangesCount() === 0 ? P.border : P.bg,
                background: acceptedChangesCount() === 0 ? 'transparent' : P.text,
                border: `1px solid ${acceptedChangesCount() === 0 ? P.border : P.text}`,
                borderRadius: 3, padding: '7px 20px', cursor: acceptedChangesCount() === 0 ? 'default' : 'pointer',
              }}
            >
              Apply{acceptedChangesCount() > 0 ? ` (${acceptedChangesCount()})` : ''}
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
        <CanvasShell
          title="CURATED VIEW"
          headerRight={<>
            {overflowLines > 0 && (
              <div style={{ fontFamily: CV_FONT.family, fontSize: 12, textAlign: 'right', color: '#ef4444' }}>
                <div>⚠ Page overflow</div>
                <div style={{ fontSize: 11, marginTop: 2, color: '#fca5a5' }}>Shorten by ~{overflowLines} line{overflowLines !== 1 ? 's' : ''}</div>
              </div>
            )}
            {(() => {
              const total = curateResult.matchedKeywords.length
              const score = total > 0 ? Math.round((liveMatchScore / total) * 100) : 0
              const color = score >= 70 ? '#059669' : score >= 40 ? '#d97706' : '#ef4444'
              return (
                <div style={{ fontFamily: CV_FONT.family, fontSize: 12, textAlign: 'right', color: P.textMuted }}>
                  Keyword match{' '}
                  <span style={{ fontSize: 22, color, fontWeight: 'bold' }}>{score}</span>
                  <span style={{ fontSize: 13 }}>%</span>
                </div>
              )
            })()}
          </>}
          headerExtra={<>
            <div style={{ fontFamily: CV_FONT.family, fontSize: 12, color: P.textMuted, marginBottom: 10 }}>
              {liveMatchScore}/{curateResult.matchedKeywords.length} keywords matched
            </div>
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
                      <span key={kw} style={{ fontFamily: CV_FONT.family, fontSize: 11, color: hit ? '#059669' : '#ef4444', background: hit ? '#f0fdf4' : '#fef2f2', border: `1px solid ${hit ? '#bbf7d0' : '#fecaca'}`, borderRadius: 3, padding: '1px 7px' }}>
                        {kw}
                      </span>
                    )
                  })}
                </div>
              )
            })()}
          </>}
          footer={<>
            <button
              onClick={() => { playCloseBlip(); setCurateResult(null); setCuratedContent(null); setCuratedOrder([]); resetSaveState() }}
              style={{ fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em', color: P.textMuted, background: 'none', border: `1px solid ${P.border}`, borderRadius: 3, padding: '7px 20px', cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.borderColor = '#ef4444' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = P.textMuted; (e.currentTarget as HTMLElement).style.borderColor = P.border }}
            >
              Close
            </button>
            <button
              onClick={() => setScanOpen((v) => { const next = !v; localStorage.setItem('cv-scan-open', String(next)); return next })}
              style={{
                fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em', padding: '7px 20px', cursor: 'pointer',
                color: scanOpen ? P.text : P.textMuted,
                border: `1px solid ${scanOpen ? P.textMuted : P.border}`,
                borderRadius: 3, background: 'none',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = P.text; (e.currentTarget as HTMLElement).style.borderColor = P.textMuted }}
              onMouseLeave={(e) => { if (!scanOpen) { (e.currentTarget as HTMLElement).style.color = P.textMuted; (e.currentTarget as HTMLElement).style.borderColor = P.border } }}
            >
              6-Sec Scan
            </button>
            <button
              onClick={handleQuickWins}
              disabled={quickWinsPhase === 'thinking'}
              style={{
                fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em', padding: '7px 20px', cursor: quickWinsPhase === 'thinking' ? 'default' : 'pointer',
                color: quickWinsPhase === 'error' ? '#ef4444' : P.textMuted,
                border: `1px solid ${quickWinsPhase === 'error' ? '#ef4444' : P.border}`,
                borderRadius: 3, background: 'none',
              }}
              onMouseEnter={(e) => { if (quickWinsPhase === 'idle') { (e.currentTarget as HTMLElement).style.color = P.text; (e.currentTarget as HTMLElement).style.borderColor = P.textMuted } }}
              onMouseLeave={(e) => { if (quickWinsPhase === 'idle') { (e.currentTarget as HTMLElement).style.color = P.textMuted; (e.currentTarget as HTMLElement).style.borderColor = P.border } }}
            >
              {quickWinsPhase === 'thinking' ? 'Thinking…' : quickWinsPhase === 'error' ? 'Error' : 'Quick Wins ✦'}
            </button>
            <button
              onClick={handlePrintCurated}
              style={{ fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em', color: P.textMuted, background: 'none', border: `1px solid ${P.border}`, borderRadius: 3, padding: '7px 20px', cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = P.text; (e.currentTarget as HTMLElement).style.borderColor = P.textMuted }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = P.textMuted; (e.currentTarget as HTMLElement).style.borderColor = P.border }}
            >
              Download PDF
            </button>
            {savePhase === 'saving' && (
              <span style={{ fontFamily: CV_FONT.family, fontSize: 12, color: P.textMuted }}>Saving…</span>
            )}
            {savePhase === 'saved' && (
              <span style={{ fontFamily: CV_FONT.family, fontSize: 12, color: '#059669' }}>Saved ✓</span>
            )}
            {savePhase === 'error' && (
              <span style={{ fontFamily: CV_FONT.family, fontSize: 12, color: '#ef4444' }}>Save failed</span>
            )}
          </>}
        >
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
          {curatedContent && (
            <CVRenderer
              ref={curatedRendererRef}
              content={curatedContent}
              sectionOrder={curatedOrder}
              keywords={curateResult.matchedKeywords}
              onOverflowChange={setOverflowLines}
              onOrderChange={setCuratedOrder}
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
          )}
        </CanvasShell>
      )}

      {/* ── Editor ──────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-y-auto" style={{ display: previewOpen ? 'none' : 'block' }}>
        <div className="mx-auto flex flex-col gap-2 px-4 pb-8" style={{ width: 'min(72vw, 860px)', paddingTop: 100 }}>

          {/* Drop zone */}
          <input
            ref={dropZoneInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) handleDropFile(file)
            }}
          />
          <div
            className="mb-6 w-full"
            onClick={() => { if (importPhase === 'idle') dropZoneInputRef.current?.click() }}
            onDragOver={(e) => { e.preventDefault(); if (importPhase === 'idle') setDropActive(true) }}
            onDragEnter={(e) => { e.preventDefault(); if (importPhase === 'idle') setDropActive(true) }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDropActive(false)
              const file = e.dataTransfer.files?.[0]
              if (file) handleDropFile(file)
            }}
            style={{
              background: dropActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
              border: `1px dashed ${importPhase === 'error' ? 'rgba(252,165,165,0.4)' : dropActive ? 'rgba(156,163,175,0.5)' : 'rgba(229,231,235,0.35)'}`,
              borderRadius: 4,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              cursor: importPhase !== 'idle' ? 'default' : 'pointer',
              transition: 'border-color 150ms, background 150ms',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '32px 0',
              userSelect: 'none',
            }}
          >
            {/* + icon */}
            <span style={{
              fontFamily: "'Carlito', 'Calibri', sans-serif",
              fontSize: 28,
              lineHeight: 1,
              color: importPhase === 'error' ? 'rgba(252,165,165,0.35)' : importPhase !== 'idle' ? 'rgba(156,163,175,0.35)' : dropActive ? 'rgba(107,114,128,0.35)' : 'rgba(209,213,219,0.35)',
              transition: 'color 150ms',
            }}>
              +
            </span>
            <span style={{
              fontFamily: "'Carlito', 'Calibri', sans-serif",
              fontSize: 13,
              fontVariant: 'small-caps',
              letterSpacing: '0.06em',
              color: importPhase === 'error' ? 'rgba(252,165,165,0.35)' : importPhase !== 'idle' ? 'rgba(156,163,175,0.35)' : dropActive ? 'rgba(107,114,128,0.35)' : 'rgba(209,213,219,0.35)',
              transition: 'color 150ms',
            }}>
              {importPhase === 'parsing' ? 'Parsing…' : importPhase === 'thinking' ? 'Thinking…' : importPhase === 'error' ? (importError ?? 'Error') : 'Drag Resumes, Project Descriptions, Skills Here'}
            </span>
            {importPhase === 'idle' && !importError && (
              <span style={{
                fontFamily: "'Carlito', 'Calibri', sans-serif",
                fontSize: 11,
                color: 'rgba(229,231,235,0.25)',
                letterSpacing: '0.04em',
              }}>
                PDF · DOCX · TXT
              </span>
            )}
          </div>

      

          {/* Main Info — always locked to top, no drag handle */}
          <MainInfoCard data={mainInfo} collapsed={collapsed.main ?? false} onChange={setMainInfo} onToggleCollapse={() => toggleCollapse('main')} />

          {/* Draggable sections — rendered in sectionOrder */}
          {sectionOrder.filter((id) => id !== 'main').map((id) => {
            const sum  = summaries.find((s) => s.id === id)
            const edu  = educations.find((e) => e.id === id)
            const exp  = experiences.find((e) => e.id === id)
            const proj = projects.find((p) => p.id === id)
            const cert = certifications.find((c) => c.id === id)
            const awd  = awards.find((a) => a.id === id)
            const isSkills = id === 'skills'
            if (!sum && !edu && !exp && !proj && !cert && !awd && !isSkills) return null

            const isDragging = dragId === id
            const isOver     = dragOverId === id

            return (
              <div
                key={id}
                draggable
                onDragStart={(e) => {
                  if (!dragFromHandle.current) { e.preventDefault(); return }
                  setDragId(id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => { setDragId(null); setDragOverId(null); dragFromHandle.current = false }}
                onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== id) setDragOverId(id) }}
                onDragLeave={() => { if (dragOverId === id) setDragOverId(null) }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (!dragId || dragId === id) return
                  const next = sectionOrder.filter((x) => x !== dragId)
                  const idx  = next.indexOf(id)
                  next.splice(idx, 0, dragId)
                  setSectionOrder(next)
                  setDragId(null)
                  setDragOverId(null)
                }}
                style={{
                  position: 'relative',
                  opacity: isDragging ? 0.4 : 1,
                  outline: isOver ? `2px solid ${P.textMuted}` : 'none',
                  outlineOffset: 2,
                  borderRadius: 4,
                  transition: 'opacity 150ms',
                }}
              >
                {/* Drag handle — sits outside the card, left-aligned */}
                <div
                  onMouseDown={() => { dragFromHandle.current = true }}
                  onMouseUp={() => { dragFromHandle.current = false }}
                  title="Drag to reorder"
                  style={{
                    position: 'absolute', left: -22, top: 0, bottom: 0,
                    width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'grab', color: P.border, userSelect: 'none', fontSize: 14,
                  }}
                >
                  ⠿
                </div>
                {sum && <SummaryCard data={sum} collapsed={collapsed[id] ?? false}
                  onChange={(u: Summary) => setSummaries(summaries.map((s) => s.id === u.id ? u : s))}
                  onToggleCollapse={() => toggleCollapse(id)}
                  onDelete={() => setSummaries(summaries.filter((s) => s.id !== id))} />}
                {edu && <EducationCard data={edu} collapsed={collapsed[id] ?? false}
                  onChange={(u: Education) => setEducations(educations.map((e) => e.id === u.id ? u : e))}
                  onToggleCollapse={() => toggleCollapse(id)}
                  onDelete={() => setEducations(educations.filter((e) => e.id !== id))} />}
                {exp && <ExperienceCard data={exp} collapsed={collapsed[id] ?? false}
                  onChange={(u: Experience) => setExperiences(experiences.map((e) => e.id === u.id ? u : e))}
                  onToggleCollapse={() => toggleCollapse(id)}
                  onDelete={() => setExperiences(experiences.filter((e) => e.id !== id))} />}
                {proj && <ProjectCard data={proj} collapsed={collapsed[id] ?? false}
                  onChange={(u: Project) => setProjects(projects.map((p) => p.id === u.id ? u : p))}
                  onToggleCollapse={() => toggleCollapse(id)}
                  onDelete={() => setProjects(projects.filter((p) => p.id !== id))} />}
                {isSkills && skills && <SkillsBucketCard data={skills} collapsed={collapsed.skills ?? false}
                  onChange={(u: SkillsBucket) => setSkills(u)}
                  onToggleCollapse={() => toggleCollapse('skills')}
                  onDelete={() => setSkills(null)} />}
                {cert && <CertificationCard data={cert} collapsed={collapsed[id] ?? false}
                  onChange={(u: Certification) => setCertifications(certifications.map((c) => c.id === u.id ? u : c))}
                  onToggleCollapse={() => toggleCollapse(id)}
                  onDelete={() => setCertifications(certifications.filter((c) => c.id !== id))} />}
                {awd && <AwardCard data={awd} collapsed={collapsed[id] ?? false}
                  onChange={(u: Award) => setAwards(awards.map((a) => a.id === u.id ? u : a))}
                  onToggleCollapse={() => toggleCollapse(id)}
                  onDelete={() => setAwards(awards.filter((a) => a.id !== id))} />}
              </div>
            )
          })}

          {/* Add Section button */}
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => setNewMenuOpen(true)}
              style={{
                fontFamily: "'Carlito', 'Calibri', sans-serif",
                fontSize: 14,
                fontVariant: 'small-caps',
                letterSpacing: '0.03em',
                color: '#111827',
                border: '1px solid #e5e7eb',
                borderRadius: 3,
                background: '#ffffff',
                padding: '5px 14px',
                cursor: 'pointer',
              }}
            >
              Add Section
            </button>
          </div>

          {/* Add Section modal */}
          {newMenuOpen && (
            <div
              className="fixed inset-0 flex items-center justify-center"
              style={{ zIndex: 50, background: 'rgba(0,0,0,0.25)' }}
              onClick={() => setNewMenuOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  minWidth: 280,
                  fontFamily: "'Carlito', 'Calibri', sans-serif",
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '16px 20px 12px', borderBottom: '0.5pt solid #111827' }}>
                  <span style={{ fontSize: '14pt', fontVariant: 'small-caps', letterSpacing: '0.03em', color: '#111827' }}>
                    Add Section
                  </span>
                </div>
                <div className="flex flex-col">
                  {NEW_ITEMS.map((item) => {
                    const disabled = item === 'Skills' && skills !== null
                    return (
                      <button key={item} disabled={disabled}
                        onClick={() => {
                          if (item === 'Summary')            spawnSummary()
                          else if (item === 'Experience')    spawnExperience()
                          else if (item === 'Education')     spawnEducation()
                          else if (item === 'Project')       spawnProject()
                          else if (item === 'Skills')        spawnSkills()
                          else if (item === 'Certification') spawnCertification()
                          else if (item === 'Award')         spawnAward()
                          setNewMenuOpen(false)
                        }}
                        style={{
                          fontFamily: "'Carlito', 'Calibri', sans-serif",
                          fontSize: 14,
                          fontVariant: 'small-caps',
                          letterSpacing: '0.03em',
                          color: disabled ? '#d1d5db' : '#6b7280',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px solid #f3f4f6',
                          padding: '12px 20px',
                          textAlign: 'left',
                          cursor: disabled ? 'default' : 'pointer',
                          width: '100%',
                        }}
                        onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.color = '#111827' }}
                        onMouseLeave={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.color = '#6b7280' }}
                      >
                        {item}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

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
