import { useRef, useState } from 'react'
import { P, CV_FONT, labelStyle, inputStyle, addBtnStyle, addBtnHoverStyle, removeBtnStyle, removeBtnHoverStyle } from '@/lib/CVCardTheme'
import CVCard from './CVCard'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SkillGroup {
  id: string
  label: string
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
  const [removeHovers, setRemoveHovers] = useState<Record<number, boolean>>({})
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
      className="flex flex-wrap gap-1.5 items-center px-1 py-1"
      style={{ borderBottom: `1px solid ${P.border}`, cursor: 'text' }}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span
          key={`${inputId}-${i}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: '#f3f4f6',
            border: `1px solid ${P.border}`,
            borderRadius: 3,
            padding: '1px 6px',
            fontFamily: CV_FONT.family,
            fontSize: CV_FONT.label,
            color: P.text,
            letterSpacing: '0.04em',
          }}
        >
          {tag}
          <button
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); removeTag(i) }}
            style={removeHovers[i] ? { ...removeBtnStyle, ...removeBtnHoverStyle, padding: 0 } : { ...removeBtnStyle, padding: 0 }}
            onMouseEnter={() => setRemoveHovers(p => ({ ...p, [i]: true }))}
            onMouseLeave={() => setRemoveHovers(p => ({ ...p, [i]: false }))}
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
        style={{ ...inputStyle, minWidth: 100, flex: 1, padding: '1px 0' }}
      />
    </div>
  )
}

// ── Sub-label inside a card section ───────────────────────────────────────────

function SubLabel({ children }: { children: string }) {
  return (
    <div style={{ ...labelStyle, marginBottom: 4 }}>{children}</div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

let _groupSeq = 0
function nextGroupId() { return `sg-${++_groupSeq}` }

export default function SkillsBucketCard({ data, collapsed, onChange, onToggleCollapse, onDelete }: Props) {
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [groupDraft, setGroupDraft] = useState('')
  const [addGroupHover, setAddGroupHover] = useState(false)
  const [renameHovers, setRenameHovers] = useState<Record<string, boolean>>({})
  const [removeGroupHovers, setRemoveGroupHovers] = useState<Record<string, boolean>>({})

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
    setModular([...data.modular, { id, label: 'New Group', skills: [] }])
    setEditingGroupId(id)
    setGroupDraft('New Group')
  }

  function removeGroup(id: string) {
    setModular(data.modular.filter((g) => g.id !== id))
  }

  function startRename(group: SkillGroup) {
    setEditingGroupId(group.id)
    setGroupDraft(group.label)
  }

  function commitRename(id: string) {
    const trimmed = groupDraft.trim()
    if (trimmed) updateGroup(id, { label: trimmed })
    setEditingGroupId(null)
  }

  const evergreenCount = data.evergreen.length
  const modularCount   = data.modular.reduce((sum, g) => sum + g.skills.length, 0)
  const summary = [
    evergreenCount ? `${evergreenCount} evergreen` : null,
    modularCount   ? `${modularCount} modular`     : null,
  ].filter(Boolean).join('  ·  ') || undefined

  const actionBtnBase = { ...addBtnStyle, marginTop: 0 }

  return (
    <CVCard
      title="SKILLS"
      accentColor="#06b6d4"
      summary={summary}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      onDelete={onDelete}
    >
      {/* ── Core / Evergreen ─────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <SubLabel>Core</SubLabel>
          <span style={{ fontSize: CV_FONT.label, fontFamily: CV_FONT.family, color: P.textMuted }}>
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
              <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                {editingGroupId === group.id ? (
                  <input
                    autoFocus
                    value={groupDraft}
                    onChange={(e) => setGroupDraft(e.target.value)}
                    onBlur={() => commitRename(group.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(group.id)
                      if (e.key === 'Escape') setEditingGroupId(null)
                    }}
                    style={{
                      ...inputStyle,
                      borderBottom: `1px solid ${P.textMuted}`,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      fontSize: CV_FONT.label,
                      width: 160,
                    }}
                  />
                ) : (
                  <span style={{ ...labelStyle, marginBottom: 0, cursor: 'default' }}>
                    {group.label}
                  </span>
                )}

                <button
                  onClick={() => startRename(group)}
                  style={renameHovers[group.id] ? { ...actionBtnBase, ...addBtnHoverStyle } : actionBtnBase}
                  onMouseEnter={() => setRenameHovers(p => ({ ...p, [group.id]: true }))}
                  onMouseLeave={() => setRenameHovers(p => ({ ...p, [group.id]: false }))}
                  title="Rename group"
                >
                  rename
                </button>
                <button
                  onClick={() => removeGroup(group.id)}
                  style={removeGroupHovers[group.id] ? { ...actionBtnBase, ...removeBtnHoverStyle } : actionBtnBase}
                  onMouseEnter={() => setRemoveGroupHovers(p => ({ ...p, [group.id]: true }))}
                  onMouseLeave={() => setRemoveGroupHovers(p => ({ ...p, [group.id]: false }))}
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
      <div className="flex justify-end">
        <button
          onClick={addGroup}
          style={addGroupHover ? { ...addBtnStyle, ...addBtnHoverStyle, marginTop: 6 } : { ...addBtnStyle, marginTop: 6 }}
          onMouseEnter={() => setAddGroupHover(true)}
          onMouseLeave={() => setAddGroupHover(false)}
        >
          Add Group
        </button>
      </div>
    </CVCard>
  )
}
