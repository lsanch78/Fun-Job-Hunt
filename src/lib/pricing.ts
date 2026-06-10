const WEEKS_PER_YEAR = 52
const MONTHS_PER_YEAR = 12

export function weeklyToMonthlyIncome(activeSubscribers: number, weeklyPrice: number): number {
  return activeSubscribers * weeklyPrice * (WEEKS_PER_YEAR / MONTHS_PER_YEAR)
}
