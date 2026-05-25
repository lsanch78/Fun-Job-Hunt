import { useEffect, useRef, type ChangeEvent } from 'react'

function playBookThud() {
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
  onClose: () => void
  onReplace: (file: File) => void
  replacing?: boolean
}

export default function ResumeModal({ url, fileName, onClose, onReplace, replacing }: ResumeModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      <div className="bg-surface border-b border-border px-4 h-10 flex items-center justify-between shrink-0">
        <span className="font-pixel text-[9px] text-primary tracking-widest">
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
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={replacing}
            className="font-pixel text-[9px] border border-border text-muted px-3 py-1 hover:border-secondary hover:text-secondary transition-none disabled:opacity-40 disabled:cursor-not-allowed"
            title="Replace resume PDF"
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

      {/* PDF embed */}
      <embed
        src={url}
        type="application/pdf"
        className="flex-1 w-full"
      />
    </div>
  )
}
