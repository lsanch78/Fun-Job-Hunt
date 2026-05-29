import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'

export const COMM_COOLDOWN_OPTIONS = [
  { label: 'Daily',        hours: 24  },
  { label: 'Every 3 days', hours: 72  },
  { label: 'Weekly',       hours: 168 },
  { label: 'Bi-weekly',    hours: 336 },
] as const

export type CommCooldownHours = typeof COMM_COOLDOWN_OPTIONS[number]['hours']

export function getCommCooldownHours(userId: string): CommCooldownHours {
  const parsed = lsGet<number>(SK.commCooldown(userId), 168)
  if (COMM_COOLDOWN_OPTIONS.some((o) => o.hours === parsed)) return parsed as CommCooldownHours
  return 168
}

export function setCommCooldownHours(userId: string, hours: CommCooldownHours): void {
  lsSet(SK.commCooldown(userId), hours)
}

export function commCooldownRemaining(lastCommAt: string | null, cooldownHours: number): number {
  if (!lastCommAt) return 0
  const elapsed = (Date.now() - new Date(lastCommAt).getTime()) / 3_600_000
  return Math.max(0, cooldownHours - elapsed)
}

export function formatCooldown(hoursRemaining: number): string {
  if (hoursRemaining <= 0) return ''
  const h = Math.floor(hoursRemaining)
  const m = Math.floor((hoursRemaining - h) * 60)
  if (h >= 24) {
    const d = Math.floor(h / 24)
    const rh = h % 24
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`
  }
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
