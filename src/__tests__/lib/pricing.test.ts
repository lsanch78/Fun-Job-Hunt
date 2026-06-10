import { weeklyToMonthlyIncome } from '@/lib/pricing'
import { PRO_PRICE_WEEKLY } from '@/config/pricing'

describe('weeklyToMonthlyIncome', () => {
  it('annualizes weekly price by 52/12', () => {
    expect(weeklyToMonthlyIncome(1, PRO_PRICE_WEEKLY)).toBeCloseTo(8 * 52 / 12, 6)
    expect(weeklyToMonthlyIncome(10, PRO_PRICE_WEEKLY)).toBeCloseTo(10 * 8 * 52 / 12, 6)
  })

  it('returns 0 for zero subscribers', () => {
    expect(weeklyToMonthlyIncome(0, PRO_PRICE_WEEKLY)).toBe(0)
  })
})
