import { useRef, useEffect, useState } from 'react'
import CVRenderer from './CVRenderer'
import GlitchOverlay from './GlitchOverlay'
import CanvasShell from '@/components/canvas/CanvasShell'
import { T } from '@/lib/crtTheme'
import { P, CV_FONT } from '@/lib/CVCardTheme'
import { playCloseBlip, playAiDing } from '@/lib/sfx'
import type { CVContent, ContentChangeEvent, CVRendererHandle } from '@/types'
import type { TailorResult } from '@/hooks/cv/useTailoring'
import AiButton from '@/components/ai/AiButton'

interface Props {
  tailorPhase: 'idle' | 'thinking' | 'error'
  tailorResult: TailorResult | null
  tailoredContent: CVContent | null
  tailoredOrder: string[]
  savePhase: 'idle' | 'saving' | 'saved' | 'error'
  quickWinsPhase: 'idle' | 'thinking' | 'error'
  scanOpen: boolean
  panelRect: { left: number; width: number; top: number; height: number } | null
  overflowLines: number
  liveMatchScore: number
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClose: () => void
  onScanToggle: (next: boolean) => void
  onQuickWins: () => void
  onPrint: (paper: HTMLElement | null) => void
  onOverflowChange: (lines: number) => void
  onOrderChange: (order: string[]) => void
  onPanelRectChange: (rect: { left: number; width: number; top: number; height: number } | null) => void
  onContentChange: (content: CVContent) => void
}

