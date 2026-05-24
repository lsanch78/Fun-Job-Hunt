import { useState } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { THEMES, type Theme } from '@/config/game'
import { fetchJobs, readAutoGhostSetting, writeAutoGhostSetting } from '@/services/jobService'
import { supabase } from '@/lib/supabase'
import type { Job } from '@/types'

const THEME_LABELS: Record<Theme, string> = {
  terminal: 'Classic Terminal',
  nes:      'NES RPG',
  gameboy:  'Game Boy',
  arcade:   'Arcade Cabinet',
}

function jobsToCSV(jobs: Job[]): string {
  const headers = ['Company', 'Title', 'Status', 'Date Applied', 'Salary (K)', 'Rating', 'Posting URL']
  const rows = jobs.map((j) => [
    j.company,
    j.title,
    j.status.replace(/_/g, ' '),
    j.applicationDate,
    j.salary ? `${j.salary}K` : '',
    j.rating > 0 ? String(j.rating) : '',
    j.postingUrl,
  ])
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\r\n')
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [exporting, setExporting] = useState(false)

  const initialGhost = readAutoGhostSetting()
  const [ghostEnabled, setGhostEnabled] = useState(initialGhost.enabled)
  const [ghostDays, setGhostDays] = useState(String(initialGhost.days))

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

  async function handleExport() {
    setExporting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const jobs = await fetchJobs(user.id)
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
        <button
          onClick={handleExport}
          disabled={exporting}
          className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-secondary hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-none"
        >
          {exporting ? '  Exporting…' : '  Export jobs to CSV'}
        </button>
      </section>
    </div>
  )
}
