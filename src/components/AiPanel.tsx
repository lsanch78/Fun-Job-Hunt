import { useState, useEffect, useRef } from 'react'
import { playBootBlip, playExitBlip } from '@/lib/sfx'
import { fetchModels, streamCompletion, getAiProvider, fetchUsage, type AiProvider } from '@/services/aiService'
import { createCheckoutSession } from '@/services/subscriptionService'
import { useSubscription } from '@/lib/SubscriptionContext'
import { getResumeText } from '@/services/resumeTextService'
import { fetchAiSettings, upsertAiSettings, DEFAULT_PROMPTS, AI_PROMPT_LIMIT, type AiSettings } from '@/services/aiSettingsService'
import { getResumeSignedUrl, type ResumeSlot, type ResumeSlotRecord } from '@/services/resumeService'

// ── CRT styles — injected once, mirrors AppDetailCard ────────────────────────
const CRT_STYLE = `
@keyframes ai-console-boot {
  0%   { opacity: 0; transform: scaleY(0.04) scaleX(0.98); filter: brightness(4); }
  40%  { opacity: 1; transform: scaleY(1.08) scaleX(1);    filter: brightness(1.2); }
  60%  { opacity: 1; transform: scaleY(0.97) scaleX(1);    filter: brightness(1); }
  80%  { opacity: 1; transform: scaleY(1.01) scaleX(1);    filter: brightness(1); }
  100% { opacity: 1; transform: scaleY(1)    scaleX(1);    filter: brightness(1); }
}
@keyframes ai-crt-flicker {
  0%   { filter: brightness(1)    opacity(1); }
  18%  { filter: brightness(1)    opacity(1); }
  19%  { filter: brightness(0.94) opacity(0.97); }
  20%  { filter: brightness(1)    opacity(1); }
  45%  { filter: brightness(1)    opacity(1); }
  46%  { filter: brightness(0.97) opacity(0.98); }
  47%  { filter: brightness(1.02) opacity(1); }
  48%  { filter: brightness(1)    opacity(1); }
  72%  { filter: brightness(1)    opacity(1); }
  73%  { filter: brightness(0.96) opacity(0.98); }
  74%  { filter: brightness(1)    opacity(1); }
  100% { filter: brightness(1)    opacity(1); }
}
.ai-crt-panel {
  position: relative;
  overflow: hidden;
}
.ai-crt-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 38%, rgba(57,255,20,0.04) 0%, rgba(255,255,255,0.015) 35%, transparent 65%);
  pointer-events: none;
  z-index: 10;
  border-radius: inherit;
}
.ai-crt-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.18) 2px,
    rgba(0,0,0,0.18) 4px
  );
  pointer-events: none;
  z-index: 11;
  border-radius: inherit;
}
`
if (typeof document !== 'undefined' && !document.getElementById('ai-crt-keyframes')) {
  const el = document.createElement('style')
  el.id = 'ai-crt-keyframes'
  el.textContent = CRT_STYLE
  document.head.appendChild(el)
}

// ── Terminal palette — fixed, mirrors AppDetailCard ───────────────────────────
const T = {
  green:    '#39ff14',
  greenDim: '#23a80d',
  border:   '#2a2a2a',
  warn:     '#ff9900',
  bg:       '#000',
}

// ── Slot accent colors (mirrors QuickCast) ────────────────────────────────────
const SLOT_COLORS: Record<ResumeSlot, string> = {
  a: 'var(--color-secondary)',
  b: '#22c55e',
  c: '#f59e0b',
}

const RESUME_SLOTS: ResumeSlot[] = ['a', 'b', 'c']

// ── Sounds ────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────
type ConnectionStatus = 'checking' | 'connected' | 'not_connected'
type PanelView        = 'form' | 'output'
type QuickKey     = 'cover_letter' | 'why_good_fit' | 'custom'

interface AiPanelProps {
  userId: string
  resumeSlots: Partial<Record<ResumeSlot, ResumeSlotRecord>>
  onClose: () => void
  initialOutput?: string
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
  fontSize: '15px',
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
    fontSize: '14px',
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
  fontSize: '13px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: '2px',
  userSelect: 'none',
}

