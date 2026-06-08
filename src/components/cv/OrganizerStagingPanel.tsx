import type { OrgResult } from '@/hooks/cv/useOrganizer'
import { P, CV_FONT } from '@/lib/CVCardTheme'

const SECTION_ACCENT: Record<string, string> = {
  experience: '#f97316', education: '#22c55e', project: '#a855f7',
  skills: '#06b6d4', summary: '#64748b', certification: '#ec4899',
  award: '#eab308', mainInfo: '#3b82f6',
}

const SECTION_TITLE: Record<string, string> = {
  experience: 'EXPERIENCE', education: 'EDUCATION', project: 'PROJECT',
  skills: 'SKILLS', summary: 'SUMMARY', certification: 'CERTIFICATION',
  award: 'AWARD / HONOR', mainInfo: 'MAIN INFO',
}

interface Props {
  result: OrgResult
  acceptedKeys: Set<string>
  acceptedChangesCount: number
  onToggleChange: (changeIdx: number, bullets: string[]) => void
  onToggleBullet: (changeIdx: number, bulletIdx: number) => void
  onAccept: () => void
  onDiscard: () => void
}

export default function OrganizerStagingPanel({
  result,
  acceptedKeys,
  acceptedChangesCount,
  onToggleChange,
  onToggleBullet,
  onAccept,
  onDiscard,
}: Props) {
  return (
    <div className="absolute inset-0" style={{ zIndex: 50, background: 'rgba(255,255,255,0.97)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${P.border}`, padding: '18px 28px 14px', flexShrink: 0 }}>
        <div style={{ fontFamily: CV_FONT.family, fontSize: '14pt', fontVariant: 'small-caps', letterSpacing: '0.03em', color: P.text, marginBottom: 6 }}>
          CV Update Staging
        </div>
        <div style={{ fontFamily: CV_FONT.family, fontSize: 13, color: P.textMuted, lineHeight: 1.6 }}>
          {result.summary}
        </div>
        <div style={{ fontFamily: CV_FONT.family, fontSize: 11, color: P.border, marginTop: 4 }}>
          Toggle items or individual bullets — only checked items will be applied.
        </div>
      </div>

      {/* Change list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {result.changes.length === 0 ? (
          <div style={{ fontFamily: CV_FONT.family, fontSize: 14, color: P.textMuted, padding: '32px 0' }}>
            Nothing new found — everything is already in your CV.
          </div>
        ) : result.changes.map((change, i) => {
          const accepted = acceptedKeys.has(String(i))
          const bullets = ((change.data as Record<string, unknown>).bullets as string[] | undefined) ?? []
          const nonBulletFields = Object.entries(change.data).filter(([k, v]) => {
            if (k === 'bullets') return false
            if (Array.isArray(v)) return (v as unknown[]).length > 0
            if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0
            return v !== '' && v !== null && v !== undefined && !k.startsWith('id')
          })
          const accent = SECTION_ACCENT[change.section] ?? P.rule

          return (
            <div
              key={i}
              style={{ background: P.bg, border: `1px solid ${P.border}`, borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', fontFamily: CV_FONT.family, opacity: accepted ? 1 : 0.5, transition: 'opacity 150ms' }}
            >
              {/* Change header row */}
              <div
                className="flex items-center px-5 pt-4 pb-3 cursor-pointer"
                style={{ borderBottom: `2px solid ${accent}` }}
                onClick={() => onToggleChange(i, bullets)}
              >
                <div style={{ width: 15, height: 15, flexShrink: 0, borderRadius: 2, marginRight: 10, border: `1.5px solid ${accepted ? accent : P.border}`, background: accepted ? accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 150ms, border-color 150ms' }}>
                  {accepted && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                </div>
                <span style={{ fontFamily: CV_FONT.family, fontSize: CV_FONT.section, fontVariant: 'small-caps', letterSpacing: '0.03em', fontWeight: 'normal', color: P.text }}>
                  {SECTION_TITLE[change.section] ?? change.section.toUpperCase()}
                </span>
                <span className="truncate" style={{ fontSize: CV_FONT.body, color: P.textMuted, marginLeft: 8 }}>— {change.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontVariant: 'small-caps', letterSpacing: '0.06em', color: accent, flexShrink: 0 }}>{change.action}</span>
                <span style={{ color: P.textMuted, fontSize: CV_FONT.body, flexShrink: 0, marginLeft: 8 }}>▾</span>
              </div>

              {/* Change body */}
              <div className="flex flex-col gap-4 px-5 py-4">
                {nonBulletFields.length > 0 && (
                  <div className="flex flex-wrap" style={{ gap: '4px 24px' }}>
                    {nonBulletFields.map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontFamily: CV_FONT.family, fontSize: CV_FONT.label, letterSpacing: '0.08em', textTransform: 'uppercase', color: P.textMuted, marginBottom: 2 }}>{k}</div>
                        <div style={{ fontFamily: CV_FONT.family, fontSize: CV_FONT.body, color: P.text }}>{String(v)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {bullets.length > 0 && (
                  <div className="flex flex-col">
                    <div style={{ fontFamily: CV_FONT.family, fontSize: CV_FONT.label, letterSpacing: '0.08em', textTransform: 'uppercase', color: P.textMuted, marginBottom: 6 }}>Bullets</div>
                    <div className="flex flex-col" style={{ gap: 6 }}>
                      {bullets.map((bullet, bi) => {
                        const bulletAccepted = acceptedKeys.has(`${i}.bullet.${bi}`)
                        return (
                          <div
                            key={bi}
                            onClick={(e) => { e.stopPropagation(); onToggleBullet(i, bi) }}
                            className="flex items-start"
                            style={{ gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 3, background: bulletAccepted ? '#f9fafb' : 'transparent', border: `1px solid ${bulletAccepted ? P.border : 'transparent'}`, transition: 'background 150ms' }}
                          >
                            <div style={{ width: 13, height: 13, marginTop: 3, flexShrink: 0, borderRadius: 2, border: `1.5px solid ${bulletAccepted ? accent : P.border}`, background: bulletAccepted ? accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 150ms, border-color 150ms' }}>
                              {bulletAccepted && <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                            </div>
                            <span style={{ color: P.textMuted, fontSize: CV_FONT.body, lineHeight: 1.5, flexShrink: 0 }}>•</span>
                            <span style={{ fontFamily: CV_FONT.family, fontSize: CV_FONT.body, color: P.text, lineHeight: 1.5, opacity: bulletAccepted ? 1 : 0.45 }}>{bullet}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${P.border}`, padding: '14px 28px', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
        <button
          onClick={onDiscard}
          style={{ fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em', color: P.textMuted, background: 'none', border: `1px solid ${P.border}`, borderRadius: 3, padding: '7px 20px', cursor: 'pointer' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.borderColor = '#ef4444' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = P.textMuted; (e.currentTarget as HTMLElement).style.borderColor = P.border }}
        >
          Discard All
        </button>
        <button
          disabled={acceptedChangesCount === 0}
          onClick={onAccept}
          style={{ fontFamily: CV_FONT.family, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '0.03em', color: acceptedChangesCount === 0 ? P.border : P.bg, background: acceptedChangesCount === 0 ? 'transparent' : P.text, border: `1px solid ${acceptedChangesCount === 0 ? P.border : P.text}`, borderRadius: 3, padding: '7px 20px', cursor: acceptedChangesCount === 0 ? 'default' : 'pointer' }}
        >
          Apply{acceptedChangesCount > 0 ? ` (${acceptedChangesCount})` : ''}
        </button>
      </div>
    </div>
  )
}
