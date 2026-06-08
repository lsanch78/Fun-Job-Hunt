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
  { feature: 'Network',       free: 'Up to 8 contacts',  pro: '∞ contacts' },
  { feature: 'AI Assistant',  free: 'Unlock up to 30 requests/month',           pro: 'Unlimited' },
  { feature: 'Cover Letter Exports',       free: '✗',                 pro: 'PDF + Docx Downloads' },
  { feature: 'Story Mode',    free: '✓',                 pro: '✓' },
  { feature: 'Time Tracking', free: '✓',                 pro: '✓' },
  { feature: 'Stats',         free: '✓',                 pro: '✓' },
  { feature: 'Journal',       free: '✓',                 pro: '✓' },
  { feature: 'Themes',        free: 'Classic Terminal',  pro: 'All 5 themes + custom editor' },
  { feature: 'BYOK',          free: '✓',                 pro: '✓' },
  { feature: 'No AI mode',    free: '✓',                 pro: '✓' },
]
