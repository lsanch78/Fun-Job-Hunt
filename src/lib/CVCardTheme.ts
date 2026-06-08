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

// Field label
export const labelStyle = {
  fontFamily:    CV_FONT.family,
  fontSize:      CV_FONT.label,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color:         P.textMuted,
  marginBottom:  2,
} as const

// Input element
export const inputStyle = {
  fontFamily:   CV_FONT.family,
  fontSize:     CV_FONT.body,
  color:        P.text,
  background:   '#f9fafb',
  border:       `1px solid ${P.border}`,
  borderRadius: 3,
  outline:      'none',
  width:        '100%',
  padding:      '2px 6px 3px',
} as const

// Textarea element
export const textareaStyle = { ...inputStyle, resize: 'none' } as const

// Bullet glyph (•)
export const bulletGlyphStyle = {
  color:      P.textMuted,
  fontSize:   CV_FONT.body,
  lineHeight: 1.5,
  flexShrink: 0,
} as const

// Remove-bullet (✕) button
export const removeBtnStyle = {
  background: 'none',
  border:     'none',
  cursor:     'pointer',
  fontSize:   '11px',
  color:      P.textMuted,
  flexShrink: 0,
  lineHeight: 1.5,
} as const
export const removeBtnHoverStyle = { color: P.danger } as const

// Add bullet / add group button
export const addBtnStyle = {
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
} as const
export const addBtnHoverStyle = { color: P.text, borderColor: P.textMuted } as const

