import type { CSSProperties } from 'react'

// Paper palette — matches CVRenderer's document aesthetic
export const P = {
  bg:        '#ffffff',
  pageBg:    'transparent',
  text:      '#111827',
  textMuted: '#6b7280',
  border:    '#e5e7eb',
  rule:      '#111827',
  danger:    '#ef4444',
}

// Font scale — matches CVRenderer (Carlito / Calibri)
export const CV_FONT = {
  family:  "'Carlito', 'Calibri', sans-serif",
  label:   '12px',
  body:    '15px',
  section: '14pt',
}

// Section header — replicates CVRenderer section divider exactly
export const sectionHeaderStyle: CSSProperties = {
  fontFamily:   CV_FONT.family,
  fontSize:     CV_FONT.section,
  fontVariant:  'small-caps',
  letterSpacing: '0.03em',
  fontWeight:   'normal',
  color:        P.text,
  paddingBottom: 2,
  marginBottom:  4,
  borderBottom:  `0.5pt solid ${P.rule}`,
  userSelect:   'none',
}

// Field label
export const labelStyle: CSSProperties = {
  fontFamily:    CV_FONT.family,
  fontSize:      CV_FONT.label,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color:         P.textMuted,
  marginBottom:  2,
}

// Input element
export const inputStyle: CSSProperties = {
  fontFamily:   CV_FONT.family,
  fontSize:     CV_FONT.body,
  color:        P.text,
  background:   '#f9fafb',
  border:       `1px solid ${P.border}`,
  borderRadius: 3,
  outline:      'none',
  width:        '100%',
  padding:      '2px 6px 3px',
}

// Textarea element
export const textareaStyle: CSSProperties = { ...inputStyle, resize: 'none' }

// Bullet glyph (•)
export const bulletGlyphStyle: CSSProperties = {
  color:      P.textMuted,
  fontSize:   CV_FONT.body,
  lineHeight: 1.5,
  flexShrink: 0,
}

// Remove-bullet (✕) button
export const removeBtnStyle: CSSProperties = {
  background: 'none',
  border:     'none',
  cursor:     'pointer',
  fontSize:   '11px',
  color:      P.textMuted,
  flexShrink: 0,
  lineHeight: 1.5,
}
export const removeBtnHoverStyle: CSSProperties = { color: P.danger }

// Add bullet / add group button
export const addBtnStyle: CSSProperties = {
  background:    P.bg,
  border:        `1px solid ${P.border}`,
  borderRadius:  3,
  cursor:        'pointer',
  fontSize:      CV_FONT.body,
  color:         P.textMuted,
  padding:       '5px 14px',
  marginTop:     8,
  fontFamily:    CV_FONT.family,
  letterSpacing: '0.03em',
  fontVariant:   'small-caps',
  alignSelf:     'flex-end',
}
export const addBtnHoverStyle: CSSProperties = { color: P.text, borderColor: P.textMuted }

// Legacy aliases — kept so existing card imports don't break during transition
export const addBulletBtnStyle     = addBtnStyle
export const addBulletBtnHoverStyle = addBtnHoverStyle
