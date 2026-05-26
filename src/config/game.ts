// --- XP VALUES ---
// All tunable here. Change these without touching any other file.
export const XP = {
  PUNCH_IN: 10,
  ADD_JOB: 20,
  JOB_STATUS_UPGRADE: 50,
  UNLOCK_ACHIEVEMENT: 100,
  STREAK_7_DAY: 200,
  FIRST_OFFER: 500,
} as const

// --- RANK THRESHOLDS ---
// Index = rank number (1-based). Index 0 unused.
// Rank 11 (Employed) is triggered by manual toggle, not XP.
export const RANK_THRESHOLDS: number[] = [
  0,     // unused
  0,     // Rank 1
  100,   // Rank 2
  250,   // Rank 3
  500,   // Rank 4
  900,   // Rank 5
  1400,  // Rank 6
  2000,  // Rank 7
  2700,  // Rank 8
  3500,  // Rank 9
  4500,  // Rank 10
  6000,  // Rank 11 (XP gate ignored — manual toggle only)
]

export const RANK_TITLES: string[] = [
  '',                          // unused
  'Destitute Job Seeker',
  'Soulless Interview Preparer',
  'LinkedIn Serf',
  'Forgotten Follow Upper',
  'First Round Peasant',
  'Resume Goblin',
  'Second Round Warden',
  'Interview Ghost',
  'Third Round Lord',
  'Final King',
  'Employed',
]

// --- WORKDAY ---
export const WORKDAY = {
  DEFAULT_SHIFT_HOURS: 8,
  AUTO_PUNCH_OUT_IDLE_MS: 15 * 60 * 1000, // 15 minutes
} as const

// Derived break time in minutes based on shift length
export function derivedBreakMinutes(shiftHours: number): number {
  if (shiftHours < 4) return 0
  if (shiftHours < 6) return 15
  if (shiftHours < 8) return 30 + 15 // 2x15 + 30 lunch
  return 30 + 60 // 2x15 + 60 lunch
}

// --- STREAKS ---
export const STREAK = {
  GRACE_DAYS_PER_WEEK: 1,
} as const

// --- THEMES ---
export const THEMES = ['terminal', 'nes', 'gameboy', 'arcade'] as const
export type Theme = typeof THEMES[number]
