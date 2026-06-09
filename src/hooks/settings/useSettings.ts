import { useState, useEffect, useRef } from 'react'
import { fetchJobsForExport, deleteAllJobs, readAutoGhostSetting, writeAutoGhostSetting } from '@/services/jobService'
import { fetchContacts, deleteAllContacts } from '@/services/contactService'
import { deleteAllTailoredResumes } from '@/services/tailoredResumeService'
import { deleteAllCoverLetters } from '@/services/coverLetterService'
import { deleteCV } from '@/services/cvService'
import { deleteAllHeartbeats } from '@/services/activityTimerService'
import { buildCombinedCSV } from '@/lib/csvData'
import { COMM_COOLDOWN_OPTIONS, getCommCooldownHours, setCommCooldownHours } from '@/lib/commSettings'
import { lsGet, lsSet, lsRemove } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import { useAuth } from '@/contexts/AuthContext'
import { updateUsername } from '@/services/authService'
import { resetEmployed, resetProfileXp } from '@/services/xpService'
import { getAiProvider, setAiProvider, getAiApiKey, setAiApiKey, fetchUsage } from '@/services/aiService'
import type { AiProvider, AiMode, CommCooldownHours } from '@/types'
import { upsertJournal } from '@/services/journalService'
import { deleteAllTracks } from '@/services/musicService'
import { deleteAllLinks } from '@/services/quickCastService'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { createCheckoutSession, openPortalSession } from '@/services/subscriptionService'

