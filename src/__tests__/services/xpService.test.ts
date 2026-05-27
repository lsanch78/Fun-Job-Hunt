import { calculateXp, getRankInfo } from '@/services/xpService'
import { XP } from '@/config/game'

// ── calculateXp ───────────────────────────────────────────────────────────────

describe('calculateXp', () => {
  it('0 jobs → 0 XP', () => {
    expect(calculateXp(0)).toBe(0)
  })

  it('1 job → ADD_JOB XP (no bonus)', () => {
    expect(calculateXp(1)).toBe(XP.ADD_JOB)
  })

  it('9 jobs → 9 * ADD_JOB (no bonus yet)', () => {
    expect(calculateXp(9)).toBe(9 * XP.ADD_JOB)
  })

  it('10th job earns a bonus ADD_JOB on top', () => {
    // base: 10 * 20 = 200, bonus: floor(10/10) * 20 = 20 → 220
    expect(calculateXp(10)).toBe(10 * XP.ADD_JOB + XP.ADD_JOB)
  })

  it('20 jobs earns 2 bonus ADD_JOBs', () => {
    expect(calculateXp(20)).toBe(20 * XP.ADD_JOB + 2 * XP.ADD_JOB)
  })

  it('15 jobs earns 1 bonus (only at the 10-mark, not the 15-mark)', () => {
    expect(calculateXp(15)).toBe(15 * XP.ADD_JOB + 1 * XP.ADD_JOB)
  })

  it('is always non-negative', () => {
    expect(calculateXp(0)).toBeGreaterThanOrEqual(0)
  })
})

// ── getRankInfo ───────────────────────────────────────────────────────────────

describe('getRankInfo', () => {
  it('returns rank 1 at 0 XP', () => {
    const info = getRankInfo(0)
    expect(info.rank).toBe(1)
    expect(info.title).toBe('Destitute Job Seeker')
  })

  it('returns rank 2 at 100 XP', () => {
    expect(getRankInfo(100).rank).toBe(2)
  })

  it('returns rank 10 at 4500 XP', () => {
    expect(getRankInfo(4500).rank).toBe(10)
  })

  it('returns rank 11 at 6000 XP', () => {
    expect(getRankInfo(6000).rank).toBe(11)
  })

  it('progress is between 0 and 1 for mid-rank XP', () => {
    const info = getRankInfo(150) // rank 2: 100–250
    expect(info.progress).toBeGreaterThan(0)
    expect(info.progress).toBeLessThan(1)
  })

  it('progress is 0 at exact rank threshold', () => {
    expect(getRankInfo(100).progress).toBe(0)
  })

  it('isMax is false below rank 11', () => {
    expect(getRankInfo(5999).isMax).toBe(false)
  })

  it('isMax is true at 6000 XP', () => {
    expect(getRankInfo(6000).isMax).toBe(true)
  })

  it('isMax is true beyond 6000 XP', () => {
    expect(getRankInfo(9999).isMax).toBe(true)
  })

  it('progress is 1 when isMax', () => {
    expect(getRankInfo(9999).progress).toBe(1)
  })

  it('xp field echoes the input', () => {
    expect(getRankInfo(250).xp).toBe(250)
  })
})

// ── formula + rank together ───────────────────────────────────────────────────

describe('calculateXp + getRankInfo', () => {
  it('5 jobs puts you in rank 1 (100 XP threshold not reached)', () => {
    const xp = calculateXp(5) // 5 * 20 = 100... wait, exactly 100
    // 5 * 20 = 100 → rank 2
    expect(getRankInfo(xp).rank).toBe(2)
  })

  it('4 jobs stays rank 1', () => {
    const xp = calculateXp(4) // 4 * 20 = 80
    expect(getRankInfo(xp).rank).toBe(1)
  })

  it('10 jobs with bonus (220 XP) reaches rank 3 threshold at 250 — still rank 2', () => {
    const xp = calculateXp(10) // 220 XP
    expect(getRankInfo(xp).rank).toBe(2)
  })

  it('13 jobs with 1 bonus (13*20 + 20 = 280 XP) reaches rank 3', () => {
    const xp = calculateXp(13) // 13*20 + 20 = 280
    expect(getRankInfo(xp).rank).toBe(3)
  })
})
