# AI Resume Assistant — Production Spec

**App:** fjobhunt | **Status:** Ready for implementation | **Date:** 2026-05-25

---

## Table of Contents

1. [Overview](#1-overview)
2. [User Flow](#2-user-flow)
3. [UI Spec](#3-ui-spec)
4. [Technical Spec](#4-technical-spec)
5. [Data Model](#5-data-model)
6. [New Files](#6-new-files)
7. [Modified Files](#7-modified-files)
8. [Out of Scope](#8-out-of-scope)

---

## 1. Overview

Optional, zero-cost, privacy-first AI assistant using a locally-running Ollama instance. No API keys, no cloud calls, no data leaves the machine beyond what is already stored in Supabase.

The feature integrates into the existing **QuickCast bar** at the bottom of the app — an `[AI]` button opens an upward-popping panel, consistent with the existing add/edit form pattern. If Ollama is not installed, a clear inline message explains how to get it and all controls remain disabled until a connection is detected.

The aesthetic matches the existing pixel/terminal design system exactly: `font-pixel`, `bg-surface`, `border-border`, `text-primary`, `text-muted`, `text-secondary`, `text-warning` CSS variables, and zero Tailwind transitions.

---

## 2. User Flow

### Happy Path (Ollama Installed)

```
1. User clicks [AI] button in QuickCast bar
2. Panel opens — two checks run concurrently:
   a. GET localhost:11434/api/tags → populate model dropdown
   b. Fetch + cache resume PDF text for all occupied slots
3. Status indicator shows: ● CONNECTED
4. User selects a model from the dropdown (first available pre-selected)
5. User toggles which resume slot(s) to include (A, B, C — occupied slots only)
6. User selects a mode: [ COVER LETTER ] [ WHY GOOD FIT ] [ CUSTOM ]
7. User pastes job description into the JD textarea
8. User clicks [ GENERATE ]
9. Panel flips to output view:
   - Header: "// GENERATING..." while streaming
   - Text streams in with ▌ blinking cursor at end
   - Header changes to "// OUTPUT" when complete
10. [ COPY ] copies full text to clipboard
    [ BACK ] returns to form with all state preserved
```

### Ollama Not Detected

```
1. User clicks [AI] button
2. Panel opens
3. Status indicator shows: ○ NOT DETECTED
4. Inline terminal message:
   > Ollama not running.
   > Install: ollama.com
   > Then run: ollama serve
5. [ GENERATE ] is disabled
6. Model dropdown shows "-- no models --" and is disabled
7. All other form fields remain interactive (user can prepare JD text)
```

### Edge Cases

| Scenario | Behaviour |
|---|---|
| No resume slots occupied | File slot toggles hidden; `[+ TEXT]` toggle still shown so user can paste resume text directly |
| Partial slots (e.g. only A and C) | Only occupied slots shown as toggles |
| Generation error / Ollama dies mid-stream | Partial text shown + `// ERROR: connection lost` in `text-warning`; BACK and COPY remain available |
| Empty JD for Cover Letter / Why Good Fit | GENERATE disabled until JD field has at least 1 non-whitespace character |
| Custom mode with empty instruction | GENERATE disabled until instruction field has content; JD field is optional |

---

## 3. UI Spec

### 3.1 AI Button in QuickCast Bar

Fourth zone in the hotbar, after the resume slots group, separated by a gap.

```
Size:         w-20 h-20 (matches all other hotbar buttons)
Icon:         "AI" text rendered in font-pixel at 14px (same as 'gh', 'in', 'x' text icons)
Label below:  "AI ASSIST" at text-[7px] tracking-widest text-muted
Inactive:     border-border text-muted hover:border-primary hover:text-primary
Active:       border-primary text-primary
```

### 3.2 Panel Container

```
position:   absolute bottom-full right-0 mb-2 z-50
width:      w-96 (384px)
background: bg-surface
border:     border border-border
font:       font-pixel text-xs
```

### 3.3 Form View Layout

```
┌──────────────────────────────────────────┐
│ // AI RESUME ASSISTANT         [STATUS]  │  ← header
├──────────────────────────────────────────┤
│ MODEL                                    │
│ [ llama3.2:latest            ▼ ]         │  ← <select> dropdown
├──────────────────────────────────────────┤
│ RESUME                                   │
│ [ A: SWE Resume ] [ B: Startup ] [+ TEXT]│  ← occupied slots + plain text toggle
├──────────────────────────────────────────┤
│ (if TEXT toggle active):                 │
│ RESUME TEXT                              │
│ ┌────────────────────────────────────┐   │
│ │ Paste or type your resume here...  │   │  ← textarea rows=6, placeholder text
│ └────────────────────────────────────┘   │
├──────────────────────────────────────────┤
│ MODE                                     │
│ [ COVER LETTER ] [ WHY GOOD FIT ] [CUSTOM│  ← mode toggles
├──────────────────────────────────────────┤
│ JOB DESCRIPTION                          │
│ ┌────────────────────────────────────┐   │
│ │ Paste job description here...      │   │  ← textarea rows=6
│ └────────────────────────────────────┘   │
│                                          │
│ (CUSTOM mode only — additional field):   │
│ INSTRUCTION                              │
│ ┌────────────────────────────────────┐   │
│ │ Write a cold outreach email...     │   │  ← textarea rows=3
│ └────────────────────────────────────┘   │
│ JOB DESCRIPTION (OPTIONAL)              │
│ ┌────────────────────────────────────┐   │
│ │ Paste job description here...      │   │  ← textarea rows=5
│ └────────────────────────────────────┘   │
├──────────────────────────────────────────┤
│ [ GENERATE ]          [ CANCEL ]         │
└──────────────────────────────────────────┘
```

**Plain text toggle (`[+ TEXT]`):**

A fourth toggle button in the RESUME row, always visible (not tied to any upload slot). Label: `+ TEXT`. When active, label becomes `✕ TEXT` and a textarea expands below the resume row for direct paste/type input. The text entered here is treated identically to extracted slot text — it is included in the prompt alongside any selected file slots.

```
Inactive: border-border text-muted hover:border-secondary hover:text-secondary
Active:   border-primary text-primary
Label:    "+ TEXT" / "✕ TEXT"
```

This is the lowest-friction input path: no file upload, no Ollama setup dependency for context — users who haven't uploaded a resume can still use the feature by pasting bullet points, a LinkedIn bio, or any freeform career summary.

**Status indicator** (top-right of header):
- `● CONNECTED` — bullet in `text-primary`, label in `text-muted`
- `○ NOT DETECTED` — bullet in `text-muted`, label in `text-warning`
- `○ CHECKING...` — `animate-pulse`

**Resume toggles:**
```
Inactive: border-border text-muted
Active A: var(--color-secondary)
Active B: #22c55e
Active C: #f59e0b
Label:    "{SLOT}: {resumeName.slice(0, 8)}"
```

**Mode buttons:**
```
Inactive: border-border text-muted hover:border-secondary hover:text-secondary
Active:   border-primary text-primary
```

**GENERATE button:**
```
Enabled:  bg-primary text-bg px-4 py-1 text-[9px] font-pixel hover:opacity-80
Disabled: same + opacity-30 cursor-not-allowed
```

### 3.4 Output View Layout

```
┌──────────────────────────────────────────┐
│ // GENERATING...   →   // OUTPUT         │
├──────────────────────────────────────────┤
│ ┌────────────────────────────────────┐   │
│ │ Dear Hiring Manager,               │   │
│ │                                    │   │
│ │ I am writing to express...▌        │   │  ← streaming + cursor
│ └────────────────────────────────────┘   │  ← max-h-72 overflow-y-auto
├──────────────────────────────────────────┤
│ [ COPY ]                  [ BACK ]       │
└──────────────────────────────────────────┘
```

**Streaming cursor:** `▌` appended to output string while `isStreaming === true`. Removed on done.

**COPY button states:**
- Normal: `bg-primary text-bg`
- Copied: `bg-bg border border-primary text-primary` + label `COPIED!` — reverts after 800ms

---

## 4. Technical Spec

### 4.1 Ollama API

Base URL: `http://localhost:11434` — hardcoded constant, not configurable.

**Status check + model list:**
```
GET http://localhost:11434/api/tags
Timeout: 3 seconds (AbortController)
Response: { models: [{ name: string, modified_at: string, size: number }] }
```
On any failure → `status: 'not_connected'`, `models: []`.

**Streaming completion:**
```
POST http://localhost:11434/api/generate
Body: { model, system, prompt, stream: true }
```
Response is newline-delimited JSON. Each line:
```json
{ "response": "token", "done": false }
{ "response": "",      "done": true  }
```
Read via `ReadableStream` → `TextDecoder` → split on `\n` → parse JSON → append `obj.response` to state. When `done: true` → set `isStreaming = false`.

**Abort on unmount:** Store `AbortController` in `useRef`, call `controller.abort()` in `useEffect` cleanup.

**CORS note:** Ollama allows `localhost` origins by default. If deployed to a non-localhost domain, the user must run Ollama with `OLLAMA_ORIGINS=*`.

### 4.2 Resume Text Extraction

The feature supports three input formats. Format is determined by the file's MIME type at upload time and stored alongside the slot metadata (or inferred from the filename extension as a fallback).

#### Supported Formats

| Format | MIME type | Extraction method |
|---|---|---|
| PDF | `application/pdf` | pdf.js client-side extraction |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | mammoth.js XML extraction |
| Plain text | `text/plain` | Direct string decode, no library needed |

#### PDF Extraction

**Dependency:** `pdfjs-dist ^4.4.168`

**Worker config** (module level in `resumeTextService.ts`):
```typescript
import * as pdfjsLib from 'pdfjs-dist'
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()
```

**Flow:**
1. Receive `signedUrl` from `getResumeSignedUrl()`
2. `fetch(signedUrl)` → `ArrayBuffer`
3. `pdfjsLib.getDocument({ data: arrayBuffer }).promise` → `PDFDocumentProxy`
4. Iterate pages 1–N: `page.getTextContent()` → concatenate `item.str` values
5. Join pages with `\n\n`, return full string

**Known limitation:** Complex PDF layouts (multi-column, tables, text boxes) may extract with garbled ordering. This is a pdf.js limitation with no workaround client-side.

#### DOCX Extraction

**Dependency:** `mammoth ^1.8.0`

```typescript
import mammoth from 'mammoth'

const arrayBuffer = await fetch(signedUrl).then(r => r.arrayBuffer())
const result = await mammoth.extractRawText({ arrayBuffer })
return result.value  // plain text string, no HTML
```

`mammoth.extractRawText` strips all formatting and returns clean paragraphs. More reliable than pdf.js for structured documents since DOCX is XML-based. Use `extractRawText`, not `convertToHtml` — the LLM receives plain text only.

#### Plain Text

**No library needed.** Accept `.txt` files. Decode directly:

```typescript
const arrayBuffer = await fetch(signedUrl).then(r => r.arrayBuffer())
return new TextDecoder('utf-8').decode(arrayBuffer)
```

This also covers the "dump resume info as plain text" use case — users who prefer not to upload a formatted document can paste their experience, skills, and history into a `.txt` file and upload that. The LLM handles unstructured plain text well for this task.

#### Format Detection

Determine format at extraction time from the signed URL file extension or stored MIME type:

```typescript
function detectFormat(url: string): 'pdf' | 'docx' | 'txt' {
  const lower = url.toLowerCase()
  if (lower.includes('.docx')) return 'docx'
  if (lower.includes('.txt'))  return 'txt'
  return 'pdf'  // default
}
```

#### Upload Validation Changes (`QuickCast.tsx`)

Update the file input `accept` attribute and MIME check to allow all three formats:

```tsx
// Before:
accept=".pdf,application/pdf"

// After:
accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
```

Update the MIME type guard in `handleResumeFileInput`:
```typescript
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]
if (!file || !ACCEPTED_TYPES.includes(file.type)) return
```

#### In-Memory Cache

```typescript
// Module-level — persists across panel open/close, cleared on page reload
const textCache = new Map<string, string>() // key: "{userId}:{slot}"
```
On panel open, fetch + cache all occupied slots. Check cache first; skip fetch if present.

**Cache invalidation:** Call `resumeTextService.invalidateSlot(userId, slot)` in `QuickCast.tsx` after any successful file upload.

### 4.3 Prompt Assembly

**System prompts** come from `ai_settings` table (user-edited). Fall back to `DEFAULT_PROMPTS` if no row exists or stored value is empty.

| Mode | `system` field | `prompt` field |
|---|---|---|
| Cover Letter | cover_letter_prompt | resume text(s) + JD |
| Why Good Fit | why_good_fit_prompt | resume text(s) + JD |
| Custom | user's instruction | JD (optional) |

**User prompt format (Cover Letter / Why Good Fit):**
```
RESUME:
{resume text for each selected file slot, separated by "\n\n--- RESUME {SLOT} ---\n\n"}
{if textInputActive and resumeTextInput non-empty: "\n\n--- RESUME (PASTED) ---\n\n{resumeTextInput}"}

JOB DESCRIPTION:
{jdText}
```

All resume sources (file slots + pasted text) are concatenated in the same `RESUME:` block. If only the text input is used and no file slots are selected, the block still renders correctly with just the pasted content.

**Default system prompts:**

*Cover Letter:*
> You are an expert job application writer. Write a formal, professional cover letter in 3 paragraphs. Paragraph 1: introduce the candidate and the role. Paragraph 2: match the candidate's specific experience to the job description requirements. Paragraph 3: closing with a call to action. Do not include addresses or dates. Output only the letter body.

*Why Good Fit:*
> You are a recruiter reviewing a candidate's resume against a job description. Write a concise 3-5 sentence analysis explaining why this candidate is a strong fit for the role. Reference specific skills, experiences, and requirements by name. Be direct and factual. Output only the analysis, no preamble.

### 4.4 Component State (`AiPanel.tsx`)

```typescript
type OllamaStatus = 'checking' | 'connected' | 'not_connected'
type PanelView    = 'form' | 'output'
type AiMode       = 'cover_letter' | 'why_good_fit' | 'custom'

const [status,            setStatus]            = useState<OllamaStatus>('checking')
const [models,            setModels]            = useState<string[]>([])
const [selectedModel,     setSelectedModel]     = useState<string>('')
const [selectedSlots,     setSelectedSlots]     = useState<ResumeSlot[]>([])
const [textInputActive,   setTextInputActive]   = useState(false)
const [resumeTextInput,   setResumeTextInput]   = useState('')
const [mode,              setMode]              = useState<AiMode>('cover_letter')
const [jdText,            setJdText]            = useState('')
const [customInstruction, setCustomInstruction] = useState('')
const [view,              setView]              = useState<PanelView>('form')
const [output,            setOutput]            = useState('')
const [isStreaming,       setIsStreaming]       = useState(false)
const [aiSettings,        setAiSettings]        = useState<AiSettings | null>(null)
```

**On mount:**
1. `ollamaService.fetchModels()` → set `status` + `models`
2. `aiSettingsService.fetchAiSettings(userId)` → set `aiSettings`
3. For each occupied slot: `resumeTextService.getResumeText(userId, slot, signedUrl)` (fire-and-forget for cache warm)

**On GENERATE:**
1. Assemble `system` from `aiSettings` or `DEFAULT_PROMPTS` based on `mode`
2. Assemble `prompt` from selected slot text + JD
3. Set `view = 'output'`, `output = ''`, `isStreaming = true`
4. Call `ollamaService.streamCompletion({ model, system, prompt, onToken, onDone, onError, signal })`
   - `onToken(token)` → `setOutput(prev => prev + token)`
   - `onDone()` → `setIsStreaming(false)`
   - `onError(err)` → append `\n\n// ERROR: {err}` to output, `setIsStreaming(false)`

**Displayed output:** `isStreaming ? output + '▌' : output`

### 4.5 Service API Contracts

**`ollamaService.ts`:**
```typescript
export async function fetchModels(): Promise<{
  status: 'connected' | 'not_connected'
  models: string[]
}>

export async function streamCompletion(params: {
  model: string
  system: string
  prompt: string
  onToken: (token: string) => void
  onDone: () => void
  onError: (message: string) => void
  signal?: AbortSignal
}): Promise<void>
```

**`resumeTextService.ts`:**
```typescript
export function invalidateSlot(userId: string, slot: ResumeSlot): void

export async function getResumeText(
  userId: string,
  slot: ResumeSlot,
  signedUrl: string,
): Promise<string>  // returns '' on any error, never throws
```

**`aiSettingsService.ts`:**
```typescript
export interface AiSettings {
  user_id: string
  cover_letter_prompt: string
  why_good_fit_prompt: string
}

export const DEFAULT_PROMPTS: { cover_letter: string; why_good_fit: string }

export async function fetchAiSettings(userId: string): Promise<AiSettings | null>

export async function upsertAiSettings(
  settings: AiSettings
): Promise<{ error: string | null }>
```

---

## 5. Data Model

### New Table: `ai_settings`

Migration: `supabase/migrations/20250525000006_ai_settings.sql`

```sql
create table if not exists public.ai_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  cover_letter_prompt text not null default '',
  why_good_fit_prompt text not null default '',
  updated_at          timestamptz not null default now()
);

alter table public.ai_settings enable row level security;

create policy "ai_settings_select" on public.ai_settings
  for select to authenticated using (user_id = auth.uid());

create policy "ai_settings_insert" on public.ai_settings
  for insert to authenticated with check (user_id = auth.uid());

create policy "ai_settings_update" on public.ai_settings
  for update to authenticated using (user_id = auth.uid());

create policy "ai_settings_delete" on public.ai_settings
  for delete to authenticated using (user_id = auth.uid());
```

### Existing Tables Used (No Schema Changes)

- `resume_slots` — read for slot names and occupied-slot detection
- `resumes` (Supabase Storage) — signed URLs fetched via existing `getResumeSignedUrl()`

### No New localStorage Keys

Resume text is held in module-level memory only.

---

## 6. New Files

| File | Purpose |
|---|---|
| `src/services/ollamaService.ts` | All Ollama communication: `fetchModels`, `streamCompletion` |
| `src/services/resumeTextService.ts` | pdf.js / mammoth / plain text extraction + in-memory cache: `getResumeText`, `invalidateSlot` |
| `src/services/aiSettingsService.ts` | Supabase wrapper: `fetchAiSettings`, `upsertAiSettings`, `DEFAULT_PROMPTS` |
| `src/components/AiPanel.tsx` | Full panel UI — form view + output view |
| `supabase/migrations/20250525000006_ai_settings.sql` | Table + RLS policies |

---

## 7. Modified Files

### `src/components/QuickCast.tsx`

1. Import `AiPanel`, `invalidateSlot`
2. Add `aiPanelOpen` state
3. Add fourth hotbar zone (after resume slots) with `[AI]` button + `<AiPanel>` conditional render
4. Call `invalidateSlot(userId, slot)` in `handleResumeFileInput` after successful upload
5. Expand outside-click handler to also close `aiPanelOpen`

### `src/pages/SettingsPage.tsx`

Add `AI ASSISTANT` section after the existing `DATA` section:
- Two `<textarea>` fields for editing Cover Letter and Why Good Fit system prompts
- `[ Save AI Settings ]` button → calls `upsertAiSettings`
- `[ Reset to Defaults ]` button → restores `DEFAULT_PROMPTS` values to local state (does not auto-save)
- Load existing settings on mount via `fetchAiSettings`

### `package.json`

```
npm install pdfjs-dist mammoth
```

---

## 8. Out of Scope

- Cloud LLM providers (OpenAI, Anthropic, Gemini, etc.)
- API key storage of any kind
- Prompt history or conversation memory
- Saving generated output to job records
- Mobile layout
- Ollama model management UI (pull/delete models)
- Per-job AI context (user pastes JD manually)
- Markdown rendering of output (`whitespace-pre-wrap` plain text only)
- Resume text chunking / token limit handling
- Syntax highlighting
- i18n / localization

---

## 9. Suggested Implementation Order

1. `supabase/migrations/20250525000006_ai_settings.sql` — run migration first
2. `src/services/ollamaService.ts` — no dependencies, testable in isolation
3. `src/services/resumeTextService.ts` — depends on `pdfjs-dist` + existing `resumeService`
4. `src/services/aiSettingsService.ts` — thin Supabase wrapper
5. `src/components/AiPanel.tsx` — wires all three services together
6. `src/components/QuickCast.tsx` — add button + mount panel
7. `src/pages/SettingsPage.tsx` — add AI settings section
