export const PRO_PRICE_WEEKLY = 8
export const PRO_PRICE_MONTHLY = Math.round((PRO_PRICE_WEEKLY * 52 / 12) * 100) / 100

export const PRO_UPGRADE_CTA       = `UPGRADE — $${PRO_PRICE_WEEKLY}/week`
export const PRO_UPGRADE_CTA_SHORT = `UPGRADE — $${PRO_PRICE_WEEKLY}/wk`

export interface ProFeatureRow {
  feature: string
  free: string
  pro: string
}

export const PRO_FEATURE_TABLE: ProFeatureRow[] = [
  { feature: 'AI Cover Letter Generation', free: '30 requests/month', pro: 'Unlimited' },
  { feature: 'AI Resume Tailoring',        free: '30 requests/month', pro: 'Unlimited' },
  { feature: 'Job Tracking',  free: '∞ applications',   pro: '∞ applications' },
  { feature: 'Network',       free: 'Up to 8 contacts',  pro: '∞ contacts' },
  { feature: 'Cover Letter Exports',    free: 'PDF',               pro: 'PDF' },
  { feature: 'Tailored Resume Exports', free: 'PDF',               pro: 'PDF' },
  { feature: 'Journal',       free: '✓',                 pro: '✓' },
  { feature: 'Themes',        free: 'Classic Terminal',  pro: 'All 5 themes + custom editor' },
  { feature: 'BYOK',          free: '✓',                 pro: '✓' },
  { feature: 'Stats',         free: '✓',                 pro: '✓' },
]
