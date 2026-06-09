import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { useCVState } from '@/hooks/cv/useCVState'
import { useTailoredResume } from '@/hooks/cv/useTailoredResume'
import { useTailoring } from '@/hooks/cv/useTailoring'
import { useOrganizer } from '@/hooks/cv/useOrganizer'
import { ensureCrtStyles } from '@/lib/crtTheme'
import type { CVCanvasHandle, Experience, Education, Project, SkillsBucket, Summary, Certification, Award } from '@/types'
import MainInfoCard from './MainInfoCard'
import ExperienceCard from './ExperienceCard'
import EducationCard from './EducationCard'
import ProjectCard from './ProjectCard'
import SkillsBucketCard from './SkillsBucketCard'
import SummaryCard from './SummaryCard'
import CertificationCard from './CertificationCard'
import AwardCard from './AwardCard'
import CVRenderer from './CVRenderer'
import TailoringResultPanel from './TailoringResultPanel'
import OrganizerStagingPanel from './OrganizerStagingPanel'
import { P } from '@/lib/CVCardTheme'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

ensureCrtStyles()

// ── id helper ─────────────────────────────────────────────────────────────────
let _seq = 0
function nextId(prefix: string) { return `${prefix}-${++_seq}` }

const NEW_ITEMS = ['Summary', 'Experience', 'Education', 'Project', 'Skills', 'Certification', 'Award'] as const

interface Props {
  visible?: boolean
  userName?: string | null
  userId?: string | null
  initialTailorText?: string | null
  initialTailoredResumeId?: string | null
  initialCompany?: string | null
  initialJobId?: string | null
  onInitialTailorConsumed?: () => void
  onResumeSaved?: (jobId: string, resumeId: string) => void
  onClose?: () => void
  onPreviewOpenChange?: (open: boolean) => void
}