export default function TailoringResultPanel({
  tailorPhase,
  tailorResult,
  tailoredContent,
  tailoredOrder,
  savePhase,
  quickWinsPhase,
  scanOpen,
  panelRect,
  overflowLines,
  liveMatchScore,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClose,
  onScanToggle,
  onQuickWins,
  onPrint,
  onOverflowChange,
  onOrderChange,
  onPanelRectChange,
  onContentChange,
}: Props) {
  const rendererRef = useRef<CVRendererHandle>(null)
  const prevQuickWinsPhase = useRef(quickWinsPhase)
  const [quickWinsDots, setQuickWinsDots] = useState(0)

  useEffect(() => {
    if (quickWinsPhase !== 'thinking') return
    const id = setInterval(() => setQuickWinsDots((d) => (d + 1) % 3), 500)
    return () => clearInterval(id)
  }, [quickWinsPhase])

  useEffect(() => {
    if (prevQuickWinsPhase.current === 'thinking' && quickWinsPhase === 'idle') {
      requestAnimationFrame(playAiDing)
    }
    prevQuickWinsPhase.current = quickWinsPhase
  }, [quickWinsPhase])

  // Keep panelRect in sync with the paper element when scan is open
  const updatePanelRect = () => {
    const paper = rendererRef.current?.getPaperElement()
    if (!paper) return
    const r = paper.getBoundingClientRect()
    onPanelRectChange({ left: r.left, width: r.width, top: r.top, height: r.height })
  }

  if (tailorPhase === 'thinking') {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div className="crt-glitch-wrap" style={{ position: 'relative', width: 816, maxWidth: '90%', aspectRatio: '816/1056', border: `1px solid ${T.border}`, overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, background: '#fff' }} />
          <GlitchOverlay width={816} height={1056} words={[]} />
        </div>
        <div style={{ marginTop: 24, fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.2em', color: T.green }}>
          TAILORING RESUME<span className="crt-blink">…</span>
        </div>
        <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.12em', color: T.greenDim }}>
          HAIKU IS MATCHING YOUR BULLETS TO THE JOB DESCRIPTION
        </div>
      </div>
    )
  }

  if (!tailorResult) return null

  const total = tailorResult.matchedKeywords.length
  const score = total > 0 ? Math.round((liveMatchScore / total) * 100) : 0
  const scoreColor = score >= 70 ? '#059669' : score >= 40 ? '#d97706' : '#ef4444'

  const allText = tailoredContent ? [
    ...tailoredContent.experiences.flatMap((e) => e.bullets),
    ...tailoredContent.projects.flatMap((p) => p.bullets),
    ...(tailoredContent.skills ? [...tailoredContent.skills.evergreen, ...tailoredContent.skills.modular.flatMap((g) => g.skills)] : []),
    ...tailoredContent.summaries.map((s) => s.text),
  ].join(' ').toLowerCase() : ''

  return (
    <CanvasShell
      title="TAILORED VIEW"
      headerRight={<>
        {overflowLines > 0 && (
          <div style={{ fontFamily: CV_FONT.family, fontSize: 12, textAlign: 'right', color: '#ef4444' }}>
            <div>⚠ Page overflow</div>
            <div style={{ fontSize: 11, marginTop: 2, color: '#fca5a5' }}>Shorten by ~{overflowLines} line{overflowLines !== 1 ? 's' : ''}</div>
          </div>
        )}
        <div style={{ fontFamily: CV_FONT.family, fontSize: 12, textAlign: 'right', color: P.textMuted }}>
          Keyword match{' '}
          <span style={{ fontSize: 22, color: scoreColor, fontWeight: 'bold' }}>{score}</span>
          <span style={{ fontSize: 13 }}>%</span>
        </div>
      </>}
      headerExtra={<>
        <div style={{ fontFamily: CV_FONT.family, fontSize: 12, color: P.textMuted, marginBottom: 10 }}>
          {liveMatchScore}/{total} keywords matched
        </div>
        {total > 0 && tailoredContent && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tailorResult.matchedKeywords.map((kw) => {
              const hit = allText.includes(kw.toLowerCase())
              return (
                <span key={kw} style={{ fontFamily: CV_FONT.family, fontSize: 11, color: hit ? '#059669' : '#ef4444', background: hit ? '#f0fdf4' : '#fef2f2', border: `1px solid ${hit ? '#bbf7d0' : '#fecaca'}`, borderRadius: 3, padding: '1px 7px' }}>
                  {kw}
                </span>
              )
            })}
          </div>
        )}
      </>}
      footer={<>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{ fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em', color: canUndo ? P.textMuted : P.border, background: 'none', border: `1px solid ${canUndo ? P.border : P.border + '55'}`, borderRadius: 3, padding: '7px 16px', cursor: canUndo ? 'pointer' : 'default' }}
          onMouseEnter={(e) => { if (canUndo) { (e.currentTarget as HTMLElement).style.color = P.text; (e.currentTarget as HTMLElement).style.borderColor = P.textMuted } }}
          onMouseLeave={(e) => { if (canUndo) { (e.currentTarget as HTMLElement).style.color = P.textMuted; (e.currentTarget as HTMLElement).style.borderColor = P.border } }}
        >
          Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          style={{ fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em', color: canRedo ? P.textMuted : P.border, background: 'none', border: `1px solid ${canRedo ? P.border : P.border + '55'}`, borderRadius: 3, padding: '7px 16px', cursor: canRedo ? 'pointer' : 'default' }}
          onMouseEnter={(e) => { if (canRedo) { (e.currentTarget as HTMLElement).style.color = P.text; (e.currentTarget as HTMLElement).style.borderColor = P.textMuted } }}
          onMouseLeave={(e) => { if (canRedo) { (e.currentTarget as HTMLElement).style.color = P.textMuted; (e.currentTarget as HTMLElement).style.borderColor = P.border } }}
        >
          Redo
        </button>
        <button
          onClick={() => { playCloseBlip(); onClose() }}
          style={{ fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em', color: P.textMuted, background: 'none', border: `1px solid ${P.border}`, borderRadius: 3, padding: '7px 20px', cursor: 'pointer' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.borderColor = '#ef4444' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = P.textMuted; (e.currentTarget as HTMLElement).style.borderColor = P.border }}
        >
          Close
        </button>
        <button
          onClick={() => { const next = !scanOpen; localStorage.setItem('cv-scan-open', String(next)); onScanToggle(next); if (next) updatePanelRect() }}
          style={{
            fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em', padding: '7px 20px', cursor: 'pointer',
            color: scanOpen ? P.text : P.textMuted,
            border: `1px solid ${scanOpen ? P.textMuted : P.border}`,
            borderRadius: 3, background: 'none',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = P.text; (e.currentTarget as HTMLElement).style.borderColor = P.textMuted }}
          onMouseLeave={(e) => { if (!scanOpen) { (e.currentTarget as HTMLElement).style.color = P.textMuted; (e.currentTarget as HTMLElement).style.borderColor = P.border } }}
        >
          6-Sec Scan
        </button>
        <AiButton
          label={quickWinsPhase === 'error' ? 'ERROR' : 'Quick Wins'}
          phase={quickWinsPhase === 'thinking' ? 'generating' : 'idle'}
          dots={quickWinsDots}
          onClick={onQuickWins}
          disabled={quickWinsPhase === 'thinking'}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          labelStyle={{ fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em', padding: '7px 20px', lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}
        />
        <button
          onClick={() => onPrint(rendererRef.current?.getPaperElement() ?? null)}
          style={{ fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em', color: P.textMuted, background: 'none', border: `1px solid ${P.border}`, borderRadius: 3, padding: '7px 20px', cursor: 'pointer' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = P.text; (e.currentTarget as HTMLElement).style.borderColor = P.textMuted }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = P.textMuted; (e.currentTarget as HTMLElement).style.borderColor = P.border }}
        >
          Download PDF
        </button>
        {savePhase === 'saving' && <span style={{ fontFamily: CV_FONT.family, fontSize: 12, color: P.textMuted }}>Saving…</span>}
        {savePhase === 'saved'  && <span style={{ fontFamily: CV_FONT.family, fontSize: 12, color: '#059669' }}>Saved ✓</span>}
        {savePhase === 'error'  && <span style={{ fontFamily: CV_FONT.family, fontSize: 12, color: '#ef4444' }}>Save failed</span>}
      </>}
    >
      {scanOpen && panelRect && (
        <div style={{ position: 'fixed', zIndex: 60, pointerEvents: 'none', top: panelRect.top, left: panelRect.left, width: panelRect.width, height: panelRect.height ?? '100vh' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '38%', border: `2px solid ${T.green}55`, boxSizing: 'border-box' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.85) 100%)' }} />
            <div style={{ position: 'absolute', top: 6, right: 10, fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.15em', color: T.green, opacity: 0.7 }}>
              6-SEC SCAN ZONE
            </div>
          </div>
          <div style={{ position: 'absolute', top: '38%', left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)' }} />
        </div>
      )}
      {tailoredContent && (
        <CVRenderer
          ref={rendererRef}
          content={tailoredContent}
          sectionOrder={tailoredOrder}
          keywords={tailorResult.matchedKeywords}
          onOverflowChange={onOverflowChange}
          onOrderChange={onOrderChange}
          onChange={(evt: ContentChangeEvent) => {
            onContentChange((() => {
              const prev = tailoredContent
              if (evt.type === 'mainInfo')      return { ...prev, mainInfo: { ...prev.mainInfo, ...evt.data } }
              if (evt.type === 'summary')       return { ...prev, summaries:      prev.summaries.map((s) => s.id === evt.id ? { ...s, ...evt.data } : s) }
              if (evt.type === 'experience')    return { ...prev, experiences:    prev.experiences.map((e) => e.id === evt.id ? { ...e, ...evt.data } : e) }
              if (evt.type === 'education')     return { ...prev, educations:     prev.educations.map((e) => e.id === evt.id ? { ...e, ...evt.data } : e) }
              if (evt.type === 'project')       return { ...prev, projects:       prev.projects.map((p) => p.id === evt.id ? { ...p, ...evt.data } : p) }
              if (evt.type === 'certification') return { ...prev, certifications: prev.certifications.map((c) => c.id === evt.id ? { ...c, ...evt.data } : c) }
              if (evt.type === 'award')         return { ...prev, awards:         prev.awards.map((a) => a.id === evt.id ? { ...a, ...evt.data } : a) }
              if (evt.type === 'skills')        return { ...prev, skills: prev.skills ? { ...prev.skills, ...evt.data } : null }
              return prev
            })())
          }}
        />
      )}
    </CanvasShell>
  )
}
