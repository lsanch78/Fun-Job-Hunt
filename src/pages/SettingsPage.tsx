import { useState, useEffect, useRef } from 'react'
import { useTheme, type CustomColors, DEFAULT_CUSTOM_COLORS } from '@/lib/ThemeContext'
import { THEMES, type Theme } from '@/config/game'
import { fetchJobsForExport, deleteAllJobs, readAutoGhostSetting, writeAutoGhostSetting } from '@/services/jobService'
import { fetchContacts, deleteAllContacts } from '@/services/contactService'
import { buildCombinedCSV } from '@/lib/csvData'
import { COMM_COOLDOWN_OPTIONS, getCommCooldownHours, setCommCooldownHours, type CommCooldownHours } from '@/lib/commSettings'
import { deleteAllWorkdays } from '@/services/workdayService'
import { lsGet, lsSet, lsRemove } from '@/lib/storage'
import { SK, type AiMode } from '@/lib/storageKeys'
import { supabase } from '@/lib/supabase'
import { getAiProvider, setAiProvider, getAiApiKey, setAiApiKey, fetchUsage, AI_MONTHLY_LIMIT_BASE, AI_MONTHLY_LIMIT_RANK5, AI_MONTHLY_LIMIT_RANK7, type AiProvider } from '@/services/aiService'
import { resetProfileXp } from '@/services/xpService'
import { upsertScratchPad } from '@/services/scratchPadService'
import { deleteAllResumes } from '@/services/resumeService'
import { deleteAllTracks } from '@/services/musicService'
import { deleteAllLinks } from '@/services/quickCastService'
import { useSubscription } from '@/lib/SubscriptionContext'
import { createCheckoutSession, openPortalSession } from '@/services/subscriptionService'

const THEME_LABELS: Record<Theme, string> = {
  terminal:     'Classic Terminal',
  nes:          'NES RPG',
  gameboy:      'Game Boy',
  arcade:       'Arcade Cabinet',
  highcontrast: 'High Contrast',
  custom:       'Custom',
}

const PREMIUM_THEMES = new Set<Theme>(['nes', 'gameboy', 'arcade', 'highcontrast', 'custom'])

const COLOR_LABELS: Record<keyof CustomColors, string> = {
  bg:        'BACKGROUND',
  surface:   'SURFACE',
  border:    'BORDER',
  primary:   'PRIMARY',
  secondary: 'SECONDARY',
  muted:     'MUTED',
  dim:       'DIM',
  warning:   'WARNING',
}


