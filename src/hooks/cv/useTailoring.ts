import { useState, useRef, useEffect, useMemo } from 'react'
import { useAI } from '@/hooks/useAI'
import { PROMPT_CURATE_RESUME } from '@/config/aiPrompts'
import { fetchTailoredResume } from '@/services/tailoredResumeService'
import { playCloseBlip, playAiDing } from '@/lib/sfx'
import { useUndoRedo } from '@/lib/useUndoRedo'
import type { CVContent, Experience, Project, Summary, Education, Certification, Award, MainInfo } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TailorExpEntry   { id: string; bullets: string[] }
interface TailorProjEntry  { id: string; bullets: string[] }
interface TailorSkillGroup { id: string; label: string; skills: string[] }
interface TailorSkills     { evergreen: string[]; modular: TailorSkillGroup[] }

export interface TailorResult {
  matchedKeywords: string[]
  summary: string | null
  experiences: TailorExpEntry[]
  projects: TailorProjEntry[]
  skills: TailorSkills
}

interface TailoringDeps {
  visible: boolean
  cvLoading: boolean
  userId: string | null | undefined
  initialJobId?: string | null
  initialCompany?: string | null
  initialTailorText?: string | null
  initialTailoredResumeId?: string | null
  cvContent: CVContent
  mainInfo: MainInfo
  experiences: Experience[]
  projects: Project[]
  summaries: Summary[]
  educations: Education[]
  certifications: Certification[]
  awards: Award[]
  savedResumeCount: number
  onInitialTailorConsumed?: () => void
  onResumeSaved?: (jobId: string, resumeId: string) => void
  createTailoredResume: (uid: string, label: string, content: CVContent, sectionOrder: string[], matchedKeywords: string[]) => Promise<{ id: string } | null>
  updateTailoredResumeRecord: (id: string, content: CVContent, sectionOrder: string[]) => Promise<void>
}

