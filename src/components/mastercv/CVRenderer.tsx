import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import type { CVContent } from '@/services/cvService'
import type { MainInfo }      from './MainInfoCard'
import type { Summary }       from './SummaryCard'
import type { Experience }    from './ExperienceCard'
import type { Education }     from './EducationCard'
import type { Project }       from './ProjectCard'
import type { SkillsBucket }  from './SkillsBucketCard'
import type { Certification } from './CertificationCard'
import type { Award }         from './AwardCard'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContentChangeEvent =
  | { type: 'mainInfo';       data: Partial<MainInfo> }
  | { type: 'summary';        id: string; data: Partial<Summary> }
  | { type: 'experience';     id: string; data: Partial<Experience> }
  | { type: 'education';      id: string; data: Partial<Education> }
  | { type: 'project';        id: string; data: Partial<Project> }
  | { type: 'skills';         data: Partial<SkillsBucket> }
  | { type: 'certification';  id: string; data: Partial<Certification> }
  | { type: 'award';          id: string; data: Partial<Award> }

interface Props {
  content: CVContent
  sectionOrder: string[]
  onChange?: (e: ContentChangeEvent) => void
  keywords?: string[]
  onOverflowChange?: (overflowLines: number) => void
}

type SectionType =
  | 'main' | 'summary' | 'experience' | 'education'
  | 'project' | 'skills' | 'certification' | 'award' | 'unknown'

function getSectionType(id: string): SectionType {
  if (id === 'main')           return 'main'
  if (id === 'skills')         return 'skills'
  if (id.startsWith('sum-'))   return 'summary'
  if (id.startsWith('exp-'))   return 'experience'
  if (id.startsWith('edu-'))   return 'education'
  if (id.startsWith('proj-'))  return 'project'
  if (id.startsWith('cert-'))  return 'certification'
  if (id.startsWith('awd-'))   return 'award'
  return 'unknown'
}

// ── Styles ────────────────────────────────────────────────────────────────────

const RESUME_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Carlito:ital,wght@0,400;0,700;1,400;1,700&display=swap');

  .cv-paper {
    font-family: 'Carlito', sans-serif;
    font-size: 12pt;
    line-height: 1.25;
    color: #000;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    background: #fff;
    width: 816px;
    min-height: 1056px;
    box-sizing: border-box;
    padding: 48px 48px 48px 48px;
    box-shadow: 0 4px 32px rgba(0,0,0,0.5);
  }

  .resume-name {
    font-family: 'Carlito', sans-serif;
    font-size: 20pt;
    font-weight: bold;
    letter-spacing: 0.04em;
    line-height: 1.1;
  }

  .resume-contact {
    font-size: 9.5pt;
    margin-top: 2px;
  }
  .resume-contact-sep {
    margin: 0 4px;
    color: #444;
  }

  .resume-section-heading {
    font-family: 'Carlito', sans-serif;
    font-size: 11.5pt;
    font-weight: normal;
    letter-spacing: 0.03em;
    margin: 10px 0 0 0;
    padding: 0;
    line-height: 1.1;
  }
  .resume-section-rule {
    border: none;
    border-top: 0.5pt solid #000;
    margin: 1px 0 4px 0;
  }

  .resume-sublist {
    margin: 0;
    padding: 0 0 0 14px;
    list-style: none;
  }

  .resume-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 1px 0;
  }
  .resume-row-bold   { font-size: 11pt; font-weight: bold; }
  .resume-row-right  { font-size: 11pt; }
  .resume-row-italic { font-size: 10pt; font-style: italic; }

  .resume-bullets {
    list-style: none;
    margin: 1px 0 4px 0;
    padding: 0 0 0 16px;
  }
  .resume-bullets li {
    font-size: 11pt;
    margin: 0;
    padding-left: 4px;
    position: relative;
    line-height: 1.35;
  }
  .resume-bullets li::before {
    content: '';
    position: absolute;
    left: -8px;
    top: 6px;
    width: 3px;
    height: 3px;
    background: #000;
    border-radius: 50%;
  }

  .resume-skills-list {
    list-style: none;
    margin: 2px 0;
    padding: 0 0 0 14px;
  }
  .resume-skills-list li {
    font-size: 11pt;
    margin: 1px 0;
    line-height: 1.3;
  }

  [contenteditable]:focus {
    outline: 1.5px solid rgba(59,130,246,0.5);
    border-radius: 1px;
  }
