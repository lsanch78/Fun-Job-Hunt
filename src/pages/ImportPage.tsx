import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseCSVRow } from '@/lib/csvData'
import { playLinkBlip, playThud } from '@/lib/sfx'
import type { JobStatus } from '@/types'

// ── DEV MODE: all backend calls are stubbed ───────────────────────────────────
const DEV_STUB = true

// ── Constants ──────────────────────────────────────────────────────────────────

const SESSION_KEY = 'fjobhunt:pending-import'
const PREVIEW_ROWS = 10

const APP_FIELDS = [
  { key: 'company',         label: 'COMPANY',     required: true  },
  { key: 'title',           label: 'TITLE',       required: true  },
  { key: 'status',          label: 'STATUS',      required: false },
  { key: 'date_applied',    label: 'DATE',        required: false },
  { key: 'salary',          label: 'SALARY',      required: false },
  { key: 'posting_url',     label: 'URL',         required: false },
  { key: 'rating',          label: 'RATING',      required: false },
  { key: 'description',     label: 'DESCRIPTION', required: false },
  { key: 'notes',           label: 'NOTES',       required: false },
] as const

type AppFieldKey = typeof APP_FIELDS[number]['key'] | 'skip'

const VALID_STATUSES = new Set<string>([
  'APPLIED', 'PHONE_SCREEN', 'INTERVIEW', 'OFFER', 'REJECTED', 'GHOSTED', 'WITHDRAWN',
])

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = parseCSVRow(lines[0])
  const rows = lines.slice(1).map(parseCSVRow)
  return { headers, rows }
}

function normaliseStatus(raw: string): JobStatus {
  const norm = raw.trim().replace(/\s+/g, '_').toUpperCase()
  if (VALID_STATUSES.has(norm)) return norm as JobStatus
  const mappings: Record<string, JobStatus> = {
    'SUBMITTED': 'APPLIED', 'SENT': 'APPLIED', 'IN_PROGRESS': 'INTERVIEW',
    'DECLINED': 'REJECTED', 'DENIED': 'REJECTED', 'NO': 'REJECTED',
    'HIRED': 'OFFER', 'YES': 'OFFER', 'SCREENING': 'PHONE_SCREEN',
    'PHONE': 'PHONE_SCREEN', 'NO_RESPONSE': 'GHOSTED', 'CLOSED': 'WITHDRAWN',
  }
  return mappings[norm] ?? 'APPLIED'
}

function formatPreview(value: string, field: AppFieldKey): string {
  if (!value) return '—'
  if (field === 'status')      return normaliseStatus(value)
  if (field === 'salary')      return value.replace(/[^0-9.]/g, '') ? `$${value.replace(/[^0-9.]/g, '')}K` : value
  if (field === 'rating')      return `${Math.min(5, Math.max(0, parseInt(value) || 0))}/5`
  if (field === 'date_applied') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? '⚠ invalid date' : value.slice(0, 10)
  }
  return value.length > 24 ? value.slice(0, 24) + '…' : value
}

// ── Haiku column mapping ───────────────────────────────────────────────────────

const FUZZY_MAP: Record<string, AppFieldKey> = {
  company: 'company', employer: 'company', organization: 'company', org: 'company',
  title: 'title', role: 'title', position: 'title', 'job title': 'title',
  status: 'status', stage: 'status', state: 'status',
  date: 'date_applied', applied: 'date_applied', 'date applied': 'date_applied', 'application date': 'date_applied',
  salary: 'salary', compensation: 'salary', pay: 'salary', 'salary range': 'salary',
  url: 'posting_url', link: 'posting_url', 'job url': 'posting_url', 'posting url': 'posting_url',
  rating: 'rating', score: 'rating', stars: 'rating',
  description: 'description', 'job description': 'description',
  notes: 'notes', note: 'notes', comments: 'notes', comment: 'notes',
}

async function getAiMapping(
  headers: string[],
  _sampleRows: string[][],
): Promise<Record<string, AppFieldKey>> {
  // DEV STUB: fuzzy match headers locally, simulate AI delay
  await new Promise((r) => setTimeout(r, 900))
  const result: Record<string, AppFieldKey> = {}
  for (const h of headers) {
    const key = h.toLowerCase().trim()
    result[h] = FUZZY_MAP[key] ?? 'notes'
  }
  if (DEV_STUB) console.log('[ImportPage DEV] AI mapping stub result:', result)
  return result
}