// ── localStorage helpers ──────────────────────────────────────────────────────
function slotPrefKey(userId: string)     { return `ai_panel_slots_${userId}` }
function resumeTextKey(userId: string)   { return `ai_panel_resume_text_${userId}` }

function loadSlotPref(userId: string, occupied: ResumeSlot[]): ResumeSlot[] {
  try {
    const raw = localStorage.getItem(slotPrefKey(userId))
    if (!raw) return occupied                                   // default: all occupied
    const saved = JSON.parse(raw) as ResumeSlot[]
    const valid = saved.filter((s) => occupied.includes(s))    // drop stale slots
    return valid.length > 0 ? valid : occupied                 // if all stale, reset to all
  } catch { return occupied }
}

function saveSlotPref(userId: string, slots: ResumeSlot[]) {
  try { localStorage.setItem(slotPrefKey(userId), JSON.stringify(slots)) } catch { /* ignore */ }
}

function loadResumeText(userId: string): string {
  try { return localStorage.getItem(resumeTextKey(userId)) ?? '' } catch { return '' }
}

function saveResumeText(userId: string, text: string) {
  try {
    if (text.trim()) localStorage.setItem(resumeTextKey(userId), text)
    else localStorage.removeItem(resumeTextKey(userId))
  } catch { /* ignore */ }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AiPanel({ userId, resumeSlots, onClose, initialOutput }: AiPanelProps) {
  const { isSubscribed } = useSubscription()
  const occupiedSlots = RESUME_SLOTS.filter((s) => resumeSlots[s])

  const [status,            setStatus]           = useState<ConnectionStatus>('checking')
  const [models,            setModels]           = useState<string[]>([])
  const [selectedModel,     setSelectedModel]    = useState<string>('')
  const [selectedSlots,     setSelectedSlots]    = useState<ResumeSlot[]>(() => loadSlotPref(userId, occupiedSlots))
  const [textInputActive,   setTextInputActive]  = useState(false)
  const [resumeTextInput,   setResumeTextInput]  = useState(() => loadResumeText(userId))
  const [jdText,            setJdText]           = useState('')
  const [promptText,        setPromptText]       = useState('')
  const [editingQuick,      setEditingQuick]     = useState<QuickKey | null>(null)
  const [draftPrompt,       setDraftPrompt]      = useState('')
  const [view,              setView]             = useState<PanelView>(initialOutput ? 'output' : 'form')
  const [output,            setOutput]           = useState(initialOutput ?? '')
  const [isStreaming,       setIsStreaming]       = useState(false)
  const [copied,            setCopied]           = useState(false)
  const [aiSettings,        setAiSettings]       = useState<AiSettings | null>(null)
  const [showInfo,          setShowInfo]         = useState(false)
  const [provider,          setProvider]         = useState<AiProvider>(() => getAiProvider())
  const [usage,             setUsage]            = useState<{ count: number; limit: number } | null>(null)
  const [limitHit,          setLimitHit]         = useState(false)

  const abortRef  = useRef<AbortController | null>(null)
  const outputRef = useRef<HTMLPreElement>(null)

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    playBootBlip()

    const p = getAiProvider()
    setProvider(p)
    fetchModels().then(({ status: s, models: m }) => {
      setStatus(s)
      setModels(m)
      if (m.length > 0) setSelectedModel(m[0])
    })
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

  // Auto-scroll output as it streams
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

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
    if (key === 'cover_letter') return aiSettings?.cover_letter_prompt || DEFAULT_PROMPTS.cover_letter
    if (key === 'why_good_fit') return aiSettings?.why_good_fit_prompt || DEFAULT_PROMPTS.why_good_fit
    return aiSettings?.custom_prompt || DEFAULT_PROMPTS.custom
  }

  function applyQuickPrompt(key: QuickKey) {
    setPromptText(quickPromptText(key))
  }

  function openGear(key: QuickKey) {
    setDraftPrompt(quickPromptText(key))
    setEditingQuick(key)
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

  async function assemblePrompt(): Promise<string> {
    const parts: string[] = []
    for (const slot of selectedSlots) {
      const signedUrl = await getResumeSignedUrl(userId, slot)
      const text = signedUrl ? await getResumeText(userId, slot, signedUrl) : ''
      if (text) parts.push(`--- RESUME ${slot.toUpperCase()} ---\n${text}`)
    }
    if (textInputActive && resumeTextInput.trim()) {
      parts.push(`--- RESUME (PASTED) ---\n${resumeTextInput.trim()}`)
    }
    let prompt = ''
    if (parts.length > 0) prompt += `RESUME:\n${parts.join('\n\n')}\n\n`
    if (jdText.trim()) prompt += `JOB DESCRIPTION:\n${jdText.trim()}`
    return prompt
  }

  async function handleGenerate() {
    const system = resolveSystemPrompt()
    const prompt = await assemblePrompt()
    setView('output')
    setOutput('')
    setLimitHit(false)
    setIsStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller
    streamCompletion({
      model: selectedModel,
      system,
      prompt,
      signal: controller.signal,
      onToken: (token) => setOutput((prev) => prev + token),
      onDone: () => {
        setIsStreaming(false)
        if (getAiProvider() === 'proxy') fetchUsage().then(setUsage)
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
    status === 'connected' &&
    selectedModel !== '' &&
    promptText.trim().length > 0
  const displayOutput = isStreaming ? output + '▌' : output

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="ai-crt-panel flex flex-col w-[525px]"
      style={{
        animation: 'ai-console-boot 0.3s ease-out forwards, ai-crt-flicker 8s steps(1,end) 0.3s infinite',
        fontFamily: '"VT323", monospace',
        background: T.bg,
        border: `1px solid ${T.border}`,
        color: T.green,
        borderRadius: '8px',
        textShadow: '0 0 4px rgba(57,255,20,0.25)',
        boxShadow: [
          '0 0 0 1px #111',
          '0 0 8px 1px rgba(57,255,20,0.35)',
          '0 0 28px 4px rgba(57,255,20,0.15)',
          'inset 0 0 60px 30px rgba(0,0,0,0.70)',
          'inset 0 0 10px 2px rgba(57,255,20,0.06)',
        ].join(', '),
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <span style={{ color: T.green, fontSize: '16px', letterSpacing: '0.08em' }}>
          // AI RESUME ASSISTANT
        </span>
        <div className="flex items-center gap-3">
          {status === 'checking' && (
            <span className="animate-pulse" style={{ color: T.greenDim, fontSize: '13px' }}>
              ○ CHECKING...
            </span>
          )}
          {status === 'connected' && (
            <span style={{ color: T.greenDim, fontSize: '13px' }}>
              <span style={{ color: T.green }}>●</span> CONNECTED
            </span>
          )}
          {status === 'not_connected' && (
            <span style={{ color: T.greenDim, fontSize: '13px' }}>
              <span style={{ color: T.warn }}>○</span> NO API KEY
            </span>
          )}
          <button
            onClick={() => setShowInfo(true)}
            style={{ color: T.greenDim, fontSize: '13px', lineHeight: 1, background: 'none', border: `1px solid ${T.border}`, cursor: 'pointer', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"VT323", monospace' }}
          >
            ?
          </button>
          <button
            onClick={handleClose}
            style={{ color: T.greenDim, fontSize: '16px', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}
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
              disabled={status !== 'connected' || models.length === 0}
              style={{
                ...termSelect,
                opacity: status !== 'connected' ? 0.35 : 1,
                cursor: status !== 'connected' ? 'not-allowed' : 'pointer',
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
              <div style={{ color: T.warn, fontSize: '13px', lineHeight: '1.6' }}>
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
                        fontSize: '14px',
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
                <div style={{ color: resumeTextInput.length >= 8000 ? T.warn : T.greenDim, fontSize: '12px', fontFamily: '"VT323", monospace', textAlign: 'right', marginTop: '2px' }}>
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
                style={{ ...termBtn(false), fontSize: '13px' }}
              >
                COVER LETTER
              </button>
              <button
                onClick={() => openGear('cover_letter')}
                title="Customize cover letter prompt"
                style={{ ...termBtn(false), fontSize: '12px', padding: '1px 6px' }}
              >
                ⚙
              </button>

              {/* Why This Job? */}
              <button
                onClick={() => applyQuickPrompt('why_good_fit')}
                style={{ ...termBtn(false), fontSize: '13px' }}
              >
                WHY THIS JOB?
              </button>
              <button
                onClick={() => openGear('why_good_fit')}
                title="Customize why-good-fit prompt"
                style={{ ...termBtn(false), fontSize: '12px', padding: '1px 6px' }}
              >
                ⚙
              </button>

              {/* Custom */}
              <button
                onClick={() => applyQuickPrompt('custom')}
                style={{ ...termBtn(false), fontSize: '13px' }}
              >
                CUSTOM
              </button>
              <button
                onClick={() => openGear('custom')}
                title="Customize your custom prompt"
                style={{ ...termBtn(false), fontSize: '12px', padding: '1px 6px' }}
              >
                ⚙
              </button>
            </div>

            {/* Gear editor */}
            {editingQuick && (
              <div style={{ border: `1px solid ${T.border}`, padding: '8px', borderRadius: '4px', marginBottom: '8px' }}>
                <div style={{ ...labelStyle, marginBottom: '4px' }}>
                  EDIT: {editingQuick === 'cover_letter' ? 'COVER LETTER' : editingQuick === 'why_good_fit' ? 'WHY THIS JOB?' : 'CUSTOM'} PROMPT
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
                  <button onClick={saveGear} style={{ ...termBtn(true), fontSize: '13px' }}>SAVE</button>
                  <button onClick={() => setEditingQuick(null)} style={{ ...termBtn(false), fontSize: '13px' }}>CANCEL</button>
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
          <div>
            <div style={labelStyle}>Job Description</div>
            <textarea
              rows={7}
              maxLength={10000}
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste job description here..."
              style={termTextarea}
            />
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
              {provider === 'proxy' && (
                isSubscribed ? (
                  <span style={{ color: T.greenDim, fontSize: '12px', fontFamily: '"VT323", monospace', marginLeft: '4px' }}>
                    Pro - Unlimited Use
                  </span>
                ) : usage ? (
                  <span style={{ fontSize: '12px', fontFamily: '"VT323", monospace', marginLeft: '4px' }}>
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
          <div style={{ color: T.greenDim, fontSize: '13px', letterSpacing: '0.1em' }}>
            {isStreaming ? '// GENERATING...' : '// OUTPUT'}
          </div>
          <pre
            ref={outputRef}
            style={{
              fontFamily: '"VT323", monospace',
              fontSize: '14px',
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
            <button onClick={handleBack} style={termBtn(false)}>← BACK</button>
          </div>
          {limitHit && provider === 'proxy' && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '8px' }}>
              <div style={{ color: T.warn, fontFamily: '"VT323", monospace', fontSize: '13px', marginBottom: '6px' }}>
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
            <span style={{ color: T.greenDim, fontFamily: '"VT323", monospace', fontSize: '13px', letterSpacing: '0.1em' }}>
              // {provider === 'openai' ? 'OPENAI INFO' : provider === 'anthropic' ? 'ANTHROPIC INFO' : 'AI INFO'}
            </span>
            <button
              onClick={() => setShowInfo(false)}
              style={{ color: T.greenDim, fontSize: '16px', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
          {/* Dialog body */}
          <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
            <pre style={{ fontFamily: '"VT323", monospace', fontSize: '14px', color: status === 'not_connected' ? T.warn : T.green, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.55', margin: 0 }}>
              {status === 'not_connected'
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
              style={{ ...termBtn(false), fontSize: '13px' }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
