import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { playBootBlip, playExitBlip } from '@/lib/sfx'
import { lsGet, lsSet, lsRemove } from '@/lib/storage'
import { SK, type AiMode } from '@/lib/storageKeys'
import { fetchModels, streamCompletion, getAiProvider, fetchUsage, type AiProvider } from '@/services/aiService'
import { createCheckoutSession } from '@/services/subscriptionService'
import { useSubscription } from '@/lib/SubscriptionContext'
import { getResumeText } from '@/services/resumeTextService'
import { fetchAiSettings, upsertAiSettings, DEFAULT_PROMPTS, AI_PROMPT_LIMIT, type AiSettings } from '@/services/aiSettingsService'
import { COACHING_COVER_LETTER, COACHING_WHY_GOOD_FIT, COACHING_CUSTOM } from '@/config/aiPrompts'
import { getResumeSignedUrl, type ResumeSlot, type ResumeSlotRecord } from '@/services/resumeService'
import { T, ensureCrtStyles, crtTextShadow, crtBoxShadow, CRT_FONT } from '@/lib/crtTheme'
import { downloadDocx } from '@/lib/docxExport'
import { loadAiHistory, saveAiHistoryEntry, deleteAiHistoryEntry, updateAiHistoryEntry, formatHistoryLabel, type AiHistoryEntry } from '@/lib/aiHistory'

ensureCrtStyles()


// ── Slot accent colors (mirrors QuickCast) ────────────────────────────────────
const SLOT_COLORS: Record<ResumeSlot, string> = {
  a: 'var(--color-secondary)',
  b: '#22c55e',
  c: '#f59e0b',
}

const RESUME_SLOTS: ResumeSlot[] = ['a', 'b', 'c']


// ── Sounds ────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────
type PanelView = 'form' | 'output' | 'history'
type QuickKey     = 'cover_letter' | 'why_good_fit' | 'custom'

interface AiModalProps {
  userId: string
  resumeSlots: Partial<Record<ResumeSlot, ResumeSlotRecord>>
  onClose: () => void
  initialOutput?: string
  initialView?: PanelView
}

// ── Shared style helpers ──────────────────────────────────────────────────────
const termInput: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: `1px solid ${T.border}`,
  color: T.green,
  caretColor: T.green,
  outline: 'none',
  fontFamily: '"VT323", monospace',
  fontSize: CRT_FONT.body,
  width: '100%',
  padding: '2px 4px',
  resize: 'none' as const,
  lineHeight: '1.5',
}

const termTextarea: React.CSSProperties = { ...termInput }

const termSelect: React.CSSProperties = {
  ...termInput,
  cursor: 'pointer',
  appearance: 'none' as const,
}

function termBtn(active: boolean, color?: string): React.CSSProperties {
  const c = color ?? (active ? T.green : T.greenDim)
  return {
    fontFamily: '"VT323", monospace',
    fontSize: CRT_FONT.btn,
    color: active ? T.bg : c,
    background: active ? c : 'transparent',
    border: `1px solid ${active ? c : T.border}`,
    padding: '1px 8px',
    cursor: 'pointer',
    letterSpacing: '0.05em',
  }
}

