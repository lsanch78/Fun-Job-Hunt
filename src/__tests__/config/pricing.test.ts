import { PRO_PRICE_WEEKLY, PRO_UPGRADE_CTA, PRO_UPGRADE_CTA_SHORT } from '@/config/pricing'

describe('Pro pricing constants', () => {
  it('PRO_PRICE_WEEKLY is 8', () => {
    expect(PRO_PRICE_WEEKLY).toBe(8)
  })

  it('PRO_UPGRADE_CTA uses weekly copy', () => {
    expect(PRO_UPGRADE_CTA).toBe('UPGRADE — $8/week')
  })

  it('PRO_UPGRADE_CTA_SHORT uses weekly copy', () => {
    expect(PRO_UPGRADE_CTA_SHORT).toBe('UPGRADE — $8/wk')
  })
})
