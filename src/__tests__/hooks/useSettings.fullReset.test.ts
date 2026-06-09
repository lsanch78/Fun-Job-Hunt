import { renderHook, act } from '@testing-library/react'
import { useSettings } from '@/hooks/settings/useSettings'

// ── Service mocks ─────────────────────────────────────────────────────────────

jest.mock('@/services/jobService', () => ({
  deleteAllJobs:        jest.fn(async () => {}),
  fetchJobsForExport:   jest.fn(async () => []),
  readAutoGhostSetting: jest.fn(() => ({ enabled: false, days: 60 })),
  writeAutoGhostSetting: jest.fn(),
}))

jest.mock('@/services/contactService', () => ({
  fetchContacts:     jest.fn(async () => []),
  deleteAllContacts: jest.fn(async () => {}),
}))

jest.mock('@/services/activityTimerService', () => ({
  deleteAllHeartbeats: jest.fn(async () => ({ error: null })),
}))

jest.mock('@/services/tailoredResumeService', () => ({
  deleteAllTailoredResumes: jest.fn(async () => ({ error: null })),
}))

jest.mock('@/services/coverLetterService', () => ({
  deleteAllCoverLetters: jest.fn(async () => ({ error: null })),
}))

jest.mock('@/services/cvService', () => ({
  deleteCV: jest.fn(async () => ({ error: null })),
}))

jest.mock('@/services/musicService', () => ({
  deleteAllTracks: jest.fn(async () => ({ error: null })),
}))

jest.mock('@/services/quickCastService', () => ({
  deleteAllLinks: jest.fn(async () => ({ error: null })),
}))

jest.mock('@/services/xpService', () => ({
  resetProfileXp: jest.fn(async () => {}),
  resetEmployed:  jest.fn(async () => {}),
}))

jest.mock('@/services/journalService', () => ({
  upsertJournal: jest.fn(async () => {}),
}))

jest.mock('@/services/aiService', () => ({
  getAiProvider:  jest.fn(() => 'proxy'),
  setAiProvider:  jest.fn(),
  getAiApiKey:    jest.fn(() => ''),
  setAiApiKey:    jest.fn(),
  fetchUsage:     jest.fn(async () => ({ count: 0, limit: 30 })),
  AI_MONTHLY_LIMIT: 30,
}))

jest.mock('@/services/authService', () => ({
  updateUsername: jest.fn(async () => {}),
}))

jest.mock('@/services/subscriptionService', () => ({
  createCheckoutSession: jest.fn(async () => {}),
  openPortalSession:     jest.fn(async () => {}),
}))

jest.mock('@/lib/commSettings', () => ({
  COMM_COOLDOWN_OPTIONS:  [],
  getCommCooldownHours:   jest.fn(() => 168),
  setCommCooldownHours:   jest.fn(),
}))

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({ userId: 'u1', username: 'Tester' })),
}))

jest.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: jest.fn(() => ({
    isSubscribed: false,
    subscription: null,
    refresh: jest.fn(),
  })),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { deleteAllJobs }          from '@/services/jobService'
import { deleteAllContacts }      from '@/services/contactService'
import { deleteAllHeartbeats }    from '@/services/activityTimerService'
import { deleteAllTailoredResumes } from '@/services/tailoredResumeService'
import { deleteAllCoverLetters }  from '@/services/coverLetterService'
import { deleteCV }               from '@/services/cvService'
import { deleteAllTracks }        from '@/services/musicService'
import { deleteAllLinks }         from '@/services/quickCastService'
import { resetProfileXp, resetEmployed } from '@/services/xpService'
import { upsertJournal }          from '@/services/journalService'
import { SK }                     from '@/lib/storageKeys'

const USER_ID = 'u1'

// jsdom does not implement window.location.reload — stub the whole location object
delete (window as unknown as Record<string, unknown>).location
;(window as unknown as Record<string, unknown>).location = {
  reload:   jest.fn(),
  search:   '',
  pathname: '/',
  href:     'http://localhost/',
  replace:  jest.fn(),
}

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ── handleFullReset ───────────────────────────────────────────────────────────

