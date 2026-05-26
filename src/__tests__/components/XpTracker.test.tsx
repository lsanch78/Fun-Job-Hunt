import React from 'react'
import { render, screen } from '@testing-library/react'
import XpTracker, { getRankInfo } from '@/components/XpTracker'

// Mock sfx to avoid AudioContext issues in level-up tests
jest.mock('@/lib/sfx', () => ({
  isSfxMuted: jest.fn(() => true),
}))

// ---------- getRankInfo unit tests ----------

describe('getRankInfo', () => {
  it('returns rank 1 at 0 XP', () => {
    const info = getRankInfo(0)
    expect(info.rank).toBe(1)
    expect(info.title).toBe('Destitute Job Seeker')
  })

  it('returns rank 2 at 100 XP', () => {
    const info = getRankInfo(100)
    expect(info.rank).toBe(2)
  })

  it('returns rank 10 at 4500 XP', () => {
    const info = getRankInfo(4500)
    expect(info.rank).toBe(10)
  })

  it('returns rank 11 at 6000 XP', () => {
    const info = getRankInfo(6000)
    expect(info.rank).toBe(11)
  })

  it('progress is between 0 and 1 for mid-rank XP', () => {
    const info = getRankInfo(150) // between rank 2 (100) and rank 3 (250)
    expect(info.progress).toBeGreaterThan(0)
    expect(info.progress).toBeLessThan(1)
  })

  it('progress is 0 at exact rank threshold', () => {
    const info = getRankInfo(100) // exact rank 2 threshold
    expect(info.progress).toBe(0)
  })

  it('isMax is false for normal ranks', () => {
    expect(getRankInfo(0).isMax).toBe(false)
    expect(getRankInfo(5999).isMax).toBe(false)
  })

  it('isMax is true at or beyond rank 11 (6000 XP)', () => {
    expect(getRankInfo(6000).isMax).toBe(true)
    expect(getRankInfo(9999).isMax).toBe(true)
  })

  it('progress is 1 when isMax', () => {
    const info = getRankInfo(9999)
    expect(info.progress).toBe(1)
  })

  it('xp field equals input xp', () => {
    const info = getRankInfo(250)
    expect(info.xp).toBe(250)
  })
})

// ---------- XpTracker render tests ----------

describe('XpTracker component', () => {
  it('renders without crashing at 0 XP', () => {
    render(<XpTracker xp={0} />)
    expect(screen.getByText(/LVL 1/i)).toBeInTheDocument()
  })

  it('shows rank level number', () => {
    render(<XpTracker xp={100} />)
    expect(screen.getByText(/LVL 2/i)).toBeInTheDocument()
  })

  it('shows rank title', () => {
    render(<XpTracker xp={0} />)
    expect(screen.getByText('Destitute Job Seeker')).toBeInTheDocument()
  })

  it('shows XP / next floor when not at max', () => {
    render(<XpTracker xp={50} />)
    // Rank 1: next floor = 100
    expect(screen.getByText(/50 \/ 100 XP/i)).toBeInTheDocument()
  })

  it('shows MAX when at max rank (6000+ XP)', () => {
    render(<XpTracker xp={6000} />)
    expect(screen.getByText('MAX')).toBeInTheDocument()
  })

  it('bar width reflects progress percentage', () => {
    const { container } = render(<XpTracker xp={150} />)
    // rank 2 (100..250): progress = (150-100)/(250-100) = 50/150 ≈ 33%
    const bar = container.querySelector('.bg-secondary')
    expect(bar).toHaveStyle({ width: '33%' })
  })

  it('bar width is 100% at max rank', () => {
    const { container } = render(<XpTracker xp={6000} />)
    const bar = container.querySelector('.bg-secondary')
    expect(bar).toHaveStyle({ width: '100%' })
  })
})