`

// ── Helpers ───────────────────────────────────────────────────────────────────

const E_STYLE: React.CSSProperties = { outline: 'none', cursor: 'text', minWidth: 4 }

// ── Keyword highlighting ──────────────────────────────────────────────────────

// Splits text into segments, each tagged with a highlight level or null.
function tokenize(text: string, keywords: string[]): { segment: string; level: 'exact' | 'close' | null }[] {
  if (!keywords.length) return [{ segment: text, level: null }]

  // Build list of all match ranges
  type Range = { start: number; end: number; level: 'exact' | 'close' }
  const ranges: Range[] = []

  for (const kw of keywords) {
    const k = kw.toLowerCase()
    const t = text.toLowerCase()
    let idx = 0
    while (idx < t.length) {
      const pos = t.indexOf(k, idx)
      if (pos === -1) break
      const wb = new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`)
      const realLevel: 'exact' | 'close' = wb.test(text.slice(Math.max(0, pos - 1), pos + k.length + 1).toLowerCase()) ? 'exact' : 'close'
      ranges.push({ start: pos, end: pos + k.length, level: realLevel })
      idx = pos + k.length
    }
  }

  if (!ranges.length) return [{ segment: text, level: null }]

  // Merge overlapping ranges (prefer 'exact' over 'close')
  ranges.sort((a, b) => a.start - b.start)
  const merged: Range[] = []
  for (const r of ranges) {
    const prev = merged[merged.length - 1]
    if (prev && r.start < prev.end) {
      prev.end = Math.max(prev.end, r.end)
      if (r.level === 'exact') prev.level = 'exact'
    } else {
      merged.push({ ...r })
    }
  }

  // Build segments
  const result: { segment: string; level: 'exact' | 'close' | null }[] = []
  let cursor = 0
  for (const { start, end, level } of merged) {
    if (cursor < start) result.push({ segment: text.slice(cursor, start), level: null })
    result.push({ segment: text.slice(start, end), level })
    cursor = end
  }
  if (cursor < text.length) result.push({ segment: text.slice(cursor), level: null })
  return result
}

