import { XP, RANK_THRESHOLDS, RANK_TITLES, WORKDAY, STREAK, THEMES, derivedBreakMinutes } from '@/config/game'

describe('XP constants', () => {
  it('PUNCH_IN is 10', () => expect(XP.PUNCH_IN).toBe(10))
  it('ADD_JOB is 20', () => expect(XP.ADD_JOB).toBe(20))
  it('JOB_STATUS_UPGRADE is 50', () => expect(XP.JOB_STATUS_UPGRADE).toBe(50))
  it('UNLOCK_ACHIEVEMENT is 100', () => expect(XP.UNLOCK_ACHIEVEMENT).toBe(100))
  it('STREAK_7_DAY is 200', () => expect(XP.STREAK_7_DAY).toBe(200))
  it('FIRST_OFFER is 500', () => expect(XP.FIRST_OFFER).toBe(500))
})

describe('RANK_THRESHOLDS', () => {
  it('has 12 entries (index 0 is unused placeholder)', () => {
    expect(RANK_THRESHOLDS).toHaveLength(12)
  })

  it('index 0 is 0 (unused)', () => expect(RANK_THRESHOLDS[0]).toBe(0))
  it('rank 1 threshold is 0 (everyone starts at rank 1)', () => expect(RANK_THRESHOLDS[1]).toBe(0))
  it('rank 2 threshold is 100', () => expect(RANK_THRESHOLDS[2]).toBe(100))
  it('rank 10 threshold is 4500', () => expect(RANK_THRESHOLDS[10]).toBe(4500))
  it('thresholds are non-decreasing', () => {
    for (let i = 2; i < RANK_THRESHOLDS.length; i++) {
      expect(RANK_THRESHOLDS[i]).toBeGreaterThanOrEqual(RANK_THRESHOLDS[i - 1])
    }
  })
})

describe('RANK_TITLES', () => {
  it('has 12 entries (index 0 is unused placeholder)', () => {
    expect(RANK_TITLES).toHaveLength(12)
  })

  it('index 0 is empty string', () => expect(RANK_TITLES[0]).toBe(''))
  it('rank 1 is "Destitute Job Seeker"', () => expect(RANK_TITLES[1]).toBe('Destitute Job Seeker'))
  it('rank 11 is "Employed"', () => expect(RANK_TITLES[11]).toBe('Employed'))
  it('all non-empty titles are non-empty strings', () => {
    for (let i = 1; i < RANK_TITLES.length; i++) {
      expect(typeof RANK_TITLES[i]).toBe('string')
      expect(RANK_TITLES[i].length).toBeGreaterThan(0)
    }
  })
})

describe('derivedBreakMinutes', () => {
  it('returns 0 for shifts under 4 hours', () => {
    expect(derivedBreakMinutes(0)).toBe(0)
    expect(derivedBreakMinutes(1)).toBe(0)
    expect(derivedBreakMinutes(3.9)).toBe(0)
  })

  it('returns 15 for shifts 4–5.9 hours', () => {
    expect(derivedBreakMinutes(4)).toBe(15)
    expect(derivedBreakMinutes(5)).toBe(15)
    expect(derivedBreakMinutes(5.9)).toBe(15)
  })

  it('returns 45 for shifts 6–7.9 hours', () => {
    expect(derivedBreakMinutes(6)).toBe(45)
    expect(derivedBreakMinutes(7)).toBe(45)
    expect(derivedBreakMinutes(7.9)).toBe(45)
  })

  it('returns 90 for shifts 8+ hours', () => {
    expect(derivedBreakMinutes(8)).toBe(90)
    expect(derivedBreakMinutes(10)).toBe(90)
    expect(derivedBreakMinutes(12)).toBe(90)
  })
})

describe('WORKDAY constants', () => {
  it('DEFAULT_SHIFT_HOURS is 8', () => expect(WORKDAY.DEFAULT_SHIFT_HOURS).toBe(8))
  it('AUTO_PUNCH_OUT_IDLE_MS is 15 minutes in ms', () => {
    expect(WORKDAY.AUTO_PUNCH_OUT_IDLE_MS).toBe(15 * 60 * 1000)
  })
})

describe('STREAK constants', () => {
  it('GRACE_DAYS_PER_WEEK is 1', () => expect(STREAK.GRACE_DAYS_PER_WEEK).toBe(1))
})

describe('THEMES', () => {
  it('contains exactly 4 themes', () => expect(THEMES).toHaveLength(4))
  it('includes terminal', () => expect(THEMES).toContain('terminal'))
  it('includes nes', () => expect(THEMES).toContain('nes'))
  it('includes gameboy', () => expect(THEMES).toContain('gameboy'))
  it('includes arcade', () => expect(THEMES).toContain('arcade'))
})
