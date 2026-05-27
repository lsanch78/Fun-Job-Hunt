import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { THEMES, type Theme } from '@/config/game'
import { fetchJobsForExport, deleteAllJobs, readAutoGhostSetting, writeAutoGhostSetting } from '@/services/jobService'
import { deleteAllWorkdays } from '@/services/workdayService'
import { supabase } from '@/lib/supabase'
import { getAiProvider, setAiProvider, getAiApiKey, setAiApiKey, fetchUsage, AI_MONTHLY_LIMIT, type AiProvider } from '@/services/aiService'
import { useSubscription } from '@/lib/SubscriptionContext'
import { createCheckoutSession } from '@/services/subscriptionService'
import type { Job } from '@/types'

const THEME_LABELS: Record<Theme, string> = {
  terminal: 'Classic Terminal',
  nes:      'NES RPG',
  gameboy:  'Game Boy',
  arcade:   'Arcade Cabinet',
}

function jobsToCSV(jobs: Job[]): string {
  const headers = ['ID', 'Company', 'Title', 'Status', 'Date Applied', 'Salary (K)', 'Rating', 'Posting URL', 'Description', 'Contacts', 'Notes']
  const rows = jobs.map((j) => [
    j.id,
    j.company,
    j.title,
    j.status.replace(/_/g, ' '),
    j.applicationDate,
    j.salary ? `${j.salary}K` : '',
    j.rating > 0 ? String(j.rating) : '',
    j.postingUrl,
    j.description ?? '',
    j.contacts ?? '',
    j.notes ?? '',
  ])
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\r\n')
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { isSubscribed, subscription, refresh } = useSubscription()
  const [exporting, setExporting] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [checkoutPending, setCheckoutPending] = useState(false)

  const initialGhost = readAutoGhostSetting()
  const [ghostEnabled, setGhostEnabled] = useState(initialGhost.enabled)
  const [ghostDays, setGhostDays] = useState(String(initialGhost.days))

  const [userId,        setUserId]        = useState<string | null>(null)
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
    })
    if (getAiProvider() === 'proxy') fetchUsage().then(setAiUsage)
  }, [])

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

  async function handleReset() {
    if (!userId) return
    setResetting(true)
    await Promise.all([deleteAllJobs(userId), deleteAllWorkdays(userId)])
    // Clear local caches
    localStorage.removeItem(`fjobhunt:jobs:${userId}`)
    localStorage.removeItem(`fjobhunt:workdays:${userId}`)
    localStorage.removeItem('workday_punch_in')
    localStorage.removeItem('workday_id')
    localStorage.removeItem('workday_break_start')
    localStorage.removeItem('workday_break_label')
    setResetting(false)
    setResetConfirm(false)
    setResetDone(true)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const jobs = await fetchJobsForExport(user.id)
      if (jobs.length === 0) return
      const csv = jobsToCSV(jobs)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `jobs-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg font-pixel text-primary p-8">
      <h1 className="text-xl mb-8">SETTINGS</h1>

      <section>
        <h2 className="text-sm mb-6 text-secondary">THEME</h2>
        <div className="flex flex-col gap-4">
          {THEMES.map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`
                text-left text-xs px-4 py-3 border-2 transition-none
                ${theme === t
                  ? 'border-primary text-primary'
                  : 'border-muted text-muted hover:border-secondary hover:text-secondary'
                }
              `}
            >
              {theme === t ? '> ' : '  '}{THEME_LABELS[t]}
            </button>
          ))}
        </div>
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
        <h2 className="text-sm mb-6 text-secondary">DATA</h2>
        <div className="flex flex-col gap-4">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-secondary hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-none"
          >
            {exporting ? '  Exporting…' : '  Export jobs to CSV'}
          </button>

          <div className="flex flex-col gap-3">
            {!resetConfirm && !resetDone && (
              <button
                onClick={() => setResetConfirm(true)}
                className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-red-500 hover:text-red-500 transition-none"
              >
                {'  Reset job hunt'}
              </button>
            )}

            {resetConfirm && !resetDone && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-red-500 px-1">
                  This will permanently delete all jobs and activity logs. This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    disabled={resetting}
                    className="text-left text-xs px-4 py-3 border-2 border-red-500 text-red-500 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-none"
                  >
                    {resetting ? '  Deleting…' : '  Yes, delete everything'}
                  </button>
                  <button
                    onClick={() => setResetConfirm(false)}
                    disabled={resetting}
                    className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-secondary hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-none"
                  >
                    {'  Cancel'}
                  </button>
                </div>
              </div>
            )}

            {resetDone && (
              <p className="text-xs text-secondary px-1">Job hunt reset. All data deleted.</p>
            )}
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
              {'> '}Pro — active
              {subscription?.current_period_end
                ? ` until ${new Date(subscription.current_period_end).toLocaleDateString()}`
                : ''}
            </p>
            <p className="text-[10px] text-muted px-1">3 resume slots · Unlimited AI generations</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] text-muted px-1 leading-relaxed">
              Free tier: 1 resume slot · {AI_MONTHLY_LIMIT} AI generations/month
            </p>
            <p className="text-[10px] text-muted px-1 leading-relaxed">
              Pro: 3 resume slots · Unlimited AI generations
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
        <h2 className="text-sm mb-6 text-secondary">AI ASSISTANT</h2>

        <div className="flex flex-col gap-6">
          {/* ── Provider selector ── */}
          <div className="flex flex-col gap-2">
            <label className="text-muted text-[10px] tracking-widest">AI PROVIDER</label>
            <div className="flex flex-col gap-2">
              {(['proxy', 'ollama', 'openai', 'anthropic'] as AiProvider[]).map((p) => (
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
                  {p === 'proxy'      ? `Claude managed by F Jobhunt — free, ${AI_MONTHLY_LIMIT}/month`
                    : p === 'ollama' ? 'Ollama (local)'
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
          {aiProvider !== 'ollama' && aiProvider !== 'proxy' && (
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
        </div>
      </section>
    </div>
  )
}