export function useTailoring({
  visible,
  cvLoading,
  userId,
  initialJobId,
  initialCompany,
  initialTailorText,
  initialTailoredResumeId,
  cvContent,
  mainInfo,
  experiences,
  projects,
  summaries,
  educations,
  certifications,
  awards,
  savedResumeCount,
  onInitialTailorConsumed,
  onResumeSaved,
  createTailoredResume,
  updateTailoredResumeRecord,
}: TailoringDeps) {
  const { run: runAI } = useAI()

  const [tailorPhase, setTailorPhase]     = useState<'idle' | 'thinking' | 'error'>('idle')
  const [tailorResult, setTailorResult]   = useState<TailorResult | null>(null)
  const [tailoredOrder, setTailoredOrder] = useState<string[]>([])

  const {
    state:    tailoredContent,
    push:     pushTailoredContent,
    debouncedPush: debouncedPushTailoredContent,
    undo:     undoTailoredContent,
    redo:     redoTailoredContent,
    canUndo:  canUndoTailoredContent,
    canRedo:  canRedoTailoredContent,
    reset:    resetTailoredContent,
  } = useUndoRedo<CVContent | null>(null)
  const [savePhase, setSavePhase]           = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [quickWinsPhase, setQuickWinsPhase] = useState<'idle' | 'thinking' | 'error'>('idle')
  const [scanOpen, setScanOpen]             = useState(() => localStorage.getItem('cv-scan-open') === 'true')
  const [panelRect, setPanelRect]           = useState<{ left: number; width: number; top: number; height: number } | null>(null)
  const [overflowLines, setOverflowLines]   = useState(0)

  const pendingJobIdRef  = useRef<string | null>(null)
  const initialHandledRef = useRef(false)
  const autoSavedRef     = useRef(false)
  const freshTailoredRef = useRef(false)
  const viewResumeIdRef  = useRef<string | null>(null)
  const viewLoadedRef    = useRef(false)

  // ── Reset guards on visibility change ────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      initialHandledRef.current = false
      autoSavedRef.current = false
      freshTailoredRef.current = false
      viewResumeIdRef.current = null
      viewLoadedRef.current = false
    }
  }, [visible])

  // ── Auto-trigger when opened from job row ─────────────────────────────────
  useEffect(() => {
    if (!visible || cvLoading) return
    if (initialHandledRef.current) return
    initialHandledRef.current = true
    pendingJobIdRef.current = initialJobId ?? null

    if (initialTailoredResumeId) {
      setTailorResult(null)
      setTailorPhase('thinking')
      fetchTailoredResume(initialTailoredResumeId).then((resume) => {
        if (!resume) { setTailorPhase('idle'); return }
        setTailorResult({
          matchedKeywords: resume.matchedKeywords,
          summary: null,
          experiences: resume.content.experiences.map((e: { id: string; bullets: string[] }) => ({ id: e.id, bullets: e.bullets })),
          projects:    resume.content.projects.map((p: { id: string; bullets: string[] })    => ({ id: p.id, bullets: p.bullets })),
          skills:      resume.content.skills
            ? { evergreen: resume.content.skills.evergreen, modular: resume.content.skills.modular.map((g: { id: string; label: string; skills: string[] }) => ({ id: g.id, label: g.label, skills: g.skills })) }
            : { evergreen: [], modular: [] },
        })
        resetTailoredContent(resume.content)
        setTailoredOrder(resume.sectionOrder)
        setTailorPhase('idle')
        onInitialTailorConsumed?.()
      })
    } else if (initialTailorText) {
      handleTailor(initialTailorText)
      onInitialTailorConsumed?.()
    }
  }, [visible, cvLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save after fresh AI tailor from job context ─────────────────────
  useEffect(() => {
    if (tailorPhase !== 'idle' || !tailoredContent || !tailorResult || !userId) return
    if (!pendingJobIdRef.current) return
    if (!freshTailoredRef.current) return
    if (autoSavedRef.current) return
    if (savePhase !== 'idle') return
    autoSavedRef.current = true
    handleSave()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tailorPhase, tailoredContent, tailorResult, userId, savePhase])

  // ── Auto-update when viewing an existing tailored resume ──────────────────
  useEffect(() => {
    if (initialTailoredResumeId && tailorPhase === 'idle' && tailoredContent && !freshTailoredRef.current) {
      if (viewResumeIdRef.current !== initialTailoredResumeId) {
        viewResumeIdRef.current = initialTailoredResumeId
        viewLoadedRef.current = false
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tailorPhase, tailoredContent])

  useEffect(() => {
    if (!viewResumeIdRef.current || !tailoredContent) return
    if (!viewLoadedRef.current) { viewLoadedRef.current = true; return }
    updateTailoredResumeRecord(viewResumeIdRef.current, tailoredContent, tailoredOrder)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tailoredContent, tailoredOrder])

  // ── Keyboard shortcuts for the result panel ───────────────────────────────
  useEffect(() => {
    if (!tailorResult) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { playCloseBlip(); closeTailorResult(); return }
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); undoTailoredContent(); return }
      if (e.ctrlKey && e.shiftKey  && e.key === 'z') { e.preventDefault(); redoTailoredContent(); return }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [tailorResult]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core tailor handler ───────────────────────────────────────────────────
  function handleTailor(jdText: string) {
    const text = jdText.trim()
    if (!text) return
    setTailorResult(null)
    setTailorPhase('thinking')

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
          const parsed = JSON.parse(cleaned) as TailorResult
          setTailorResult(parsed)

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

          resetTailoredContent({ mainInfo, summaries: cSummaries, experiences: cExperiences, educations, projects: cProjects, skills: cSkills, certifications, awards })
          setTailoredOrder(cOrder)
          freshTailoredRef.current = true
          setTailorPhase('idle')
          requestAnimationFrame(playAiDing)
        } catch {
          setTailorPhase('error')
          setTimeout(() => setTailorPhase('idle'), 4000)
        }
      },
      onError: () => {
        setTailorPhase('error')
        setTimeout(() => setTailorPhase('idle'), 4000)
      },
    })
  }

  // ── Save handler ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!tailoredContent || !tailorResult || !userId) return
    setSavePhase('saving')

    const lastName = mainInfo.fullName.trim().split(/\s+/).pop() ?? 'Resume'
    const label = initialCompany?.trim()
      ? `${initialCompany.trim()}_${lastName}`
      : `${lastName}_${savedResumeCount + 1}`

    const saved = await createTailoredResume(userId, label, tailoredContent, tailoredOrder, tailorResult.matchedKeywords)

    if (!saved) {
      setSavePhase('error')
      setTimeout(() => setSavePhase('idle'), 4000)
    } else {
      const jobId = pendingJobIdRef.current
      if (jobId) onResumeSaved?.(jobId, saved.id)
      pendingJobIdRef.current = null
      setSavePhase('saved')
      setTimeout(() => setSavePhase('idle'), 1500)
    }
  }

  function closeTailorResult() {
    setTailorResult(null)
    resetTailoredContent(null)
    setTailoredOrder([])
    setSavePhase('idle')
  }

  // ── Print handler ─────────────────────────────────────────────────────────
  function handlePrint(paperElement: HTMLElement | null) {
    if (!paperElement) return

    const clone = paperElement.cloneNode(true) as HTMLElement
    clone.querySelectorAll('mark').forEach((mark) => {
      mark.replaceWith(...Array.from(mark.childNodes))
    })
    clone.id = 'cv-print-target'
    clone.style.boxShadow = 'none'

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

    const label = initialCompany?.trim() ? `${initialCompany.trim()}_resume` : 'resume'
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

  // ── Quick wins handler ────────────────────────────────────────────────────
  function handleQuickWins() {
    if (!tailoredContent || !tailorResult) return
    setQuickWinsPhase('thinking')

    const allText = [
      ...tailoredContent.experiences.flatMap((e) => e.bullets),
      ...tailoredContent.projects.flatMap((p) => p.bullets),
      ...(tailoredContent.skills ? [...tailoredContent.skills.evergreen, ...tailoredContent.skills.modular.flatMap((g) => g.skills)] : []),
      ...tailoredContent.summaries.map((s) => s.text),
    ].join(' ').toLowerCase()

    const missingKeywords = tailorResult.matchedKeywords.filter((kw) => !allText.includes(kw.toLowerCase()))
    const prompt =
      'MISSING KEYWORDS: ' + (missingKeywords.length ? missingKeywords.join(', ') : 'none') + '\n\n' +
      'TAILORED CV:\n' + JSON.stringify(tailoredContent, null, 2)

    runAI({
      system:
        'You are a resume editor. Given missing keywords and a tailored CV, surface as many keywords as possible using only minimal edits. Look for ALL of these opportunities:\n\n' +
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

          if (!tailoredContent) { setQuickWinsPhase('idle'); return }
          let next = { ...tailoredContent }
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
          pushTailoredContent(next)

          setTailoredOrder((prevOrder) => {
            if (!tailorResult) return prevOrder
            const keywords = tailorResult.matchedKeywords.map((k) => k.toLowerCase())
            const score = (text: string) => keywords.reduce((n, kw) => n + (text.toLowerCase().includes(kw) ? 1 : 0), 0)

            const pinned: string[] = []
            const expIds: string[] = []
            const projIds: string[] = []
            const skillsId: string[] = []
            const restIds: string[] = []

            for (const id of prevOrder) {
              if (id === 'main')                                                        { pinned.push(id);   continue }
              if (tailoredContent?.summaries.find((s) => s.id === id))                 { pinned.push(id);   continue }
              if (tailoredContent?.educations.find((e) => e.id === id))                { pinned.push(id);   continue }
              if (tailoredContent?.experiences.find((e) => e.id === id))               { expIds.push(id);   continue }
              if (tailoredContent?.projects.find((p) => p.id === id))                  { projIds.push(id);  continue }
              if (id === 'skills')                                                      { skillsId.push(id); continue }
              restIds.push(id)
            }

            const expScore    = tailoredContent?.experiences.reduce((n, e) => n + e.bullets.reduce((m, b) => m + score(b), 0), 0) ?? 0
            const projScore   = tailoredContent?.projects.reduce((n, p) => n + p.bullets.reduce((m, b) => m + score(b), 0), 0) ?? 0
            const skillsText  = tailoredContent?.skills
              ? [...tailoredContent.skills.evergreen, ...tailoredContent.skills.modular.flatMap((g) => g.skills)].join(' ')
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

  // ── Live match score ──────────────────────────────────────────────────────
  const liveMatchScore = useMemo(() => {
    if (!tailorResult || !tailoredContent) return 0
    const keywords = tailorResult.matchedKeywords
    if (!keywords.length) return 0
    const allText = [
      ...tailoredContent.experiences.flatMap((e) => e.bullets),
      ...tailoredContent.projects.flatMap((p) => p.bullets),
      ...(tailoredContent.skills ? [...tailoredContent.skills.evergreen, ...tailoredContent.skills.modular.flatMap((g) => g.skills)] : []),
      ...tailoredContent.summaries.map((s) => s.text),
    ].join(' ').toLowerCase()
    return keywords.filter((kw) => allText.includes(kw.toLowerCase())).length
  }, [tailorResult, tailoredContent])

  return {
    tailorPhase,
    tailorResult,
    tailoredContent,
    setTailoredContent: debouncedPushTailoredContent,
    undoTailoredContent,
    redoTailoredContent,
    canUndoTailoredContent,
    canRedoTailoredContent,
    tailoredOrder, setTailoredOrder,
    savePhase,
    quickWinsPhase,
    scanOpen, setScanOpen,
    panelRect, setPanelRect,
    overflowLines, setOverflowLines,
    liveMatchScore,
    handleTailor,
    handleSave,
    handlePrint,
    handleQuickWins,
    closeTailorResult,
  }
}
