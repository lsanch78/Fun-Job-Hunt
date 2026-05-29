export { SK as WORKDAY_KEYS_SK } from '@/lib/storageKeys'
import { SK } from '@/lib/storageKeys'

// Kept for backward compatibility — prefer SK from storageKeys directly.
export const WORKDAY_KEYS = {
  punchIn:   SK.workdayPunchIn,
  workdayId: SK.workdayId,
} as const