export function useSettings() {
  const { userId, username } = useAuth()
  const { isSubscribed, subscription, refresh } = useSubscription()

  const [exporting,        setExporting]        = useState(false)
  const [confirmTarget,    setConfirmTarget]    = useState<'jobs' | 'contacts' | 'full' | null>(null)
  const [fullResetPhrase,  setFullResetPhrase]  = useState('')
  const [resetting,        setResetting]        = useState(false)
  const [resetDone,        setResetDone]        = useState<'jobs' | 'contacts' | 'full' | null>(null)
  const [checkoutPending,  setCheckoutPending]  = useState(false)

  const initialGhost = readAutoGhostSetting()
  const [ghostEnabled, setGhostEnabled] = useState(initialGhost.enabled)
  const [ghostDays,    setGhostDays]    = useState(String(initialGhost.days))

  const [nameInput,      setNameInput]      = useState(username)
  const [editingName,    setEditingName]    = useState(false)
  const [nameSaving,     setNameSaving]     = useState(false)
  const [commCooldown,   setCommCooldown]   = useState<CommCooldownHours>(168)
  const [aiMode,         setAiModeState]    = useState<AiMode>('ai-first')
  const [aiProvider,     setAiProviderState] = useState<AiProvider>(() => getAiProvider())
  const [aiApiKey,       setAiApiKeyState]  = useState<string>(() => getAiApiKey())
  const [apiKeyVisible,  setApiKeyVisible]  = useState(false)
  const [apiKeySaved,    setApiKeySaved]    = useState(false)
  const [aiUsage,        setAiUsage]        = useState<{ count: number; limit: number } | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!userId) return
    setAiModeState(lsGet<AiMode>(SK.aiMode(userId), 'ai-first'))
    setCommCooldown(getCommCooldownHours(userId))
    setNameInput(username)
    if (getAiProvider() === 'proxy') fetchUsage().then(setAiUsage)
  }, [userId, username])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') !== 'success') return
    setCheckoutPending(true)
    let attempts = 0
    pollRef.current = setInterval(async () => {
      await refresh()
      attempts++
      if (attempts >= 15) { clearInterval(pollRef.current!); setCheckoutPending(false) }
    }, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isSubscribed && checkoutPending) {
      if (pollRef.current) clearInterval(pollRef.current)
      setCheckoutPending(false)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [isSubscribed, checkoutPending])

  async function handleSaveName() {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === username) { setEditingName(false); return }
    setNameSaving(true)
    await updateUsername(trimmed)
    setNameSaving(false)
    setEditingName(false)
  }

  function handleGhostToggle() {
    const next = !ghostEnabled
    setGhostEnabled(next)
    writeAutoGhostSetting({ enabled: next, days: Number(ghostDays) || 60 })
  }

  function handleGhostDaysBlur() {
    const parsed = Math.max(1, parseInt(ghostDays, 10) || 60)
    setGhostDays(String(parsed))
    writeAutoGhostSetting({ enabled: ghostEnabled, days: parsed })
  }

  function handleAiModeChange(mode: AiMode) {
    if (!userId) return
    const wasOff = aiMode === 'off'
    const willBeOff = mode === 'off'
    setAiModeState(mode)
    lsSet(SK.aiMode(userId), mode)
    if (wasOff !== willBeOff) window.location.reload()
  }

  function handleProviderChange(p: AiProvider) {
    setAiProviderState(p)
    setAiProvider(p)
    if (p === 'proxy') fetchUsage().then(setAiUsage)
    else setAiUsage(null)
  }

  function handleSaveApiKey() {
    setAiApiKey(aiApiKey)
    setApiKeySaved(true)
    setTimeout(() => setApiKeySaved(false), 2000)
  }

  async function handleDeleteJobs() {
    if (!userId) return
    setResetting(true)
    await Promise.all([deleteAllJobs(userId), deleteAllHeartbeats(userId)])
    lsRemove(SK.jobs(userId))
    lsRemove(SK.activityHeartbeats(userId))
    setResetting(false)
    setConfirmTarget(null)
    setResetDone('jobs')
  }

  async function handleDeleteContacts() {
    if (!userId) return
    setResetting(true)
    await deleteAllContacts(userId)
    setResetting(false)
    setConfirmTarget(null)
    setResetDone('contacts')
  }

  async function handleFullReset() {
    if (!userId) return
    setResetting(true)
    await Promise.all([
      deleteAllJobs(userId),
      deleteAllHeartbeats(userId),
      deleteAllContacts(userId),
      deleteAllTailoredResumes(userId),
      deleteAllCoverLetters(userId),
      deleteCV(userId),
      deleteAllTracks(userId),
      deleteAllLinks(userId),
      resetProfileXp(userId),
      upsertJournal(userId, { notes: '', list: '' }),
      resetEmployed(userId),
    ])
    const keys = [
      SK.jobs(userId),
      SK.activityHeartbeats(userId),
      SK.journal(userId),
      SK.journalList(userId),
      SK.xp(userId),
      `xp:${userId}`,
      SK.musicTracks,
      SK.musicResume,
      SK.aiMode(userId),
      SK.commCooldown(userId),
      `fjobhunt:${userId}:comm-cooldown-hours`,
      SK.quickcastLinks(userId),
      SK.tutorialSeen(userId, 'job-log'),
      SK.tutorialSeen(userId, 'mobile-job-log'),
      SK.tutorialSeen(userId, 'network'),
    ]
    keys.forEach((k) => lsRemove(k))
    window.location.reload()
  }

  async function handleExport() {
    if (!userId) return
    setExporting(true)
    try {
      const [jobs, contacts] = await Promise.all([fetchJobsForExport(userId), fetchContacts(userId)])
      if (jobs.length === 0 && contacts.length === 0) return
      const csv = buildCombinedCSV(jobs, contacts)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fjh-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  function handleCommCooldownChange(hours: CommCooldownHours) {
    if (!userId) return
    setCommCooldown(hours)
    setCommCooldownHours(userId, hours)
  }

  return {
    userId, username,
    isSubscribed, subscription,
    exporting,
    confirmTarget, setConfirmTarget,
    fullResetPhrase, setFullResetPhrase,
    resetting,
    resetDone,
    checkoutPending,
    ghostEnabled, ghostDays, setGhostDays,
    nameInput, setNameInput,
    editingName, setEditingName,
    nameSaving,
    commCooldown,
    aiMode,
    aiProvider,
    aiApiKey, setAiApiKeyState,
    apiKeyVisible, setApiKeyVisible,
    apiKeySaved,
    aiUsage,
    COMM_COOLDOWN_OPTIONS,
    handleSaveName,
    handleGhostToggle,
    handleGhostDaysBlur,
    handleAiModeChange,
    handleProviderChange,
    handleSaveApiKey,
    handleDeleteJobs,
    handleDeleteContacts,
    handleFullReset,
    handleExport,
    handleCommCooldownChange,
    handleUpgrade: () => createCheckoutSession().catch(() => {}),
    handleManageSubscription: () => openPortalSession().catch(() => {}),
  }
}