// ── Import execution ──────────────────────────────────────────────────────────

interface ImportResult { imported: number; skipped: number; errors: string[] }

async function runImport(
  rows: string[][],
  headers: string[],
  mapping: Record<string, AppFieldKey>,
  _userId: string,
): Promise<ImportResult> {
  // DEV STUB: simulate import delay, count rows without hitting DB
  await new Promise((r) => setTimeout(r, 800))
  let imported = 0, skipped = 0
  const get = (row: string[], field: AppFieldKey) => {
    const col = headers.find((h) => mapping[h] === field)
    return col !== undefined ? (row[headers.indexOf(col)] ?? '').trim() : ''
  }
  for (const row of rows) {
    const company = get(row, 'company')
    const title   = get(row, 'title')
    if (!company || !title) { skipped++; continue }
    imported++
  }
  if (DEV_STUB) console.log(`[ImportPage DEV] Stub import: ${imported} imported, ${skipped} skipped`)
  return { imported, skipped, errors: [] }
}

// ── Step components ────────────────────────────────────────────────────────────

type Step = 'upload' | 'map' | 'importing' | 'done'

interface ParsedCSV { headers: string[]; rows: string[][] }

// ── Main component ─────────────────────────────────────────────────────────────

export default function ImportPage({ userId }: { userId: string | null }) {
  const navigate = useNavigate()
  const [step, setStep]         = useState<Step>('upload')
  const [parsed, setParsed]     = useState<ParsedCSV | null>(null)
  const [mapping, setMapping]   = useState<Record<string, AppFieldKey>>({})
  const [aiLoading, setAiLoading] = useState(false)
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null) // column header being dragged over
  const [dragging, setDragging] = useState<string | null>(null) // app field key being dragged
  const fileRef = useRef<HTMLInputElement>(null)

  // Restore pending import after auth redirect
  useEffect(() => {
    const pending = sessionStorage.getItem(SESSION_KEY)
    if (!pending) return
    try {
      const { parsed: p, mapping: m } = JSON.parse(pending) as { parsed: ParsedCSV; mapping: Record<string, AppFieldKey> }
      setParsed(p)
      setMapping(m)
      setStep('map')
      sessionStorage.removeItem(SESSION_KEY)
    } catch { sessionStorage.removeItem(SESSION_KEY) }
  }, [])

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      const p = parseCSV(text)
      if (p.headers.length === 0) return
      setParsed(p)
      setStep('map')
      setAiLoading(true)
      const m = await getAiMapping(p.headers, p.rows.slice(0, 3))
      setMapping(m)
      setAiLoading(false)
    }
    reader.readAsText(file)
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleMappingChange(header: string, field: AppFieldKey) {
    setMapping((prev) => {
      const next = { ...prev }
      // clear any other column mapped to this field (except notes — multiple allowed)
      if (field !== 'notes' && field !== 'skip') {
        for (const [h, f] of Object.entries(next)) {
          if (f === field && h !== header) next[h] = 'notes'
        }
      }
      next[header] = field
      return next
    })
  }

  // Drag from field tray onto column header
  function handleLensDragStart(fieldKey: string) { setDragging(fieldKey) }
  function handleColumnDragOver(e: React.DragEvent, col: string) { e.preventDefault(); setDragOver(col) }
  function handleColumnDrop(e: React.DragEvent, col: string) {
    e.preventDefault()
    if (dragging) handleMappingChange(col, dragging as AppFieldKey)
    setDragging(null)
    setDragOver(null)
  }

  const canImport = parsed && mapping[parsed.headers.find((h) => mapping[h] === 'company') ?? ''] === 'company'
    && mapping[parsed.headers.find((h) => mapping[h] === 'title') ?? ''] === 'title'

  async function handleImport() {
    if (!parsed) return
    if (!userId) {
      // Persist and redirect to auth
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ parsed, mapping }))
      navigate('/auth')
      return
    }
    playThud(false)
    setStep('importing')
    const r = await runImport(parsed.rows, parsed.headers, mapping, userId)
    setResult(r)
    setStep('done')
  }

  const preview = parsed?.rows.slice(0, PREVIEW_ROWS) ?? []

  return (
    <div className="h-full overflow-y-auto bg-bg font-pixel text-primary p-8">
      <div className="max-w-5xl mx-auto">

        {/* ── Header ── */}
        <div className="mb-8">
          <p className="text-[9px] text-secondary tracking-widest mb-1">DATA → IMPORT</p>
          <h1 className="text-xl text-primary">IMPORT JOBS</h1>
          <p className="text-[10px] text-muted mt-2">
            Upload any CSV. We'll map your columns automatically — you adjust, then import.
          </p>
          <p className="text-[10px] text-warning mt-1">XP is not awarded for imported entries.</p>
        </div>

        {/* ── Step indicator ── */}
        <div className="flex items-center gap-3 mb-10">
          {(['upload', 'map', 'done'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`flex items-center gap-2 text-[9px] tracking-widest ${
                step === s ? 'text-primary' : (step === 'done' || (step === 'map' && s === 'upload') || (step === 'importing' && s !== 'done')) ? 'text-secondary' : 'text-muted'
              }`}>
                <span className={`w-5 h-5 flex items-center justify-center border ${
                  step === s ? 'border-primary text-primary' : 'border-muted text-muted'
                }`}>{i + 1}</span>
                {s === 'upload' ? 'UPLOAD' : s === 'map' ? 'MAP COLUMNS' : 'DONE'}
              </div>
              {i < 2 && <span className="text-muted text-[9px]">›</span>}
            </div>
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => { playLinkBlip(); fileRef.current?.click() }}
            className="border-2 border-dashed border-border hover:border-secondary transition-colors cursor-pointer flex flex-col items-center justify-center gap-4 py-20 px-8 text-center"
          >
            <p className="text-4xl text-border">↑</p>
            <p className="text-xs text-primary">DROP A CSV FILE HERE</p>
            <p className="text-[9px] text-muted">or click to browse — any format works</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFilePick} />
          </div>
        )}

        {/* ── Step 2: Map columns ── */}
        {(step === 'map' || step === 'importing') && parsed && (
          <div className="flex flex-col gap-6">

            {/* Field tray — draggable lenses */}
            <div>
              <p className="text-[9px] text-muted tracking-widest mb-3">
                {aiLoading ? 'AI MAPPING YOUR COLUMNS…' : 'DRAG FIELDS ONTO COLUMNS · OR USE DROPDOWNS'}
              </p>
              <div className="flex flex-wrap gap-2">
                {APP_FIELDS.map((f) => {
                  const isMapped = Object.values(mapping).includes(f.key)
                  return (
                    <div
                      key={f.key}
                      draggable
                      onDragStart={() => handleLensDragStart(f.key)}
                      className={`px-3 py-1.5 text-[9px] tracking-widest border cursor-grab select-none transition-none ${
                        f.required
                          ? isMapped
                            ? 'border-secondary text-secondary'
                            : 'border-primary text-primary'
                          : isMapped
                            ? 'border-border text-muted'
                            : 'border-muted text-muted hover:border-secondary hover:text-secondary'
                      }`}
                    >
                      {f.label}{f.required ? '*' : ''}
                    </div>
                  )
                })}
              </div>
              {(!Object.values(mapping).includes('company') || !Object.values(mapping).includes('title')) && !aiLoading && (
                <p className="text-[9px] text-primary mt-2">
                  COMPANY* and TITLE* must be mapped before importing.
                </p>
              )}
            </div>

            {/* Sheet preview with column headers as drop targets */}
            <div className="overflow-x-auto border border-border">
              <table className="border-collapse text-xs w-full min-w-max">
                <thead>
                  {/* Lens row — drop targets + dropdowns */}
                  <tr className="border-b-2 border-primary bg-surface">
                    {parsed.headers.map((h) => {
                      const mapped = mapping[h] ?? 'notes'
                      const fieldMeta = APP_FIELDS.find((f) => f.key === mapped)
                      return (
                        <td
                          key={h}
                          onDragOver={(e) => handleColumnDragOver(e, h)}
                          onDrop={(e) => handleColumnDrop(e, h)}
                          className={`px-3 py-2 min-w-[120px] transition-colors ${dragOver === h ? 'bg-secondary/10' : ''}`}
                        >
                          <select
                            value={mapped}
                            onChange={(e) => handleMappingChange(h, e.target.value as AppFieldKey)}
                            className={`w-full bg-transparent font-pixel text-[9px] tracking-widest outline-none border-b pb-1 cursor-pointer ${
                              fieldMeta?.required
                                ? 'border-primary text-primary'
                                : mapped === 'skip'
                                  ? 'border-muted text-muted'
                                  : 'border-secondary text-secondary'
                            }`}
                          >
                            {APP_FIELDS.map((f) => (
                              <option key={f.key} value={f.key}>{f.label}{f.required ? '*' : ''}</option>
                            ))}
                            <option value="notes">NOTES (catch-all)</option>
                            <option value="skip">SKIP</option>
                          </select>
                        </td>
                      )
                    })}
                  </tr>

                  {/* Original column names */}
                  <tr className="border-b border-border">
                    {parsed.headers.map((h) => (
                      <th key={h} className="px-3 py-1.5 text-[9px] text-muted font-normal text-left tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {preview.map((row, ri) => (
                    <tr key={ri} className="border-b border-border hover:bg-surface transition-none">
                      {parsed.headers.map((h, ci) => {
                        const mapped = mapping[h] ?? 'notes'
                        const raw = row[ci] ?? ''
                        const formatted = mapped !== 'skip' ? formatPreview(raw, mapped) : '—'
                        return (
                          <td key={h} className={`px-3 py-2 text-[10px] max-w-[180px] truncate ${
                            mapped === 'skip'     ? 'text-muted opacity-30'
                            : mapped === 'notes'  ? 'text-muted'
                            : formatted.includes('⚠') ? 'text-warning'
                            : 'text-primary'
                          }`}>
                            {formatted}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[9px] text-muted">
                {parsed.rows.length} ROW{parsed.rows.length !== 1 ? 'S' : ''} DETECTED · SHOWING {Math.min(PREVIEW_ROWS, parsed.rows.length)}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setParsed(null); setMapping({}); setStep('upload') }}
                  className="text-[10px] px-4 py-2 border border-muted text-muted hover:border-secondary hover:text-secondary transition-none"
                >
                  ← BACK
                </button>
                <button
                  onClick={handleImport}
                  disabled={!canImport || step === 'importing'}
                  className="text-[10px] px-6 py-2 border border-primary text-primary hover:bg-primary hover:text-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {step === 'importing'
                    ? 'IMPORTING…'
                    : userId
                      ? `IMPORT ${parsed.rows.length} ROW${parsed.rows.length !== 1 ? 'S' : ''}`
                      : 'SIGN IN TO IMPORT →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {step === 'done' && result && (
          <div className="flex flex-col gap-6 max-w-md">
            <div className="border border-border px-6 py-5 flex flex-col gap-3">
              <p className="text-[9px] text-secondary tracking-widest">IMPORT COMPLETE</p>
              <p className="text-sm text-primary">{result.imported} job{result.imported !== 1 ? 's' : ''} imported</p>
              {result.skipped > 0 && (
                <p className="text-[10px] text-muted">{result.skipped} row{result.skipped !== 1 ? 's' : ''} skipped (missing company or title)</p>
              )}
              {result.errors.map((e, i) => (
                <p key={i} className="text-[10px] text-warning">{e}</p>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { playLinkBlip(); navigate('/jobs') }}
                className="text-[10px] px-6 py-2 border border-primary text-primary hover:bg-primary hover:text-bg transition-colors"
              >
                VIEW JOB LOG →
              </button>
              <button
                onClick={() => { setParsed(null); setMapping({}); setResult(null); setStep('upload') }}
                className="text-[10px] px-4 py-2 border border-muted text-muted hover:border-secondary hover:text-secondary transition-none"
              >
                IMPORT ANOTHER
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