const CVCanvas = forwardRef<CVCanvasHandle, Props>(function CVCanvas({
  visible = true,
  userName: _userName,
  userId,
  initialTailorText,
  initialTailoredResumeId,
  initialCompany,
  initialJobId,
  onInitialTailorConsumed,
  onResumeSaved,
  onClose: _onClose,
  onPreviewOpenChange,
}: Props, ref) {
  const {
    resumes: savedResumes,
    handleCreate: createTailoredResume,
    handleUpdate: updateTailoredResumeRecord,
  } = useTailoredResume(userId ?? null)

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

  const tailoring = useTailoring({
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
    savedResumeCount: savedResumes.length,
    onInitialTailorConsumed,
    onResumeSaved,
    createTailoredResume,
    updateTailoredResumeRecord,
  })

  const organizer = useOrganizer({
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
  })

  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Card drag-to-reorder state
  const [dragId, setDragId]         = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragFromHandle              = useRef(false)

  // Drop zone UI state
  const [dropActive, setDropActive] = useState(false)
  const dropZoneInputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    openPreview:    () => setPreviewOpen((v) => !v),
    openAddSection: () => setNewMenuOpen(true),
  }))

  useEffect(() => { onPreviewOpenChange?.(previewOpen) }, [previewOpen]) // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* ── Organizer staging screen ─────────────────────────────────────── */}
      {organizer.stagingResult && (
        <OrganizerStagingPanel
          result={organizer.stagingResult}
          acceptedKeys={organizer.acceptedKeys}
          acceptedChangesCount={organizer.acceptedChangesCount()}
          onToggleChange={organizer.toggleChange}
          onToggleBullet={organizer.toggleBullet}
          onAccept={organizer.acceptStaging}
          onDiscard={organizer.discardStaging}
        />
      )}

      {/* ── Tailoring result panel (thinking screen + result view) ────────── */}
      <TailoringResultPanel
        tailorPhase={tailoring.tailorPhase}
        tailorResult={tailoring.tailorResult}
        tailoredContent={tailoring.tailoredContent}
        tailoredOrder={tailoring.tailoredOrder}
        savePhase={tailoring.savePhase}
        quickWinsPhase={tailoring.quickWinsPhase}
        scanOpen={tailoring.scanOpen}
        panelRect={tailoring.panelRect}
        overflowLines={tailoring.overflowLines}
        liveMatchScore={tailoring.liveMatchScore}
        onClose={tailoring.closeTailorResult}
        onScanToggle={tailoring.setScanOpen}
        onQuickWins={tailoring.handleQuickWins}
        onPrint={tailoring.handlePrint}
        onOverflowChange={tailoring.setOverflowLines}
        onOrderChange={tailoring.setTailoredOrder}
        onPanelRectChange={tailoring.setPanelRect}
        onContentChange={tailoring.setTailoredContent}
      />

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
              if (file) organizer.handleDropFile(file)
            }}
          />
          <div
            className="mb-6 w-full"
            onClick={() => { if (organizer.importPhase === 'idle') dropZoneInputRef.current?.click() }}
            onDragOver={(e) => { e.preventDefault(); if (organizer.importPhase === 'idle') setDropActive(true) }}
            onDragEnter={(e) => { e.preventDefault(); if (organizer.importPhase === 'idle') setDropActive(true) }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDropActive(false)
              const file = e.dataTransfer.files?.[0]
              if (file) organizer.handleDropFile(file)
            }}
            style={{
              background: dropActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
              border: `1px dashed ${organizer.importPhase === 'error' ? 'rgba(252,165,165,0.4)' : dropActive ? 'rgba(156,163,175,0.5)' : 'rgba(229,231,235,0.35)'}`,
              borderRadius: 4,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              cursor: organizer.importPhase !== 'idle' ? 'default' : 'pointer',
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
            <span style={{ fontFamily: "'Carlito', 'Calibri', sans-serif", fontSize: 28, lineHeight: 1, color: organizer.importPhase === 'error' ? 'rgba(252,165,165,0.35)' : organizer.importPhase !== 'idle' ? 'rgba(156,163,175,0.35)' : dropActive ? 'rgba(107,114,128,0.35)' : 'rgba(209,213,219,0.35)', transition: 'color 150ms' }}>
              +
            </span>
            <span style={{ fontFamily: "'Carlito', 'Calibri', sans-serif", fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.06em', color: organizer.importPhase === 'error' ? 'rgba(252,165,165,0.35)' : organizer.importPhase !== 'idle' ? 'rgba(156,163,175,0.35)' : dropActive ? 'rgba(107,114,128,0.35)' : 'rgba(209,213,219,0.35)', transition: 'color 150ms' }}>
              {organizer.importPhase === 'parsing' ? 'Parsing…' : organizer.importPhase === 'thinking' ? 'Thinking…' : organizer.importPhase === 'error' ? (organizer.importError ?? 'Error') : 'Drag Resumes, Project Descriptions, Skills Here'}
            </span>
            {organizer.importPhase === 'idle' && !organizer.importError && (
              <span style={{ fontFamily: "'Carlito', 'Calibri', sans-serif", fontSize: 11, color: 'rgba(229,231,235,0.25)', letterSpacing: '0.04em' }}>
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
                style={{ position: 'relative', opacity: isDragging ? 0.4 : 1, outline: isOver ? `2px solid ${P.textMuted}` : 'none', outlineOffset: 2, borderRadius: 4, transition: 'opacity 150ms' }}
              >
                <div
                  onMouseDown={() => { dragFromHandle.current = true }}
                  onMouseUp={() => { dragFromHandle.current = false }}
                  title="Drag to reorder"
                  style={{ position: 'absolute', left: -22, top: 0, bottom: 0, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', color: P.border, userSelect: 'none', fontSize: 14 }}
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

          {/* Add Section modal */}
          {newMenuOpen && (
            <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 50, background: 'rgba(0,0,0,0.25)' }} onClick={() => setNewMenuOpen(false)}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: 280, fontFamily: "'Carlito', 'Calibri', sans-serif", overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px 12px', borderBottom: '0.5pt solid #111827' }}>
                  <span style={{ fontSize: '14pt', fontVariant: 'small-caps', letterSpacing: '0.03em', color: '#111827' }}>Add Section</span>
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
                        style={{ fontFamily: "'Carlito', 'Calibri', sans-serif", fontSize: 14, fontVariant: 'small-caps', letterSpacing: '0.03em', color: disabled ? '#d1d5db' : '#6b7280', background: 'transparent', border: 'none', borderBottom: '1px solid #f3f4f6', padding: '12px 20px', textAlign: 'left', cursor: disabled ? 'default' : 'pointer', width: '100%' }}
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
})

export default CVCanvas
