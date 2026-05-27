// ── Workday localStorage key registry ────────────────────────────────────────
//
// Single source of truth for all workday-related localStorage keys.
// Import from here — never hard-code these strings elsewhere.

export const WORKDAY_KEYS = {
  /** ISO timestamp of the active punch-in */
  punchIn:   'workday_punch_in',
  /** UUID of the active workday DB row (or 'pending' while the insert is in flight) */
  workdayId: 'workday_id',
} as const
