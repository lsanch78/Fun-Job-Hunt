jest.mock('@/lib/supabase', () => ({ supabase: {} }))

import { xpForJob, getRankInfo } from '@/services/xpService'
import { XP } from '@/config/game'

// ── xpForJob ──────────────────────────────────────────────────────────────────

describe('xpForJob', () => {
  it('normal job earns ADD_JOB', () => {
    expect(xpForJob(1)).toBe(XP.ADD_JOB)
    expect(xpForJob(5)).toBe(XP.ADD_JOB)
    expect(xpForJob(9)).toBe(XP.ADD_JOB)
  })

  it('10th job earns double', () => {
    expect(xpForJob(10)).toBe(XP.ADD_JOB * 2)
  })

  it('20th job earns double', () => {
    expect(xpForJob(20)).toBe(XP.ADD_JOB * 2)
  })

  it('11th job is back to normal', () => {
    expect(xpForJob(11)).toBe(XP.ADD_JOB)
  })

  it('non-multiples-of-10 never earn double', () => {
    ;[1, 3, 7, 11, 19, 21].forEach((n) => {
      expect(xpForJob(n)).toBe(XP.ADD_JOB)
    })
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

// ── xpForJob accumulation + getRankInfo ───────────────────────────────────────

describe('xpForJob accumulation + getRankInfo', () => {
  function accumulateXp(jobCount: number): number {
    let total = 0
    for (let i = 1; i <= jobCount; i++) total += xpForJob(i)
    return total
  }

  it('4 jobs (80 XP) stays rank 1', () => {
    expect(getRankInfo(accumulateXp(4)).rank).toBe(1)
  })

  it('5 jobs (100 XP) reaches rank 2', () => {
    expect(getRankInfo(accumulateXp(5)).rank).toBe(2)
  })

  it('10 jobs with double bonus (220 XP) is rank 2', () => {
    expect(getRankInfo(accumulateXp(10)).rank).toBe(2)
  })

  it('13 jobs (280 XP) reaches rank 3', () => {
    expect(getRankInfo(accumulateXp(13)).rank).toBe(3)
  })
})
