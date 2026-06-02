export const PRO_PRICE_MONTHLY = 8

export const PRO_PRICE_LABEL       = `$${PRO_PRICE_MONTHLY}/month`
export const PRO_PRICE_LABEL_SHORT = `$${PRO_PRICE_MONTHLY}/mo`
export const PRO_UPGRADE_CTA       = `UPGRADE — $${PRO_PRICE_MONTHLY}/month`
export const PRO_UPGRADE_CTA_SHORT = `UPGRADE — $${PRO_PRICE_MONTHLY}/mo`

export interface ProFeatureRow {
  feature: string
  free: string
  pro: string
}

export const PRO_FEATURE_TABLE: ProFeatureRow[] = [
  { feature: 'Job Tracking',  free: '∞ applications',   pro: '∞ applications' },
  { feature: 'Network',       free: 'Up to 30 contacts', pro: '∞ contacts' },
  { feature: 'Story Mode',    free: '✓',                 pro: '✓' },
  { feature: 'Time Tracking', free: '✓',                 pro: '✓' },
  { feature: 'Stats',         free: '✓',                 pro: '✓' },
  { feature: 'Journal',       free: '✓',                 pro: '✓' },
  { feature: 'Themes',        free: 'Classic Terminal',  pro: 'All 5 themes + custom editor' },
  { feature: 'Resume Slots',  free: '1 slot',            pro: '3 slots' },
  { feature: 'AI Assistant',  free: 'Limited',           pro: 'Unlimited' },
  { feature: 'Exports',       free: '✗',                 pro: 'PDF + Word (cover letters)' },
  { feature: 'BYOK',          free: '✓',                 pro: '✓' },
  { feature: 'No AI mode',    free: '✓',                 pro: '✓' },
]