export default function SettingsPage() {
  const { theme, setTheme, customColors, setCustomColors } = useTheme()
  const { isSubscribed, subscription, refresh } = useSubscription()
  const [exporting, setExporting] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<'jobs' | 'contacts' | 'full' | null>(null)
  const [fullResetPhrase, setFullResetPhrase] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState<'jobs' | 'contacts' | 'full' | null>(null)
  const [checkoutPending, setCheckoutPending] = useState(false)

  const initialGhost = readAutoGhostSetting()
  const [ghostEnabled, setGhostEnabled] = useState(initialGhost.enabled)
  const [ghostDays, setGhostDays] = useState(String(initialGhost.days))

  const [userId,        setUserId]        = useState<string | null>(null)
  const [username,      setUsername]      = useState('')
  const [nameInput,     setNameInput]     = useState('')
  const [editingName,   setEditingName]   = useState(false)
  const [nameSaving,    setNameSaving]    = useState(false)
  const [commCooldown,  setCommCooldown]  = useState<CommCooldownHours>(168)
  const [aiMode,        setAiModeState]     = useState<AiMode>('ai-first')
  const [aiProvider,    setAiProviderState] = useState<AiProvider>(() => getAiProvider())
  const [aiApiKey,      setAiApiKeyState]  = useState<string>(() => getAiApiKey())
  const [apiKeyVisible, setApiKeyVisible]  = useState(false)
  const [apiKeySaved,   setApiKeySaved]    = useState(false)
  const [aiUsage,       setAiUsage]        = useState<{ count: number; limit: number } | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      setAiModeState(lsGet<AiMode>(SK.aiMode(user.id), 'ai-first'))
      setCommCooldown(getCommCooldownHours(user.id))
      const name = (user.user_metadata?.['username'] as string | undefined) ?? ''
      setUsername(name)
      setNameInput(name)
    })
    if (getAiProvider() === 'proxy') fetchUsage().then(setAiUsage)
  }, [])

  async function handleSaveName() {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === username) { setEditingName(false); return }
    setNameSaving(true)
    await supabase.auth.updateUser({ data: { username: trimmed } })
    setUsername(trimmed)
    setNameSaving(false)
    setEditingName(false)
  }

  // After Stripe redirects back with ?checkout=success, poll until the
  // webhook has updated the subscription row, then clear the query param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') !== 'success') return

    setCheckoutPending(true)
    let attempts = 0
    pollRef.current = setInterval(async () => {
      await refresh()
      attempts++
      // refresh() updates context; isSubscribed will reflect new value on next render
      // We stop after 15 attempts (~30s) to avoid polling forever
      if (attempts >= 15) {
        clearInterval(pollRef.current!)
        setCheckoutPending(false)
      }
    }, 2000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once subscription becomes active, stop polling and clean up the URL
  useEffect(() => {
    if (isSubscribed && checkoutPending) {
      if (pollRef.current) clearInterval(pollRef.current)
      setCheckoutPending(false)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [isSubscribed, checkoutPending])

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
    await Promise.all([deleteAllJobs(userId), deleteAllWorkdays(userId)])
    lsRemove(SK.jobs(userId))
    lsRemove(SK.workdays(userId))
    lsRemove(SK.workdayPunchIn)
    lsRemove(SK.workdayId)
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
      deleteAllWorkdays(userId),
      deleteAllContacts(userId),
      deleteAllResumes(userId),
      deleteAllTracks(userId),
      deleteAllLinks(userId),
      resetProfileXp(userId),
      upsertScratchPad(userId, { notes: '', list: '' }),
      supabase.from('game_progress').upsert({ user_id: userId, employed: false }),
    ])
    const keys = [
      SK.jobs(userId),
      SK.workdays(userId),
      SK.workdayPunchIn,
      'workday_punch_in',                           // legacy workday key
      SK.workdayId,
      'workday_id',                                 // legacy workday key
      SK.scratchPad(userId),
      SK.scratchList(userId),
      SK.xp(userId),
      `xp:${userId}`,                               // legacy xp key
      SK.musicTracks,
      SK.musicResume,
      SK.aiMode(userId),
      SK.aiModalSlots(userId),
      `ai_panel_slots_${userId}`,                   // legacy AI modal key
      `fjobhunt:ai-panel-slots:${userId}`,          // legacy AI modal key (pre-rename)
      SK.aiModalText(userId),
      `ai_panel_resume_text_${userId}`,             // legacy AI modal key
      `fjobhunt:ai-panel-text:${userId}`,           // legacy AI modal key (pre-rename)
      SK.commCooldown(userId),
      `fjobhunt:${userId}:comm-cooldown-hours`,     // legacy comm cooldown key
      SK.quickcastLinks(userId),
      SK.tutorialSeen(userId, 'job-log'),
      SK.tutorialSeen(userId, 'mobile-job-log'),
      SK.tutorialSeen(userId, 'network'),
      SK.tutorialSeen(userId, 'story'),
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


  return (
    <div className="h-full overflow-y-auto bg-bg font-pixel text-primary p-8">
      <h1 className="text-xl mb-8">SETTINGS</h1>

      <section className="mb-12">
        <h2 className="text-sm mb-6 text-secondary">PROFILE</h2>
        <div className="flex flex-col gap-2">
          <label className="text-muted text-[10px] tracking-widest">DISPLAY NAME</label>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                className="flex-1 bg-transparent border-b border-primary text-primary font-pixel text-xs outline-none py-1"
                disabled={nameSaving}
              />
              <button onClick={handleSaveName} disabled={nameSaving} className="text-xs text-primary border border-primary px-3 py-1 hover:opacity-70 transition-none">
                {nameSaving ? '…' : 'SAVE'}
              </button>
              <button onClick={() => setEditingName(false)} className="text-xs text-muted border border-muted px-3 py-1 hover:opacity-70 transition-none">
                CANCEL
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-secondary hover:text-secondary transition-none w-fit"
            >
              {username || '(no name set)'}
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm mb-6 text-secondary">THEME</h2>
        <div className="flex flex-col gap-4">
          {THEMES.map((t) => {
            const locked = PREMIUM_THEMES.has(t) && !isSubscribed
            return (
              <button
                key={t}
                onClick={() => { if (!locked) setTheme(t) }}
                className={`
                  text-left text-xs px-4 py-3 border-2 transition-none
                  ${locked
                    ? 'border-border text-border cursor-default opacity-50'
                    : theme === t
                      ? 'border-primary text-primary'
                      : 'border-muted text-muted hover:border-secondary hover:text-secondary'
                  }
                `}
              >
                {locked ? '  ' : theme === t ? '> ' : '  '}{THEME_LABELS[t]}{locked ? ' [PRO]' : ''}
              </button>
            )
          })}
        </div>

        {theme === 'custom' && (
          <div className="mt-6 border-2 border-muted p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-secondary">CUSTOM COLORS</span>
              <button
                onClick={() => setCustomColors(DEFAULT_CUSTOM_COLORS)}
                className="text-xs text-muted hover:text-secondary border border-muted hover:border-secondary px-2 py-1 transition-none"
              >
                RESET
              </button>
            </div>
            {(Object.keys(COLOR_LABELS) as (keyof CustomColors)[]).map((key) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted w-24">{COLOR_LABELS[key]}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted font-mono">{customColors[key].toUpperCase()}</span>
                  <input
                    type="color"
                    value={customColors[key]}
                    onChange={(e) => setCustomColors({ ...customColors, [key]: e.target.value })}
                    className="w-8 h-8 cursor-pointer border-2 border-muted bg-transparent p-0"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-sm mb-6 text-secondary">JOBS</h2>

        {/* Auto-ghost toggle */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleGhostToggle}
            className={`
              text-left text-xs px-4 py-3 border-2 transition-none
              ${ghostEnabled
                ? 'border-primary text-primary'
                : 'border-muted text-muted hover:border-secondary hover:text-secondary'
              }
            `}
          >
            {ghostEnabled ? '> ' : '  '}Auto-ghost stale applications
          </button>

          {ghostEnabled && (
            <div className="flex items-center gap-3 px-4">
              <span className="text-muted text-xs">Ghost after</span>
              <input
                type="number"
                min={1}
                value={ghostDays}
                onChange={(e) => setGhostDays(e.target.value)}
                onBlur={handleGhostDaysBlur}
                className="w-14 bg-transparent border-b border-muted text-primary font-pixel text-xs text-center outline-none focus:border-primary py-0.5"
              />
              <span className="text-muted text-xs">days with no update</span>
            </div>
          )}

          {ghostEnabled && (
            <p className="px-4 text-[10px] text-muted leading-relaxed">
              Applied, Phone Screen, and Interview entries older than {ghostDays || 60} days will
              be marked Ghosted automatically when you open the job log.
            </p>
          )}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-sm mb-6 text-secondary">NETWORK</h2>
        <div className="flex flex-col gap-3">
          <p className="text-muted text-xs mb-2">How often you can COMM a contact</p>
          <div className="flex flex-wrap gap-2">
            {COMM_COOLDOWN_OPTIONS.map((opt) => (
              <button
                key={opt.hours}
                onClick={() => {
                  if (!userId) return
                  setCommCooldown(opt.hours)
                  setCommCooldownHours(userId, opt.hours)
                }}
                className={`text-[10px] px-3 py-1.5 border transition-none
                  ${commCooldown === opt.hours
                    ? 'border-primary text-primary'
                    : 'border-border text-muted hover:border-secondary hover:text-secondary'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-sm mb-6 text-secondary">DATA</h2>
        <div className="flex flex-col gap-4">

          {/* ── Export ── */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-secondary hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-none"
          >
            {exporting ? '  Exporting…' : '  Export jobs + contacts to CSV'}
          </button>


          <div className="flex flex-col gap-3">
            {/* ── Delete all jobs ── */}
            {confirmTarget !== 'jobs' && (
              <button
                onClick={() => { setConfirmTarget('jobs'); setResetDone(null) }}
                disabled={resetting}
                className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-red-500 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-none"
              >
                {'  Delete all jobs'}
              </button>
            )}
            {confirmTarget === 'jobs' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-red-500 px-1">Permanently deletes all jobs and activity logs. Cannot be undone.</p>
                <div className="flex gap-3">
                  <button onClick={handleDeleteJobs} disabled={resetting} className="text-left text-xs px-4 py-3 border-2 border-red-500 text-red-500 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-none">
                    {resetting ? '  Deleting…' : '  Yes, delete all jobs'}
                  </button>
                  <button onClick={() => setConfirmTarget(null)} disabled={resetting} className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-secondary hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-none">
                    {'  Cancel'}
                  </button>
                </div>
              </div>
            )}
            {resetDone === 'jobs' && <p className="text-xs text-secondary px-1">All jobs deleted.</p>}

            {/* ── Delete all contacts ── */}
            {confirmTarget !== 'contacts' && (
              <button
                onClick={() => { setConfirmTarget('contacts'); setResetDone(null) }}
                disabled={resetting}
                className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-red-500 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-none"
              >
                {'  Delete all contacts'}
              </button>
            )}
            {confirmTarget === 'contacts' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-red-500 px-1">Permanently deletes all contacts and comm history. Cannot be undone.</p>
                <div className="flex gap-3">
                  <button onClick={handleDeleteContacts} disabled={resetting} className="text-left text-xs px-4 py-3 border-2 border-red-500 text-red-500 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-none">
                    {resetting ? '  Deleting…' : '  Yes, delete all contacts'}
                  </button>
                  <button onClick={() => setConfirmTarget(null)} disabled={resetting} className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-secondary hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-none">
                    {'  Cancel'}
                  </button>
                </div>
              </div>
            )}
            {resetDone === 'contacts' && <p className="text-xs text-secondary px-1">All contacts deleted.</p>}

            {/* ── Full reset ── */}
            <button
              onClick={() => { setConfirmTarget('full'); setFullResetPhrase(''); setResetDone(null) }}
              disabled={resetting}
              className="text-left text-xs px-4 py-3 border-2 border-red-900 text-red-700 hover:border-red-500 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-none"
            >
              {'  Full reset — wipe everything'}
            </button>
            {resetDone === 'full' && <p className="text-xs text-secondary px-1">Full reset complete. Starting fresh.</p>}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-sm mb-6 text-secondary">SUBSCRIPTION</h2>
        {checkoutPending && !isSubscribed && (
          <p className="text-xs text-secondary px-1 mb-3">Confirming payment...</p>
        )}
        {isSubscribed ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-primary px-1">
              {'> '}Pro —{' '}
              {subscription?.cancel_at_period_end
                ? `cancels ${new Date(subscription.current_period_end!).toLocaleDateString()}`
                : `active until ${subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '—'}`
              }
            </p>
            {subscription?.cancel_at_period_end && (
              <p className="text-[10px] text-yellow-500 px-1">
                Your plan will not renew. You keep Pro access until the date above.
              </p>
            )}
            <p className="text-[10px] text-muted px-1">Unlimited AI generations</p>
            <p className="text-[10px] text-muted px-1">3 Total Resume Slots</p>
            <button
              onClick={() => openPortalSession().catch(() => {})}
              className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-red-500 hover:text-red-500 transition-none w-fit"
            >
              {'  Manage / cancel subscription'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] text-muted px-1 leading-relaxed">
              Free tier: {AI_MONTHLY_LIMIT_BASE}/mo → {AI_MONTHLY_LIMIT_RANK5}/mo at Rank 5 → {AI_MONTHLY_LIMIT_RANK7}/mo at Rank 7
            </p>
            <p className="text-[10px] text-muted px-1 leading-relaxed">
              Pro: Unlimited AI generations · 3 Total Resume Slots
            </p>
            <button
              onClick={() => createCheckoutSession().catch(() => {})}
              className="text-left text-xs px-4 py-3 border-2 border-secondary text-secondary hover:opacity-80 transition-none w-fit"
            >
              {'  Upgrade to Pro — $8/month'}
            </button>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-sm mb-6 text-secondary">AI SETTINGS</h2>

        <div className="flex flex-col gap-6">
          {/* ── AI Mode selector ── */}
          <div className="flex flex-col gap-2">
            <label className="text-muted text-[10px] tracking-widest">AI MODE</label>
            {([
              ['ai-first',    'AI-First',    'AI writes for you — cover letters, responses, drafts'],
              ['human-first', 'Human-First', 'AI coaches you — talking points and questions, you write it'],
              ['off',         'Off',         'Hide all AI buttons'],
            ] as const).map(([mode, title, desc]) => (
              <button
                key={mode}
                onClick={() => handleAiModeChange(mode)}
                className={`text-left text-xs px-4 py-3 border-2 transition-none ${
                  aiMode === mode
                    ? 'border-primary text-primary'
                    : 'border-muted text-muted hover:border-secondary hover:text-secondary'
                }`}
              >
                {aiMode === mode ? '> ' : '  '}{title}
                <span className="block text-[10px] text-muted mt-0.5 font-pixel">{desc}</span>
              </button>
            ))}
          </div>

          {aiMode !== 'off' && <>
          {/* ── Provider selector ── */}
          <div className="flex flex-col gap-2">
            <label className="text-muted text-[10px] tracking-widest">AI PROVIDER</label>
            <div className="flex flex-col gap-2">
              {(['proxy', 'openai', 'anthropic'] as AiProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`text-left text-xs px-4 py-3 border-2 transition-none ${
                    aiProvider === p
                      ? 'border-primary text-primary'
                      : 'border-muted text-muted hover:border-secondary hover:text-secondary'
                  }`}
                >
                  {aiProvider === p ? '> ' : '  '}
                  {p === 'proxy'   ? `Claude managed by F Jobhunt — free, ${AI_MONTHLY_LIMIT_BASE}–${AI_MONTHLY_LIMIT_RANK7}/month`
                    : p === 'openai' ? 'OpenAI (your key)'
                    :                  'Anthropic (your key)'}
                </button>
              ))}
            </div>
            {aiProvider === 'proxy' && aiUsage && (
              <p className="text-[10px] text-muted px-1">
                {aiUsage.count}/{aiUsage.limit} generations used this month
              </p>
            )}
          </div>

          {/* ── API key (BYOK providers only) ── */}
          {aiProvider !== 'proxy' && (
            <div className="flex flex-col gap-2">
              <label className="text-muted text-[10px] tracking-widest">API KEY</label>
              <div className="flex items-center gap-2">
                <input
                  type={apiKeyVisible ? 'text' : 'password'}
                  value={aiApiKey}
                  onChange={(e) => setAiApiKeyState(e.target.value)}
                  placeholder={aiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                  className="flex-1 bg-transparent border border-muted text-primary font-pixel text-[10px] px-3 py-2 outline-none focus:border-primary placeholder-muted"
                />
                <button
                  onClick={() => setApiKeyVisible((v) => !v)}
                  className="text-xs px-3 py-2 border border-muted text-muted hover:border-secondary hover:text-secondary transition-none"
                >
                  {apiKeyVisible ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              <p className="text-[10px] text-muted leading-relaxed px-1">
                Your API key is stored locally in your browser and never sent to our servers.
              </p>
              <button
                onClick={handleSaveApiKey}
                className="text-left text-xs px-4 py-3 border-2 border-primary text-primary hover:opacity-80 transition-none w-fit"
              >
                {apiKeySaved ? '  Saved!' : '  Save API Key'}
              </button>
            </div>
          )}
          </>}
        </div>
      </section>

      {/* ── Full reset modal ── */}
      {confirmTarget === 'full' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-bg border-2 border-red-500 p-8 flex flex-col gap-5 w-full max-w-md font-pixel">
            <h2 className="text-sm text-red-500">FULL RESET</h2>
            <p className="text-xs text-red-400 leading-relaxed">
              This permanently deletes ALL jobs, contacts, activity logs, resumes, music playlists, and scratch pad, and resets your XP to 0. This cannot be undone.
            </p>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-muted tracking-widest">TYPE TO CONFIRM</label>
              <p className="text-[10px] text-red-400 font-mono">I am deleting all of my job search information</p>
              <input
                type="text"
                value={fullResetPhrase}
                onChange={(e) => setFullResetPhrase(e.target.value)}
                placeholder="type the phrase above"
                className="bg-transparent border border-red-900 text-primary font-pixel text-[10px] px-3 py-2 outline-none focus:border-red-500 placeholder-muted"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleFullReset}
                disabled={resetting || fullResetPhrase !== 'I am deleting all of my job search information'}
                className="text-left text-xs px-4 py-3 border-2 border-red-500 text-red-500 hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-none"
              >
                {resetting ? '  Resetting…' : '  Wipe everything'}
              </button>
              <button
                onClick={() => { setConfirmTarget(null); setFullResetPhrase('') }}
                disabled={resetting}
                className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-secondary hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-none"
              >
                {'  Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
