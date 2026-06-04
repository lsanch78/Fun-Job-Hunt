// Parses salary input and returns a clean value to store (in K).
//
// Accepted formats:
//   "28/hr" | "$28/hr" | "28$/hr"  → annualise (* 2080 / 1000), stored as decimal K string
//   "64.3"  | "64.3K" | "$64.3"   → stored as-is (decimal K preserved)
//   "120"                          → stored as-is
//
// Returns empty string for blank/unparseable input.
export function parseSalaryK(raw: string): string {
  const s = raw.trim()
  if (!s) return ''

  // Hourly: "28/hr", "$28/hr", "28$/hr"
  const hourly = s.match(/^\$?(\d+(?:\.\d+)?)\$?\s*\/?\s*hr$/i)
  if (hourly) {
    const annual = parseFloat(hourly[1]) * 2080 / 1000
    // Round to 1 decimal place, drop trailing .0
    const rounded = Math.round(annual * 10) / 10
    return rounded % 1 === 0 ? String(Math.round(rounded)) : String(rounded)
  }

  // Plain number or K-suffixed: strip leading $ and trailing K, keep digits + dot
  const num = parseFloat(s.replace(/^\$/, '').replace(/k$/i, ''))
  if (!isNaN(num)) return String(num)

  return ''
}