// Renders text with keyword highlights. When editable, swaps to a plain
// contentEditable on focus and back to the highlighted view on blur.
function HL({
  text, keywords, onChange, style, className,
}: {
  text: string
  keywords?: string[]
  onChange?: (val: string) => void
  style?: React.CSSProperties
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const editRef = useRef<HTMLSpanElement>(null)

  if (!keywords?.length || editing) {
    return (
      <span
        ref={editRef}
        className={className}
        style={{ ...E_STYLE, ...style }}
        contentEditable={!!onChange}
        suppressContentEditableWarning
        onFocus={() => setEditing(true)}
        onBlur={(e) => {
          setEditing(false)
          onChange?.((e.currentTarget.textContent ?? ''))
        }}
      >{text}</span>
    )
  }

  const segments = tokenize(text, keywords)
  return (
    <span
      className={className}
      style={{ ...style, cursor: onChange ? 'text' : undefined }}
      onClick={() => { if (onChange) { setEditing(true); setTimeout(() => editRef.current?.focus(), 0) } }}
    >
      {segments.map(({ segment, level }, i) =>
        level ? (
          <mark key={i} style={{
            background: level === 'exact' ? 'rgba(34,197,94,0.25)' : 'rgba(234,179,8,0.25)',
            color: 'inherit', borderRadius: 2, padding: '0 1px',
          }}>{segment}</mark>
        ) : segment
      )}
    </span>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: string }) {
  return (
    <>
      <div className="resume-section-heading" style={{ fontVariant: 'small-caps' }}>{children}</div>
      <hr className="resume-section-rule" />
    </>
  )
}

// ── Bullet list ───────────────────────────────────────────────────────────────

function BulletList({ items, onChangeBullet, keywords }: {
  items: string[]
  onChangeBullet?: (index: number, value: string) => void
  keywords?: string[]
}) {
  const filtered = items.map((b, i) => ({ b, i })).filter(({ b }) => Boolean(b))
  if (!filtered.length) return null
  return (
    <ul className="resume-bullets">
      {filtered.map(({ b, i }) => (
        <li key={i} style={{ outline: 'none' }}>
          <HL text={b} keywords={keywords} onChange={onChangeBullet ? (val) => onChangeBullet(i, val) : undefined} />
        </li>
      ))}
    </ul>
  )
}

// ── Section renderers ─────────────────────────────────────────────────────────

function RenderedMainInfo({ data, onChange, keywords }: { data: MainInfo; onChange?: (d: Partial<MainInfo>) => void; keywords?: string[] }) {
  const contactFields = [
    { key: 'phone',    value: data.phone    },
    { key: 'email',    value: data.email    },
    { key: 'linkedin', value: data.linkedin },
    { key: 'github',   value: data.github   },
    { key: 'website',  value: data.website  },
    { key: 'location', value: data.location },
  ].filter(({ value }) => Boolean(value))

  return (
    <div style={{ textAlign: 'center', marginBottom: 6 }}>
      {data.fullName && (
        <div className="resume-name" style={{ fontVariant: 'small-caps' }}>
          <HL text={data.fullName} keywords={keywords} onChange={onChange ? (val) => onChange({ fullName: val }) : undefined} />
        </div>
      )}
      {contactFields.length > 0 && (
        <div className="resume-contact">
          {contactFields.map(({ key, value }, i) => (
            <span key={key}>
              {i > 0 && <span className="resume-contact-sep">|</span>}
              <span style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                <HL text={value} keywords={keywords} onChange={onChange ? (val) => onChange({ [key]: val }) : undefined} />
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function RenderedSummary({ data, showHeading, onChange, keywords }: {
  data: Summary; showHeading: boolean; onChange?: (d: Partial<Summary>) => void; keywords?: string[]
}) {
  if (!data.text) return null
  return (
    <div style={{ marginBottom: 4 }}>
      {showHeading && <SectionHeading>{data.label || 'Summary'}</SectionHeading>}
      <div style={{ paddingLeft: 14, fontSize: '10pt' }}>
        <HL text={data.text} keywords={keywords} onChange={onChange ? (val) => onChange({ text: val }) : undefined} />
      </div>
    </div>
  )
}

function RenderedExperience({ data, showHeading, onChange, keywords }: {
  data: Experience; showHeading: boolean; onChange?: (d: Partial<Experience>) => void; keywords?: string[]
}) {
  const dateRange = [data.startDate, data.endDate || 'Present'].filter(Boolean).join(' - ')
  const hasContent = data.company || data.title || data.bullets.some(Boolean)
  if (!hasContent) return null
  return (
    <div>
      {showHeading && <SectionHeading>Experience</SectionHeading>}
      <ul className="resume-sublist">
        <li style={{ marginTop: 2 }}>
          <div className="resume-row">
            <span className="resume-row-bold"><HL text={data.company} keywords={keywords} onChange={onChange ? (val) => onChange({ company: val }) : undefined} /></span>
            <span className="resume-row-right"><HL text={dateRange} onChange={onChange ? (val) => onChange({ endDate: val }) : undefined} /></span>
          </div>
          <div className="resume-row">
            <span className="resume-row-italic"><HL text={data.title} keywords={keywords} onChange={onChange ? (val) => onChange({ title: val }) : undefined} /></span>
            <span className="resume-row-italic"><HL text={data.location} onChange={onChange ? (val) => onChange({ location: val }) : undefined} /></span>
          </div>
          <BulletList items={data.bullets} keywords={keywords} onChangeBullet={onChange ? (i, val) => {
            const updated = data.bullets.map((b, idx) => idx === i ? val : b)
            onChange({ bullets: updated })
          } : undefined} />
        </li>
      </ul>
    </div>
  )
}

function RenderedEducation({ data, showHeading, onChange, keywords }: {
  data: Education; showHeading: boolean; onChange?: (d: Partial<Education>) => void; keywords?: string[]
}) {
  const dateRange = [data.startDate, data.endDate].filter(Boolean).join(' - ')
  const degreeField = [data.degree, data.field].filter(Boolean).join(', ')
  if (!data.institution) return null
  return (
    <div>
      {showHeading && <SectionHeading>Education</SectionHeading>}
      <ul className="resume-sublist">
        <li style={{ marginTop: 2 }}>
          <div className="resume-row">
            <span className="resume-row-bold"><HL text={data.institution} keywords={keywords} onChange={onChange ? (val) => onChange({ institution: val }) : undefined} /></span>
            <span className="resume-row-right"><HL text={data.location} onChange={onChange ? (val) => onChange({ location: val }) : undefined} /></span>
          </div>
          <div className="resume-row">
            <span className="resume-row-italic"><HL text={degreeField} keywords={keywords} onChange={onChange ? (val) => onChange({ degree: val }) : undefined} /></span>
            <span className="resume-row-right">
              <HL text={[dateRange, data.gpa ? `GPA: ${data.gpa}` : ''].filter(Boolean).join('  ·  ')} onChange={onChange ? (val) => onChange({ endDate: val }) : undefined} />
            </span>
          </div>
          {data.notes && (
            <div style={{ fontSize: '9.5pt', fontStyle: 'italic', color: '#333', paddingTop: 1 }}>
              <HL text={data.notes} keywords={keywords} onChange={onChange ? (val) => onChange({ notes: val }) : undefined} />
            </div>
          )}
        </li>
      </ul>
    </div>
  )
}

function RenderedProject({ data, showHeading, onChange, keywords }: {
  data: Project; showHeading: boolean; onChange?: (d: Partial<Project>) => void; keywords?: string[]
}) {
  const dateRange = [data.startDate, data.endDate || 'Present'].filter(Boolean).join(' - ')
  if (!data.name) return null
  return (
    <div>
      {showHeading && <SectionHeading>Projects</SectionHeading>}
      <ul className="resume-sublist">
        <li style={{ marginTop: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'nowrap', gap: 8 }}>
            <span className="resume-row-bold" style={{ minWidth: 0 }}><HL text={data.name} keywords={keywords} onChange={onChange ? (val) => onChange({ name: val }) : undefined} /></span>
            <span className="resume-row-right" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}><HL text={dateRange} onChange={onChange ? (val) => onChange({ endDate: val }) : undefined} /></span>
          </div>
          {data.technologies && (
            <div style={{ fontSize: '9.5pt', fontStyle: 'italic', marginTop: 0 }}>
              <HL text={data.technologies} keywords={keywords} onChange={onChange ? (val) => onChange({ technologies: val }) : undefined} />
            </div>
          )}
          <BulletList items={data.bullets} keywords={keywords} onChangeBullet={onChange ? (i, val) => {
            const updated = data.bullets.map((b, idx) => idx === i ? val : b)
            onChange({ bullets: updated })
          } : undefined} />
        </li>
      </ul>
    </div>
  )
}

function RenderedSkills({ data, showHeading, onChange, keywords }: {
  data: SkillsBucket; showHeading: boolean; onChange?: (d: Partial<SkillsBucket>) => void; keywords?: string[]
}) {
  const hasContent = data.evergreen.length > 0 || data.modular.some((g) => g.skills.length > 0)
  if (!hasContent) return null
  return (
    <div>
      {showHeading && <SectionHeading>Technical Skills</SectionHeading>}
      <ul className="resume-skills-list">
        {data.evergreen.length > 0 && (
          <li>
            <span style={{ fontWeight: 'bold' }}>Core</span>
            {': '}
            <HL text={data.evergreen.join(', ')} keywords={keywords}
              onChange={onChange ? (val) => onChange({ evergreen: val.split(',').map((s) => s.trim()).filter(Boolean) }) : undefined}
            />
          </li>
        )}
        {data.modular.filter((g) => g.skills.length > 0).map((g) => (
          <li key={g.id}>
            <HL text={g.label} style={{ fontWeight: 'bold' }} keywords={keywords}
              onChange={onChange ? (val) => onChange({ modular: data.modular.map((m) => m.id === g.id ? { ...m, label: val } : m) }) : undefined}
            />
            {': '}
            <HL text={g.skills.join(', ')} keywords={keywords}
              onChange={onChange ? (val) => onChange({ modular: data.modular.map((m) => m.id === g.id ? { ...m, skills: val.split(',').map((s) => s.trim()).filter(Boolean) } : m) }) : undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function RenderedCertification({ data, showHeading, onChange, keywords }: {
  data: Certification; showHeading: boolean; onChange?: (d: Partial<Certification>) => void; keywords?: string[]
}) {
  const dateRange = [data.issueDate, data.expiryDate].filter(Boolean).join(' - ')
  if (!data.name) return null
  return (
    <div>
      {showHeading && <SectionHeading>Certifications</SectionHeading>}
      <ul className="resume-sublist">
        <li style={{ marginTop: 2 }}>
          <div className="resume-row">
            <span className="resume-row-bold"><HL text={data.name} keywords={keywords} onChange={onChange ? (val) => onChange({ name: val }) : undefined} /></span>
            <span className="resume-row-right"><HL text={dateRange} onChange={onChange ? (val) => onChange({ expiryDate: val }) : undefined} /></span>
          </div>
          <div className="resume-row">
            <span className="resume-row-italic"><HL text={data.issuer} keywords={keywords} onChange={onChange ? (val) => onChange({ issuer: val }) : undefined} /></span>
            {data.credentialId && <span className="resume-row-italic"><HL text={data.credentialId} onChange={onChange ? (val) => onChange({ credentialId: val }) : undefined} /></span>}
          </div>
        </li>
      </ul>
    </div>
  )
}

function RenderedAward({ data, showHeading, onChange, keywords }: {
  data: Award; showHeading: boolean; onChange?: (d: Partial<Award>) => void; keywords?: string[]
}) {
  if (!data.title) return null
  return (
    <div>
      {showHeading && <SectionHeading>Awards &amp; Honors</SectionHeading>}
      <ul className="resume-sublist">
        <li style={{ marginTop: 2 }}>
          <div className="resume-row">
            <span className="resume-row-bold"><HL text={data.title} keywords={keywords} onChange={onChange ? (val) => onChange({ title: val }) : undefined} /></span>
            <span className="resume-row-right"><HL text={data.date ?? ''} onChange={onChange ? (val) => onChange({ date: val }) : undefined} /></span>
          </div>
          {data.issuer && (
            <div className="resume-row">
              <span className="resume-row-italic"><HL text={data.issuer} keywords={keywords} onChange={onChange ? (val) => onChange({ issuer: val }) : undefined} /></span>
            </div>
          )}
          {data.description && (
            <div style={{ fontSize: '9.5pt', paddingTop: 1 }}>
              <HL text={data.description} keywords={keywords} onChange={onChange ? (val) => onChange({ description: val }) : undefined} />
            </div>
          )}
        </li>
      </ul>
    </div>
  )
}

// ── Main renderer ─────────────────────────────────────────────────────────────

const PAGE_HEIGHT_PX = 1056

export interface CVRendererHandle {
  getPaperElement: () => HTMLDivElement | null
}

const LINE_HEIGHT_PX = 20

const CVRenderer = forwardRef<CVRendererHandle, Props>(function CVRenderer({ content, sectionOrder, onChange, keywords, onOverflowChange }, ref) {
  const firstOfType = new Map<SectionType, string>()
  sectionOrder.forEach((id) => {
    const type = getSectionType(id)
    if (!firstOfType.has(type)) firstOfType.set(type, id)
  })

  function isFirst(id: string): boolean {
    return firstOfType.get(getSectionType(id)) === id
  }

  const paperRef = useRef<HTMLDivElement>(null)
  const [paperHeight, setPaperHeight] = useState(PAGE_HEIGHT_PX)

  useImperativeHandle(ref, () => ({
    getPaperElement: () => paperRef.current,
  }))

  useEffect(() => {
    if (!paperRef.current) return
    const obs = new ResizeObserver(() => {
      if (!paperRef.current) return
      const h = paperRef.current.offsetHeight
      setPaperHeight(h)
      const overflowPx = Math.max(0, h - PAGE_HEIGHT_PX - 1)
      onOverflowChange?.(Math.ceil(overflowPx / LINE_HEIGHT_PX))
    })
    obs.observe(paperRef.current)
    return () => obs.disconnect()
  }, [onOverflowChange])

  const pageBreaks: number[] = []
  for (let y = PAGE_HEIGHT_PX; y < paperHeight; y += PAGE_HEIGHT_PX) {
    pageBreaks.push(y)
  }

  return (
    <div style={{
      background: '#1a1a1a',
      minHeight: '100%',
      padding: '32px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      overflowY: 'auto',
    }}>
      <style>{RESUME_STYLES}</style>
      <div style={{ position: 'relative' }}>
        <div className="cv-paper" ref={paperRef}>
          {sectionOrder.map((id) => {
            const type = getSectionType(id)
            const showHeading = isFirst(id)

            if (type === 'main') {
              return <RenderedMainInfo key={id} data={content.mainInfo} keywords={keywords}
                onChange={onChange ? (d) => onChange({ type: 'mainInfo', data: d }) : undefined}
              />
            }
            if (type === 'summary') {
              const data = content.summaries.find((s) => s.id === id)
              return data ? <RenderedSummary key={id} data={data} showHeading={showHeading} keywords={keywords}
                onChange={onChange ? (d) => onChange({ type: 'summary', id, data: d }) : undefined}
              /> : null
            }
            if (type === 'experience') {
              const data = content.experiences.find((e) => e.id === id)
              return data ? <RenderedExperience key={id} data={data} showHeading={showHeading} keywords={keywords}
                onChange={onChange ? (d) => onChange({ type: 'experience', id, data: d }) : undefined}
              /> : null
            }
            if (type === 'education') {
              const data = content.educations.find((e) => e.id === id)
              return data ? <RenderedEducation key={id} data={data} showHeading={showHeading} keywords={keywords}
                onChange={onChange ? (d) => onChange({ type: 'education', id, data: d }) : undefined}
              /> : null
            }
            if (type === 'project') {
              const data = content.projects.find((p) => p.id === id)
              return data ? <RenderedProject key={id} data={data} showHeading={showHeading} keywords={keywords}
                onChange={onChange ? (d) => onChange({ type: 'project', id, data: d }) : undefined}
              /> : null
            }
            if (type === 'skills') {
              return content.skills
                ? <RenderedSkills key={id} data={content.skills} showHeading={showHeading} keywords={keywords}
                    onChange={onChange ? (d) => onChange({ type: 'skills', data: d }) : undefined}
                  />
                : null
            }
            if (type === 'certification') {
              const data = content.certifications.find((c) => c.id === id)
              return data ? <RenderedCertification key={id} data={data} showHeading={showHeading} keywords={keywords}
                onChange={onChange ? (d) => onChange({ type: 'certification', id, data: d }) : undefined}
              /> : null
            }
            if (type === 'award') {
              const data = content.awards.find((a) => a.id === id)
              return data ? <RenderedAward key={id} data={data} showHeading={showHeading} keywords={keywords}
                onChange={onChange ? (d) => onChange({ type: 'award', id, data: d }) : undefined}
              /> : null
            }
            return null
          })}
        </div>

        {pageBreaks.map((y) => (
          <div key={y} style={{ position: 'absolute', top: y, left: 0, right: 0, pointerEvents: 'none', zIndex: 10 }}>
            <div style={{ borderTop: '2.5px dashed rgba(255,60,60,0.9)', position: 'relative', boxShadow: '0 0 6px rgba(255,60,60,0.4)' }}>
              <span style={{
                position: 'absolute', right: 6, top: -10,
                fontFamily: 'monospace', fontSize: 9, color: 'rgba(220,40,40,0.95)',
                letterSpacing: '0.08em', userSelect: 'none',
                background: 'rgba(255,255,255,0.95)', padding: '0 4px',
              }}>
                PAGE {Math.round(y / PAGE_HEIGHT_PX) + 1}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

export default CVRenderer