describe('handleFullReset', () => {
  async function runFullReset() {
    const { result } = renderHook(() => useSettings())
    // Set the phrase so the reset is not blocked
    act(() => { result.current.setFullResetPhrase('I am deleting all of my job search information') })
    await act(async () => { await result.current.handleFullReset() })
    return result
  }

  it('deletes all jobs', async () => {
    await runFullReset()
    expect(deleteAllJobs).toHaveBeenCalledWith(USER_ID)
  })

  it('deletes all activity heartbeats', async () => {
    await runFullReset()
    expect(deleteAllHeartbeats).toHaveBeenCalledWith(USER_ID)
  })

  it('deletes all contacts', async () => {
    await runFullReset()
    expect(deleteAllContacts).toHaveBeenCalledWith(USER_ID)
  })

  it('deletes all tailored resumes', async () => {
    await runFullReset()
    expect(deleteAllTailoredResumes).toHaveBeenCalledWith(USER_ID)
  })

  it('deletes all cover letters', async () => {
    await runFullReset()
    expect(deleteAllCoverLetters).toHaveBeenCalledWith(USER_ID)
  })

  it('deletes CV', async () => {
    await runFullReset()
    expect(deleteCV).toHaveBeenCalledWith(USER_ID)
  })

  it('deletes all music tracks', async () => {
    await runFullReset()
    expect(deleteAllTracks).toHaveBeenCalledWith(USER_ID)
  })

  it('deletes all quick cast links', async () => {
    await runFullReset()
    expect(deleteAllLinks).toHaveBeenCalledWith(USER_ID)
  })

  it('resets XP', async () => {
    await runFullReset()
    expect(resetProfileXp).toHaveBeenCalledWith(USER_ID)
  })

  it('resets employed flag', async () => {
    await runFullReset()
    expect(resetEmployed).toHaveBeenCalledWith(USER_ID)
  })

  it('clears journal content', async () => {
    await runFullReset()
    expect(upsertJournal).toHaveBeenCalledWith(USER_ID, { notes: '', list: '' })
  })

  it('clears jobs localStorage key', async () => {
    localStorage.setItem(SK.jobs(USER_ID), '["job"]')
    await runFullReset()
    expect(localStorage.getItem(SK.jobs(USER_ID))).toBeNull()
  })

  it('clears activity heartbeats localStorage key', async () => {
    localStorage.setItem(SK.activityHeartbeats(USER_ID), '[{}]')
    await runFullReset()
    expect(localStorage.getItem(SK.activityHeartbeats(USER_ID))).toBeNull()
  })

  it('clears XP localStorage key', async () => {
    localStorage.setItem(SK.xp(USER_ID), '500')
    await runFullReset()
    expect(localStorage.getItem(SK.xp(USER_ID))).toBeNull()
  })

  it('clears journal localStorage keys', async () => {
    localStorage.setItem(SK.journal(USER_ID), 'notes')
    localStorage.setItem(SK.journalList(USER_ID), '[]')
    await runFullReset()
    expect(localStorage.getItem(SK.journal(USER_ID))).toBeNull()
    expect(localStorage.getItem(SK.journalList(USER_ID))).toBeNull()
  })

  it('clears quick cast links localStorage key', async () => {
    localStorage.setItem(SK.quickcastLinks(USER_ID), '[]')
    await runFullReset()
    expect(localStorage.getItem(SK.quickcastLinks(USER_ID))).toBeNull()
  })

  it('clears tutorial seen keys', async () => {
    localStorage.setItem(SK.tutorialSeen(USER_ID, 'job-log'), 'true')
    localStorage.setItem(SK.tutorialSeen(USER_ID, 'mobile-job-log'), 'true')
    localStorage.setItem(SK.tutorialSeen(USER_ID, 'network'), 'true')
    await runFullReset()
    expect(localStorage.getItem(SK.tutorialSeen(USER_ID, 'job-log'))).toBeNull()
    expect(localStorage.getItem(SK.tutorialSeen(USER_ID, 'mobile-job-log'))).toBeNull()
    expect(localStorage.getItem(SK.tutorialSeen(USER_ID, 'network'))).toBeNull()
  })

  it('calls all deletions in parallel — all services called in a single reset', async () => {
    await runFullReset()
    // Every service delete should have been called exactly once
    expect(deleteAllJobs).toHaveBeenCalledTimes(1)
    expect(deleteAllHeartbeats).toHaveBeenCalledTimes(1)
    expect(deleteAllContacts).toHaveBeenCalledTimes(1)
    expect(deleteAllTailoredResumes).toHaveBeenCalledTimes(1)
    expect(deleteAllCoverLetters).toHaveBeenCalledTimes(1)
    expect(deleteCV).toHaveBeenCalledTimes(1)
    expect(deleteAllTracks).toHaveBeenCalledTimes(1)
    expect(deleteAllLinks).toHaveBeenCalledTimes(1)
    expect(resetProfileXp).toHaveBeenCalledTimes(1)
    expect(resetEmployed).toHaveBeenCalledTimes(1)
    expect(upsertJournal).toHaveBeenCalledTimes(1)
  })
})