const labelStyle: React.CSSProperties = {
  color: T.greenDim,
  fontFamily: '"VT323", monospace',
  fontSize: CRT_FONT.label,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: '2px',
  userSelect: 'none',
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadSlotPref(userId: string, occupied: ResumeSlot[]): ResumeSlot[] {
  const saved = lsGet<ResumeSlot[] | null>(SK.aiModalSlots(userId), null)
  if (!saved) return occupied
  const valid = saved.filter((s) => occupied.includes(s))
  return valid.length > 0 ? valid : occupied
}

function saveSlotPref(userId: string, slots: ResumeSlot[]) {
  lsSet(SK.aiModalSlots(userId), slots)
}

function loadResumeText(userId: string): string {
  return lsGet<string>(SK.aiModalText(userId), '')
}

function saveResumeText(userId: string, text: string) {
  if (text.trim()) lsSet(SK.aiModalText(userId), text)
  else lsRemove(SK.aiModalText(userId))
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AiModal({ userId, resumeSlots, onClose, initialOutput, initialView }: AiModalProps) {
  const { isSubscribed } = useSubscription()
  const occupiedSlots = RESUME_SLOTS.filter((s) => resumeSlots[s])

  const { connected, models } = fetchModels()
  const [selectedModel,     setSelectedModel]    = useState<string>(() => models[0] ?? '')
  const [selectedSlots,     setSelectedSlots]    = useState<ResumeSlot[]>(() => loadSlotPref(userId, occupiedSlots))
  const [textInputActive,   setTextInputActive]  = useState(false)
  const [resumeTextInput,   setResumeTextInput]  = useState(() => loadResumeText(userId))
  const [jdText,            setJdText]           = useState('')
  const [promptText,        setPromptText]       = useState('')
  const [editingQuick,      setEditingQuick]     = useState<QuickKey | null>(null)
  const [draftPrompt,       setDraftPrompt]      = useState('')
  const [view,              setView]             = useState<PanelView>(initialView ?? (initialOutput ? 'output' : 'form'))
  const [output,            setOutput]           = useState(initialOutput ?? '')
  const [isStreaming,       setIsStreaming]       = useState(false)
  const [copied,            setCopied]           = useState(false)
  const [history,           setHistory]          = useState<AiHistoryEntry[]>(() => loadAiHistory(userId))
  const [activeHistoryId,   setActiveHistoryId]  = useState<string | null>(null)
  const [aiSettings,        setAiSettings]       = useState<AiSettings | null>(null)
  const [showInfo,          setShowInfo]         = useState(false)
  const [provider,          setProvider]         = useState<AiProvider>(() => getAiProvider())
  const [usage,             setUsage]            = useState<{ count: number; limit: number } | null>(null)
  const [limitHit,          setLimitHit]         = useState(false)
  const [ctxMenu,           setCtxMenu]          = useState<{ key: QuickKey; x: number; y: number } | null>(null)
  const [jdToast,           setJdToast]          = useState(false)
  const [lastQuickKey,      setLastQuickKey]     = useState<QuickKey | null>(null)

  const [humanFirst, setHumanFirst] = useState<boolean>(() =>
    lsGet<AiMode>(SK.aiMode(userId), 'ai-first') === 'human-first'
  )

  const abortRef  = useRef<AbortController | null>(null)
  const outputPreRef      = useRef<HTMLPreElement>(null)
  const outputTextareaRef = useRef<HTMLTextAreaElement>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    playBootBlip()

    const p = getAiProvider()
    setProvider(p)
    if (p === 'proxy') fetchUsage().then(setUsage)

    fetchAiSettings(userId).then(setAiSettings)

    RESUME_SLOTS.forEach(async (slot) => {
      if (!resumeSlots[slot]) return
      const signedUrl = await getResumeSignedUrl(userId, slot)
      if (signedUrl) getResumeText(userId, slot, signedUrl)
    })

    return () => { abortRef.current?.abort() }
  }, [userId, resumeSlots])

  // Escape key handling
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (showInfo) { setShowInfo(false); return }
      if (editingQuick) { setEditingQuick(null); return }
      if (view === 'output') { handleBack(); return }
      handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showInfo, editingQuick, view])

  // Dismiss context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return
    function onDown(e: MouseEvent) {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ctxMenu])

  // Auto-scroll output as it streams
  useEffect(() => {
    const el = outputPreRef.current ?? outputTextareaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [output])

  // Auto-size textarea to fit content whenever output changes or streaming ends
  useEffect(() => {
    const ta = outputTextareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const maxPx = window.innerHeight * 0.52
    ta.style.height = Math.min(ta.scrollHeight, maxPx) + 'px'
  }, [output, isStreaming, view])

  // Debounced save of edits back to the active history entry
  useEffect(() => {
    if (!activeHistoryId || isStreaming) return
    const t = setTimeout(() => {
      updateAiHistoryEntry(userId, activeHistoryId, output)
      setHistory(loadAiHistory(userId))
    }, 600)
    return () => clearTimeout(t)
  }, [output, activeHistoryId, isStreaming])

  // ── Helpers ────────────────────────────────────────────────────────────────
  function toggleSlot(slot: ResumeSlot) {
    setSelectedSlots((prev) => {
      const next = prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
      saveSlotPref(userId, next)
      return next
    })
  }

  function resolveSystemPrompt(): string {
    return promptText.trim()
  }

  function quickPromptText(key: QuickKey): string {
    if (humanFirst) {
      if (key === 'cover_letter') return COACHING_COVER_LETTER
      if (key === 'why_good_fit') return COACHING_WHY_GOOD_FIT
      return COACHING_CUSTOM
    }
    if (key === 'cover_letter') return aiSettings?.cover_letter_prompt || DEFAULT_PROMPTS.cover_letter
    if (key === 'why_good_fit') return aiSettings?.why_good_fit_prompt || DEFAULT_PROMPTS.why_good_fit
    return aiSettings?.custom_prompt || DEFAULT_PROMPTS.custom
  }

  function applyQuickPrompt(key: QuickKey) {
    setPromptText(quickPromptText(key))
    setLastQuickKey(key)
  }


  function saveGear() {
    if (!editingQuick) return
    const base: AiSettings = {
      user_id:            userId,
      cover_letter_prompt: aiSettings?.cover_letter_prompt || DEFAULT_PROMPTS.cover_letter,
      why_good_fit_prompt: aiSettings?.why_good_fit_prompt || DEFAULT_PROMPTS.why_good_fit,
      custom_prompt:       aiSettings?.custom_prompt       || DEFAULT_PROMPTS.custom,
    }
    const updated: AiSettings = {
      ...base,
      ...(editingQuick === 'cover_letter' && { cover_letter_prompt: draftPrompt }),
      ...(editingQuick === 'why_good_fit'  && { why_good_fit_prompt: draftPrompt }),
      ...(editingQuick === 'custom'        && { custom_prompt: draftPrompt }),
    }
    setAiSettings(updated)
    upsertAiSettings(updated)
    setEditingQuick(null)
  }

  async function assembleInputs(): Promise<{ resumeSystem: string; prompt: string }> {
    const slots = [...selectedSlots]

    // resumeSystem goes to the system prompt for caching.
    // All resume text is also repeated in the user message so the model is
    // grounded against the actual content at generation time.
    let resumeSystem = ''
    const resumeParts: string[] = []

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const signedUrl = await getResumeSignedUrl(userId, slot)
      const text = signedUrl ? await getResumeText(userId, slot, signedUrl) : ''
      if (!text) continue
      if (i === 0 && !textInputActive) {
        resumeSystem = `RESUME ${slot.toUpperCase()}:\n${text}`
      }
      resumeParts.push(`--- RESUME ${slot.toUpperCase()} ---\n${text}`)
    }

    if (textInputActive && resumeTextInput.trim()) {
      if (!resumeSystem) resumeSystem = `RESUME (PASTED):\n${resumeTextInput.trim()}`
      resumeParts.push(`--- RESUME (PASTED) ---\n${resumeTextInput.trim()}`)
    }

    let prompt = ''
    if (resumeParts.length > 0) {
      prompt += resumeParts.join('\n\n') + '\n\n'
    }
    prompt += 'GROUNDING CHECK: Every skill, project, employer, and institution you mention must appear verbatim in the resume text above. If it is not there, do not say it.\n'
    prompt += 'FORMAT: Plain text only. No markdown — no **, no __, no #, no -, no *, no backticks. Use plain punctuation and line breaks only.\n\n'
    if (jdText.trim()) prompt += `JOB DESCRIPTION:\n${jdText.trim()}`

    return { resumeSystem, prompt }
  }

  async function handleGenerate() {
    const system = resolveSystemPrompt()
    const { resumeSystem, prompt } = await assembleInputs()
    setView('output')
    setOutput('')
    setActiveHistoryId(null)
    setLimitHit(false)
    setIsStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller
    let accumulated = ''
    streamCompletion({
      model: selectedModel,
      system,
      resumeSystem: resumeSystem || undefined,
      prompt,
      signal: controller.signal,
      onToken: (token) => {
        accumulated += token
        setOutput((prev) => prev + token)
      },
      onDone: () => {
        setIsStreaming(false)
        if (getAiProvider() === 'proxy') fetchUsage().then(setUsage)
        if (accumulated.trim()) {
          saveAiHistoryEntry(userId, {
            promptType: lastQuickKey,
            output: accumulated,
            jdSnippet: jdText.slice(0, 120),
          })
          setHistory(loadAiHistory(userId))
        }
      },
      onError: (msg) => {
        const isLimit = msg.includes('Monthly limit') || msg.includes('limit reached')
        setLimitHit(isLimit)
        setOutput((prev) => prev + `\n\n> ERROR: ${msg}`)
        setIsStreaming(false)
      },
    })
  }

  function handleCopy() {
    navigator.clipboard.writeText(output).catch(() => {
      try {
        const ta = document.createElement('textarea')
        ta.value = output
        ta.style.cssText = 'position:fixed;opacity:0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      } catch { /* ignore */ }
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 800)
  }

  function buildDocxFilename(): string {
    const suffix = lastQuickKey === 'cover_letter' ? 'cover_letter'
      : lastQuickKey === 'why_good_fit' ? 'why_good_fit'
      : 'output'
    const company = jdText.trim().split('\n')[0].trim().replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40) || 'Company'
    return `${company}_${suffix}.docx`
  }

  function handleDownload() {
    try {
      downloadDocx(output, buildDocxFilename())
    } catch (err) {
      console.error('[docx]', err)
      alert('DOCX error: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  function handleBack() {
    abortRef.current?.abort()
    setIsStreaming(false)
    setView('form')
  }

  function handleClose() {
    playExitBlip()
    onClose()
  }


  // ── Derived ────────────────────────────────────────────────────────────────
  const canGenerate =
    connected &&
    selectedModel !== '' &&
    promptText.trim().length > 0
  const displayOutput = isStreaming ? output + '▌' : output

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="crt-card flex flex-col w-[620px]"
      style={{
        animation: 'console-boot 0.3s ease-out forwards, crt-flicker 8s steps(1,end) 0.3s infinite',
        fontFamily: '"VT323", monospace',
        background: T.bg,
        border: `1px solid ${T.border}`,
        color: T.green,
        borderRadius: '8px',
        textShadow: crtTextShadow,
        boxShadow: crtBoxShadow,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <span style={{ color: T.green, fontSize: CRT_FONT.sub, letterSpacing: '0.08em' }}>
          // AI RESUME ASSISTANT
        </span>
        <div className="flex items-center gap-3">
          {connected ? (
            <span style={{ color: T.greenDim, fontSize: CRT_FONT.label }}>
              <span style={{ color: T.green }}>●</span> CONNECTED
            </span>
          ) : (
            <span style={{ color: T.greenDim, fontSize: CRT_FONT.label }}>
              <span style={{ color: T.warn }}>○</span> NO API KEY
            </span>
          )}
          <button
            onClick={() => setShowInfo(true)}
            style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, lineHeight: 1, background: 'none', border: `1px solid ${T.border}`, cursor: 'pointer', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"VT323", monospace' }}
          >
            ?
          </button>
          <button
            onClick={handleClose}
            style={{ color: T.greenDim, fontSize: CRT_FONT.btn, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── FORM VIEW ───────────────────────────────────────────────────────── */}
      {view === 'form' && (
        <div className="flex flex-col gap-4 px-4 py-3 overflow-y-auto" style={{ maxHeight: '70vh' }}>

          {/* Provider */}
          {/* Model */}
          <div>
            <div style={labelStyle}>Model</div>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={!connected || models.length === 0}
              style={{
                ...termSelect,
                opacity: !connected ? 0.35 : 1,
                cursor: !connected ? 'not-allowed' : 'pointer',
              }}
            >
              {models.length === 0
                ? <option value="">-- no models --</option>
                : models.map((m) => (
                    <option key={m} value={m} style={{ background: T.bg, color: T.green }}>{m}</option>
                  ))
              }
            </select>
          </div>

          {/* Resume toggles */}
          <div>
            <div style={labelStyle}>Reference Resumes</div>
            {occupiedSlots.length === 0 ? (
              <div style={{ color: T.warn, fontSize: CRT_FONT.label, lineHeight: '1.6' }}>
                <p>&gt; No resumes uploaded yet.</p>
                <p>&gt; Look below at the <span style={{ color: T.green }}>Quick Cast</span> and upload</p>
                <p>&gt; up to 3 resumes (A, B, C) so AI can reference your resume.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {occupiedSlots.map((slot) => {
                  const active = selectedSlots.includes(slot)
                  return (
                    <button
                      key={slot}
                      onClick={() => toggleSlot(slot)}
                      style={{
                        fontFamily: '"VT323", monospace',
                        fontSize: CRT_FONT.btn,
                        color: active ? T.bg : SLOT_COLORS[slot],
                        background: active ? SLOT_COLORS[slot] : 'transparent',
                        border: `1px solid ${active ? SLOT_COLORS[slot] : T.border}`,
                        padding: '1px 8px',
                        cursor: 'pointer',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {slot.toUpperCase()}: {resumeSlots[slot]!.name.slice(0, 8)}
                    </button>
                  )
                })}
                <button onClick={() => setTextInputActive((p) => !p)} style={termBtn(textInputActive)}>
                  {textInputActive ? '✕ TEXT' : '+ TEXT'}
                </button>
              </div>
            )}
            {textInputActive && (
              <>
                <textarea
                  rows={5}
                  value={resumeTextInput}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 8000)
                    setResumeTextInput(val)
                    saveResumeText(userId, val)
                  }}
                  placeholder="Paste or type your resume info here..."
                  style={{ ...termTextarea, marginTop: '6px', display: 'block' }}
                />
                <div style={{ color: resumeTextInput.length >= 8000 ? T.warn : T.greenDim, fontSize: CRT_FONT.btn, fontFamily: '"VT323", monospace', textAlign: 'right', marginTop: '2px' }}>
                  {resumeTextInput.length} / 8000
                </div>
              </>
            )}
          </div>

          {/* Prompt */}
          <div>
            <div style={labelStyle}>Prompt</div>

            {/* Quick prompts row */}
            <div className="flex items-center gap-1 flex-wrap mb-2">
              <span style={{ ...labelStyle, marginBottom: 0 }}>QUICK:</span>

              {/* Cover Letter */}
              <button
                onClick={() => applyQuickPrompt('cover_letter')}
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ key: 'cover_letter', x: e.clientX, y: e.clientY }) }}
                style={{ ...termBtn(false), fontSize: CRT_FONT.label }}
              >
                COVER LETTER
              </button>

              {/* Why This Job? */}
              <button
                onClick={() => applyQuickPrompt('why_good_fit')}
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ key: 'why_good_fit', x: e.clientX, y: e.clientY }) }}
                style={{ ...termBtn(false), fontSize: CRT_FONT.label }}
              >
                WHY I WANT THIS JOB
              </button>

              {/* Custom */}
              <button
                onClick={() => applyQuickPrompt('custom')}
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ key: 'custom', x: e.clientX, y: e.clientY }) }}
                style={{ ...termBtn(false), fontSize: CRT_FONT.label }}
              >
                CUSTOM
              </button>
            </div>

            {/* Human-First per-session toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <button
                onClick={() => setHumanFirst((v) => !v)}
                style={{
                  fontFamily: '"VT323", monospace',
                  fontSize: CRT_FONT.label,
                  color: humanFirst ? T.bg : T.greenDim,
                  background: humanFirst ? T.greenDim : 'transparent',
                  border: `1px solid ${humanFirst ? T.greenDim : T.border}`,
                  padding: '1px 8px',
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                }}
              >
                HUMAN-FIRST
              </button>
              <span style={{ color: T.greenDim, fontSize: CRT_FONT.chrome, fontFamily: '"VT323", monospace' }}>
                {humanFirst ? 'coaching mode — you write it' : 'off'}
              </span>
            </div>

            {/* Gear editor */}
            {editingQuick && (
              <div style={{ border: `1px solid ${T.border}`, padding: '8px', borderRadius: '4px', marginBottom: '8px' }}>
                <div style={{ ...labelStyle, marginBottom: '4px' }}>
                  EDIT: {editingQuick === 'cover_letter' ? 'COVER LETTER' : editingQuick === 'why_good_fit' ? 'WHY I WANT THIS JOB' : 'CUSTOM'} PROMPT
                </div>
                <textarea
                  rows={5}
                  maxLength={AI_PROMPT_LIMIT}
                  value={draftPrompt}
                  onChange={(e) => setDraftPrompt(e.target.value)}
                  style={termTextarea}
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={saveGear} style={{ ...termBtn(true), fontSize: CRT_FONT.label }}>SAVE</button>
                  <button onClick={() => setEditingQuick(null)} style={{ ...termBtn(false), fontSize: CRT_FONT.label }}>CANCEL</button>
                </div>
              </div>
            )}

            <textarea
              rows={4}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Enter your instruction for the AI..."
              style={termTextarea}
            />
          </div>

          {/* JD */}
          <div style={{ position: 'relative' }}>
            <div style={labelStyle}>Job Description</div>
            <textarea
              rows={12}
              value={jdText}
              onChange={(e) => {
                const raw = e.target.value
                if (raw.length > 10000) {
                  setJdText(raw.slice(0, 10000))
                  setJdToast(true)
                  setTimeout(() => setJdToast(false), 3000)
                } else {
                  setJdText(raw)
                }
              }}
              placeholder="Paste job description here..."
              style={termTextarea}
            />
            <div style={{ color: jdText.length >= 10000 ? T.warn : T.greenDim, fontSize: CRT_FONT.btn, fontFamily: '"VT323", monospace', textAlign: 'right', marginTop: '2px' }}>
              {jdText.length} / 10000
            </div>
            {jdToast && (
              <div style={{
                position: 'absolute',
                bottom: '28px',
                right: '0',
                background: T.bg,
                border: `1px solid ${T.warn}`,
                color: T.warn,
                fontFamily: '"VT323", monospace',
                fontSize: CRT_FONT.label,
                padding: '3px 10px',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}>
                JD too long — truncated to 10,000 chars
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pb-1">
            {/* Generate / Cancel */}
            <div className="flex gap-2 items-center">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                style={{
                  ...termBtn(true),
                  opacity: canGenerate ? 1 : 0.3,
                  cursor: canGenerate ? 'pointer' : 'not-allowed',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                }}
              >
                GENERATE
              </button>
              <button onClick={handleClose} style={termBtn(false)}>CANCEL</button>
              <button onClick={() => setView('history')} style={termBtn(false)}>HISTORY</button>
              {provider === 'proxy' && (
                isSubscribed ? (
                  <span style={{ color: T.greenDim, fontSize: CRT_FONT.label, fontFamily: '"VT323", monospace', marginLeft: '4px' }}>
                    Pro - Unlimited Use
                  </span>
                ) : usage ? (
                  <span style={{ fontSize: CRT_FONT.label, fontFamily: '"VT323", monospace', marginLeft: '4px' }}>
                    <span style={{ color: T.greenDim }}>{usage.count}/{usage.limit} uses left this month, </span>
                    <span
                      onClick={() => createCheckoutSession().catch(() => {})}
                      style={{ color: T.warn, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      upgrade to premium for unlimited use.
                    </span>
                  </span>
                ) : null
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── OUTPUT VIEW ─────────────────────────────────────────────────────── */}
      {view === 'output' && (
        <div className="flex flex-col gap-3 px-4 py-3">
          <div style={{ color: T.greenDim, fontSize: CRT_FONT.label, letterSpacing: '0.1em' }}>
            {isStreaming ? '// GENERATING...' : humanFirst ? '// COACHING OUTPUT' : '// OUTPUT — EDIT TO REFINE'}
          </div>
          {isStreaming ? (
            <pre
              ref={outputPreRef}
              style={{
                fontFamily: '"VT323", monospace',
                fontSize: CRT_FONT.body,
                color: T.green,
                background: 'rgba(57,255,20,0.03)',
                border: `1px solid ${T.border}`,
                padding: '8px 10px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: '1.5',
                maxHeight: '52vh',
                overflowY: 'auto',
                minHeight: '80px',
              }}
            >
              {displayOutput}
            </pre>
          ) : (
            <textarea
              ref={outputTextareaRef}
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              style={{
                fontFamily: '"VT323", monospace',
                fontSize: CRT_FONT.body,
                color: T.green,
                background: 'rgba(57,255,20,0.03)',
                border: `1px solid ${T.border}`,
                padding: '8px 10px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: '1.5',
                maxHeight: '52vh',
                overflowY: 'auto',
                width: '100%',
                resize: 'vertical',
                outline: 'none',
                caretColor: T.green,
                boxSizing: 'border-box',
              }}
            />
          )}
          <div className="flex gap-2 pb-1">
            <button
              onClick={handleCopy}
              style={{
                ...termBtn(!copied),
                ...(copied ? { color: T.green, border: `1px solid ${T.green}` } : {}),
                paddingLeft: '16px',
                paddingRight: '16px',
              }}
            >
              {copied ? '✓ COPIED' : 'COPY'}
            </button>
            <button onClick={handleDownload} disabled={isStreaming} style={{ ...termBtn(false), opacity: isStreaming ? 0.3 : 1 }}>DOCX</button>
            <button onClick={() => setView('history')} style={termBtn(false)}>HISTORY</button>
            <button onClick={handleBack} style={termBtn(false)}>← BACK</button>
          </div>
          {limitHit && provider === 'proxy' && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '8px' }}>
              <div style={{ color: T.warn, fontFamily: '"VT323", monospace', fontSize: CRT_FONT.label, marginBottom: '6px' }}>
                // UPGRADE TO PRO — unlimited AI
              </div>
              <button
                onClick={() => createCheckoutSession().catch(() => {})}
                style={{
                  ...termBtn(true, T.warn),
                  paddingLeft: '16px',
                  paddingRight: '16px',
                }}
              >
                UPGRADE — $8/month
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY VIEW ────────────────────────────────────────────────────── */}
      {view === 'history' && (
        <div className="flex flex-col gap-3 px-4 py-3">
          <div style={{ color: T.greenDim, fontSize: CRT_FONT.label, letterSpacing: '0.1em' }}>
            // GENERATION HISTORY
          </div>
          {history.length === 0 ? (
            <div style={{ color: T.greenDim, fontFamily: '"VT323", monospace', fontSize: CRT_FONT.body, padding: '12px 0' }}>
              No generations saved yet.
            </div>
          ) : (
            <div style={{ maxHeight: '52vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {history.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                    border: `1px solid ${T.border}`,
                    padding: '6px 8px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{ flex: 1, minWidth: 0 }}
                    onClick={() => {
                      setOutput(entry.output)
                      setActiveHistoryId(entry.id)
                      setView('output')
                    }}
                  >
                    <div style={{ fontFamily: '"VT323", monospace', fontSize: CRT_FONT.label, color: T.green, letterSpacing: '0.05em' }}>
                      {formatHistoryLabel(entry)}
                    </div>
                    {entry.jdSnippet && (
                      <div style={{ fontFamily: '"VT323", monospace', fontSize: CRT_FONT.chrome, color: T.greenDim, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.jdSnippet}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      deleteAiHistoryEntry(userId, entry.id)
                      setHistory(loadAiHistory(userId))
                    }}
                    style={{ background: 'none', border: 'none', color: T.greenDim, cursor: 'pointer', fontFamily: '"VT323", monospace', fontSize: CRT_FONT.btn, flexShrink: 0, padding: '0 2px' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pb-1">
            <button onClick={() => setView('form')} style={termBtn(false)}>← BACK</button>
          </div>
        </div>
      )}

      {/* ── INFO DIALOG ─────────────────────────────────────────────────────── */}
      {showInfo && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            background: T.bg,
            borderRadius: '8px',
          }}
        >
          {/* Dialog header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              borderBottom: `1px solid ${T.border}`,
              flexShrink: 0,
            }}
          >
            <span style={{ color: T.greenDim, fontFamily: '"VT323", monospace', fontSize: CRT_FONT.label, letterSpacing: '0.1em' }}>
              // {provider === 'openai' ? 'OPENAI INFO' : provider === 'anthropic' ? 'ANTHROPIC INFO' : 'AI INFO'}
            </span>
            <button
              onClick={() => setShowInfo(false)}
              style={{ color: T.greenDim, fontSize: CRT_FONT.btn, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
          {/* Dialog body */}
          <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
            <pre style={{ fontFamily: '"VT323", monospace', fontSize: CRT_FONT.body, color: !connected ? T.warn : T.green, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.55', margin: 0 }}>
              {!connected
                ? `> No API key configured.\n>\n> Go to Settings → AI ASSISTANT\n> and enter your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key.\n>\n> Your key is stored locally in\n> your browser only — never sent\n> to our servers.`
                : provider === 'proxy'
                  ? `> Claude connected (managed).\n>\n> You have a monthly free tier.\n> Upgrade to Pro for unlimited use.`
                  : `> ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} connected.\n>\n> Your API key is stored locally\n> in your browser and never sent\n> to our servers.\n>\n> Select a model above and\n> start generating.`
              }
            </pre>
          </div>
          {/* Dialog footer */}
          <div style={{ padding: '8px 14px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button
              onClick={() => setShowInfo(false)}
              style={{ ...termBtn(false), fontSize: CRT_FONT.label }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* ── CONTEXT MENU ────────────────────────────────────────────────────── */}
      {ctxMenu && createPortal(
        <div
          ref={ctxMenuRef}
          style={{
            position: 'fixed',
            top: ctxMenu.y,
            left: ctxMenu.x,
            zIndex: 300,
            background: T.bg,
            border: `1px solid ${T.border}`,
            fontFamily: '"VT323", monospace',
            minWidth: '140px',
            boxShadow: '0 0 8px 1px rgba(57,255,20,0.25)',
          }}
        >
          <div style={{ padding: '4px 10px', color: T.greenDim, fontSize: CRT_FONT.chrome, borderBottom: `1px solid ${T.border}`, userSelect: 'none' }}>
            {ctxMenu.key === 'cover_letter' ? 'COVER LETTER' : ctxMenu.key === 'why_good_fit' ? 'WHY I WANT THIS JOB' : 'CUSTOM'}
          </div>
          <button
            onClick={() => {
              setDraftPrompt(quickPromptText(ctxMenu.key))
              setEditingQuick(ctxMenu.key)
              setCtxMenu(null)
            }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 10px', color: T.green, fontSize: CRT_FONT.btn, background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"VT323", monospace' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.border)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            Edit prompt
          </button>
          <button
            onClick={() => {
              applyQuickPrompt(ctxMenu.key)
              setCtxMenu(null)
            }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 10px', color: T.green, fontSize: CRT_FONT.btn, background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"VT323", monospace' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.border)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            Use prompt
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
