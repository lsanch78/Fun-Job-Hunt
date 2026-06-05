import { useRef, useState } from 'react'
import { T, labelClass, CRT_FONT } from '@/lib/crtTheme'
import CVCard from './CVCard'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SkillGroup {
  id: string
  label: string      // user-named; "EVERGREEN" is fixed and never removed
  skills: string[]
}

export interface SkillsBucket {
  evergreen: string[]
  modular: SkillGroup[]
}

interface Props {
  data: SkillsBucket
  collapsed: boolean
  onChange: (data: SkillsBucket) => void
  onToggleCollapse: () => void
  onDelete?: () => void
}

// ── Tag chip input ─────────────────────────────────────────────────────────────

interface TagInputProps {
  tags: string[]
  inputId: string
  placeholder?: string
  onChange: (tags: string[]) => void
}

function TagInput({ tags, inputId, placeholder = 'Add skill…', onChange }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function commit() {
    const trimmed = draft.trim().replace(/,$/, '')
    if (!trimmed) return
    if (!tags.includes(trimmed)) onChange([...tags, trimmed])
    setDraft('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    }
    if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  function removeTag(i: number) {
    onChange(tags.filter((_, idx) => idx !== i))
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 items-center px-1 py-1 border-b"
      style={{ borderColor: T.border, cursor: 'text' }}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span
          key={`${inputId}-${i}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(57,255,20,0.07)',
            border: `1px solid ${T.greenDim}`,
            borderRadius: 3,
            padding: '1px 6px',
            fontFamily: 'monospace',
            fontSize: CRT_FONT.chrome,
            color: T.green,
            letterSpacing: '0.05em',
          }}
        >
          {tag}
          <button
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); removeTag(i) }}
            style={{ color: T.greenDim, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.warn }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.greenDim }}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={inputId}
        value={draft}
        placeholder={tags.length === 0 ? placeholder : ''}
        onChange={(e) => {
          const val = e.target.value
          if (val.endsWith(',')) {
            setDraft(val.slice(0, -1))
            setTimeout(commit, 0)
          } else {
            setDraft(val)
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        style={{
          background: 'transparent',
          outline: 'none',
          border: 'none',
          color: T.green,
          caretColor: T.green,
          fontFamily: 'monospace',
          fontSize: CRT_FONT.body,
          minWidth: 100,
          flex: 1,
        }}
      />
    </div>
  )
}

// ── Section divider label ──────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      className={labelClass}
      style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, marginBottom: 4 }}
    >
      {children}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

let _groupSeq = 0
function nextGroupId() { return `sg-${++_groupSeq}` }

export default function SkillsBucketCard({ data, collapsed, onChange, onToggleCollapse, onDelete }: Props) {
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [groupDraft, setGroupDraft] = useState('')

  function setEvergreen(skills: string[]) {
    onChange({ ...data, evergreen: skills })
  }

  function setModular(modular: SkillGroup[]) {
    onChange({ ...data, modular })
  }

  function updateGroup(id: string, patch: Partial<SkillGroup>) {
    setModular(data.modular.map((g) => g.id === id ? { ...g, ...patch } : g))
  }

  function addGroup() {
    const id = nextGroupId()
    setModular([...data.modular, { id, label: 'NEW GROUP', skills: [] }])
    setEditingGroupId(id)
    setGroupDraft('NEW GROUP')
  }

  function removeGroup(id: string) {
    setModular(data.modular.filter((g) => g.id !== id))
  }

  function startRename(group: SkillGroup) {
    setEditingGroupId(group.id)
    setGroupDraft(group.label)
  }

  function commitRename(id: string) {
    const trimmed = groupDraft.trim().toUpperCase()
    if (trimmed) updateGroup(id, { label: trimmed })
    setEditingGroupId(null)
  }

  const evergreenCount = data.evergreen.length
  const modularCount   = data.modular.reduce((sum, g) => sum + g.skills.length, 0)
  const summary = [
    evergreenCount  ? `${evergreenCount} evergreen`  : null,
    modularCount    ? `${modularCount} modular`       : null,
  ].filter(Boolean).join('  ·  ') || undefined

  return (
    <CVCard
      title="SKILLS"
      summary={summary}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      onDelete={onDelete}
      glowColor="#38bdf8"
    >
      {/* ── Evergreen ────────────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <SectionLabel>Evergreen Skills</SectionLabel>
          <span style={{ color: T.border, fontSize: CRT_FONT.chrome, fontFamily: 'monospace' }}>
            — works on any application
          </span>
        </div>
        <TagInput
          tags={data.evergreen}
          inputId="evergreen-tags"
          placeholder="Python, SQL, Git, REST APIs…"
          onChange={setEvergreen}
        />
      </div>

      {/* ── Modular groups ───────────────────────────────────────────────────── */}
      {data.modular.length > 0 && (
        <div className="flex flex-col gap-3" style={{ marginTop: 4 }}>
          {data.modular.map((group) => (
            <div key={group.id}>
              {/* Group header row */}
              <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                {editingGroupId === group.id ? (
                  <input
                    autoFocus
                    value={groupDraft}
                    onChange={(e) => setGroupDraft(e.target.value.toUpperCase())}
                    onBlur={() => commitRename(group.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(group.id)
                      if (e.key === 'Escape') setEditingGroupId(null)
                    }}
                    style={{
                      background: 'transparent',
                      outline: 'none',
                      border: 'none',
                      borderBottom: `1px solid ${T.green}`,
                      color: T.green,
                      caretColor: T.green,
                      fontFamily: 'monospace',
                      fontSize: CRT_FONT.chrome,
                      letterSpacing: '0.15em',
                      width: 160,
                    }}
                  />
                ) : (
                  <span
                    className={labelClass}
                    style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, marginBottom: 0, cursor: 'default' }}
                  >
                    {group.label}
                  </span>
                )}

                <button
                  onClick={() => startRename(group)}
                  style={{ color: T.border, fontSize: CRT_FONT.chrome, fontFamily: 'monospace', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.greenDim }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.border }}
                  title="Rename group"
                >
                  rename
                </button>
                <button
                  onClick={() => removeGroup(group.id)}
                  style={{ color: T.border, fontSize: CRT_FONT.chrome, fontFamily: 'monospace', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.warn }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.border }}
                  title="Remove group"
                >
                  remove
                </button>
              </div>

              <TagInput
                tags={group.skills}
                inputId={`group-${group.id}`}
                placeholder="Add skill…"
                onChange={(skills) => updateGroup(group.id, { skills })}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Add group button ─────────────────────────────────────────────────── */}
      <button
        onClick={addGroup}
        style={{
          marginTop: 6,
          fontFamily: 'monospace',
          fontSize: CRT_FONT.chrome,
          letterSpacing: '0.12em',
          color: T.greenDim,
          background: 'none',
          border: `1px solid ${T.border}`,
          padding: '3px 10px',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.green; (e.currentTarget as HTMLElement).style.borderColor = T.green }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.greenDim; (e.currentTarget as HTMLElement).style.borderColor = T.border }}
      >
        + ADD MODULAR GROUP
      </button>
    </CVCard>
  )
}
