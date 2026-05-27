import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import mammoth from 'mammoth'
import DOMPurify from 'dompurify'
import { playBookThud } from '@/lib/sfx'

interface ResumeModalProps {
  url: string
  fileName: string
  slotColor?: string
  onClose: () => void
  onReplace: (file: File) => void
  replacing?: boolean
}

export default function ResumeModal({ url, fileName, slotColor, onClose, onReplace, replacing }: ResumeModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isDocx = url.toLowerCase().includes('.docx')
  const [docxHtml, setDocxHtml] = useState<string | null>(null)
  const [docxError, setDocxError] = useState(false)

  useEffect(() => {
    if (!isDocx) { setDocxHtml(null); return }
    setDocxHtml(null)
    setDocxError(false)
    let cancelled = false
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((buf) => mammoth.convertToHtml({ arrayBuffer: buf }))
      .then((result) => { if (!cancelled) setDocxHtml(DOMPurify.sanitize(result.value)) })
      .catch(() => { if (!cancelled) setDocxError(true) })
    return () => { cancelled = true }
  }, [url, isDocx])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { playBookThud(); onClose() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onReplace(file)
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-bg">

      {/* Header bar */}
      <div
        className="bg-surface border-b border-border px-4 h-10 flex items-center justify-between shrink-0"
        style={slotColor ? { borderBottomColor: slotColor } : undefined}
      >
        <span
          className="font-pixel text-[9px] tracking-widest"
          style={{ color: slotColor ?? 'var(--color-primary)' }}
        >
          RESUME PREVIEW
        </span>
        <div className="flex items-center gap-3">
          <span className="font-pixel text-[9px] text-muted truncate max-w-[40vw]">
            {fileName}
          </span>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={replacing}
            className="font-pixel text-[9px] border border-border text-muted px-3 py-1 hover:border-secondary hover:text-secondary transition-none disabled:opacity-40 disabled:cursor-not-allowed"
            title="Replace resume file"
          >
            {replacing ? '▶ UPLOADING...' : '▶ REPLACE'}
          </button>

          <button
            onClick={() => { playBookThud(); onClose() }}
            className="font-pixel text-[9px] border border-border text-muted px-3 py-1 hover:border-primary hover:text-primary transition-none"
            title="Close (Esc)"
          >
            ✕ CLOSE
          </button>
        </div>
      </div>

      {/* Preview area */}
      {isDocx ? (
        <div className="flex-1 overflow-auto bg-bg text-fg">
          {/* Disclaimer */}
          <div className="bg-yellow-50 border-b border-yellow-300 px-6 py-2 text-center">
            <span className="font-pixel text-[9px] text-yellow-800 tracking-wide">
              Formatting may differ from original Word document — for your quick reference only
            </span>
          </div>

          {docxError ? (
            <p className="font-pixel text-[10px] text-gray-500 p-8">Failed to load DOCX preview.</p>
          ) : docxHtml === null ? (
            <p className="font-pixel text-[10px] text-gray-500 p-8">Loading preview...</p>
          ) : (
            <>
              <style>{`
                .docx-preview {
                  font-family: 'Times New Roman', Times, serif;
                  font-size: 11pt;
                  line-height: 1.4;
                  color: #111;
                }
                .docx-preview h1 { font-size: 18pt; font-weight: bold; margin: 0 0 4px; }
                .docx-preview h2 { font-size: 13pt; font-weight: bold; margin: 14px 0 4px; border-bottom: 1px solid #555; padding-bottom: 2px; text-transform: uppercase; letter-spacing: 0.04em; }
                .docx-preview h3 { font-size: 11pt; font-weight: bold; margin: 10px 0 2px; }
                .docx-preview p  { margin: 2px 0; }
                .docx-preview ul, .docx-preview ol { margin: 2px 0 2px 1.4em; padding: 0; }
                .docx-preview li { margin: 1px 0; }
                .docx-preview table { width: 100%; border-collapse: collapse; margin: 6px 0; }
                .docx-preview td, .docx-preview th { padding: 2px 6px; vertical-align: top; }
                .docx-preview a { color: #1a0dab; }
                .docx-preview strong { font-weight: bold; }
                .docx-preview em { font-style: italic; }
              `}</style>
              <div className="max-w-[850px] mx-auto my-8 bg-white shadow-md px-[1in] py-[0.75in]">
                <div
                  className="docx-preview"
                  dangerouslySetInnerHTML={{ __html: docxHtml }}
                />
              </div>
            </>
          )}
        </div>
      ) : (
        <embed
          src={url}
          type="application/pdf"
          className="flex-1 w-full"
        />
      )}
    </div>
  )
}
