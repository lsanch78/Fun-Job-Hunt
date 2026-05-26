import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import mammoth from 'mammoth'
import { isSfxMuted } from '@/lib/sfx'

function playBookThud() {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    // Low thud body — square wave dropping fast
    const osc = ctx.createOscillator()
    const oscGain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(120, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.12)
    oscGain.gain.setValueAtTime(0.12, ctx.currentTime)
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
    osc.connect(oscGain)
    oscGain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.2)
    // Noise burst layered on top for the slap texture
    const bufSize = Math.ceil(ctx.sampleRate * 0.08)
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) nd[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf
    const lpf = ctx.createBiquadFilter()
    lpf.type = 'lowpass'
    lpf.frequency.value = 600
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.15, ctx.currentTime)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    src.connect(lpf)
    lpf.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    src.start(ctx.currentTime)
  } catch { /* AudioContext blocked */ }
}

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
      .then((result) => { if (!cancelled) setDocxHtml(result.value) })
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
        <div className="flex-1 overflow-auto bg-white text-black p-8">
          {docxError ? (
            <p className="font-pixel text-[10px] text-muted">Failed to load DOCX preview.</p>
          ) : docxHtml === null ? (
            <p className="font-pixel text-[10px] text-muted">Loading preview...</p>
          ) : (
            <div
              className="max-w-3xl mx-auto prose prose-sm"
              dangerouslySetInnerHTML={{ __html: docxHtml }}
            />
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
