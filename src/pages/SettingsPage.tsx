import { useState, useEffect } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { THEMES, type Theme } from '@/config/game'
import { fetchJobsForExport, deleteAllJobs, readAutoGhostSetting, writeAutoGhostSetting } from '@/services/jobService'
import { deleteAllWorkdays } from '@/services/workdayService'
import { supabase } from '@/lib/supabase'
import { fetchAiSettings, upsertAiSettings, DEFAULT_PROMPTS, AI_PROMPT_LIMIT } from '@/services/aiSettingsService'
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
  const [exporting, setExporting] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  const initialGhost = readAutoGhostSetting()
  const [ghostEnabled, setGhostEnabled] = useState(initialGhost.enabled)
  const [ghostDays, setGhostDays] = useState(String(initialGhost.days))

  const [aiLoading,          setAiLoading]          = useState(false)
  const [aiSaving,           setAiSaving]           = useState(false)
  const [coverLetterPrompt,  setCoverLetterPrompt]  = useState<string>(DEFAULT_PROMPTS.cover_letter)
  const [whyGoodFitPrompt,   setWhyGoodFitPrompt]   = useState<string>(DEFAULT_PROMPTS.why_good_fit)
  const [customPrompt,       setCustomPrompt]       = useState<string>(DEFAULT_PROMPTS.custom)
  const [userId,             setUserId]             = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      setAiLoading(true)
      fetchAiSettings(user.id).then((settings) => {
        if (settings) {
          if (settings.cover_letter_prompt) setCoverLetterPrompt(settings.cover_letter_prompt)
          if (settings.why_good_fit_prompt) setWhyGoodFitPrompt(settings.why_good_fit_prompt)
          if (settings.custom_prompt) setCustomPrompt(settings.custom_prompt)
        }
        setAiLoading(false)
      })
    })
  }, [])

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

  async function handleSaveAiSettings() {
    if (!userId) return
    setAiSaving(true)
    await upsertAiSettings({ user_id: userId, cover_letter_prompt: coverLetterPrompt, why_good_fit_prompt: whyGoodFitPrompt, custom_prompt: customPrompt })
    setAiSaving(false)
  }

  function handleResetAiSettings() {
    setCoverLetterPrompt(DEFAULT_PROMPTS.cover_letter)
    setWhyGoodFitPrompt(DEFAULT_PROMPTS.why_good_fit)
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
        <h2 className="text-sm mb-6 text-secondary">AI ASSISTANT</h2>

        {aiLoading ? (
          <p className="text-muted text-xs">LOADING...</p>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-muted text-[10px] tracking-widest">COVER LETTER SYSTEM PROMPT</label>
              <textarea
                rows={6}
                maxLength={AI_PROMPT_LIMIT}
                value={coverLetterPrompt}
                onChange={(e) => setCoverLetterPrompt(e.target.value)}
                className="bg-transparent border border-muted text-primary font-pixel text-[10px] px-3 py-2 outline-none focus:border-primary resize-none leading-relaxed placeholder-muted w-full"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-muted text-[10px] tracking-widest">WHY GOOD FIT SYSTEM PROMPT</label>
              <textarea
                rows={6}
                maxLength={AI_PROMPT_LIMIT}
                value={whyGoodFitPrompt}
                onChange={(e) => setWhyGoodFitPrompt(e.target.value)}
                className="bg-transparent border border-muted text-primary font-pixel text-[10px] px-3 py-2 outline-none focus:border-primary resize-none leading-relaxed placeholder-muted w-full"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveAiSettings}
                disabled={aiSaving}
                className="text-left text-xs px-4 py-3 border-2 border-primary text-primary hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-none"
              >
                {aiSaving ? '  Saving…' : '  Save AI Settings'}
              </button>
              <button
                onClick={handleResetAiSettings}
                disabled={aiSaving}
                className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-secondary hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-none"
              >
                {'  Reset to Defaults'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
