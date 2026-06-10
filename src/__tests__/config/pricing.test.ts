import { PRO_PRICE_WEEKLY, PRO_PRICE_MONTHLY, PRO_UPGRADE_CTA, PRO_UPGRADE_CTA_SHORT } from '@/config/pricing'

describe('pricing copy', () => {
  it('uses weekly pricing language in upgrade CTAs', () => {
    expect(PRO_PRICE_WEEKLY).toBe(8)
    expect(PRO_PRICE_MONTHLY).toBeCloseTo(34.67, 2)
    expect(PRO_UPGRADE_CTA).toBe('UPGRADE — $8/week')
    expect(PRO_UPGRADE_CTA_SHORT).toBe('UPGRADE — $8/wk')
  })
})
