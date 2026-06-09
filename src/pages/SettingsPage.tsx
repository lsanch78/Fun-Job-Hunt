import { useTheme, type CustomColors, DEFAULT_CUSTOM_COLORS } from '@/contexts/ThemeContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { THEMES, type Theme } from '@/config/game'
import { PRO_UPGRADE_CTA } from '@/config/pricing'
import { AI_MONTHLY_LIMIT } from '@/services/aiService'
import { useSettings } from '@/hooks/settings/useSettings'

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
  const { loading: subscriptionLoading } = useSubscription()

  const {
    username,
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
    aiProvider,
    aiApiKey, setAiApiKeyState,
    apiKeyVisible, setApiKeyVisible,
    apiKeySaved,
    aiUsage,
    COMM_COOLDOWN_OPTIONS,
    handleSaveName,
    handleGhostToggle,
    handleGhostDaysBlur,
    handleProviderChange,
    handleSaveApiKey,
    handleDeleteJobs,
    handleDeleteContacts,
    handleFullReset,
    handleExport,
    handleCommCooldownChange,
    handleUpgrade,
    handleManageSubscription,
  } = useSettings()

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
                onClick={() => handleCommCooldownChange(opt.hours)}
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

          <button
            onClick={handleExport}
            disabled={exporting}
            className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-secondary hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-none"
          >
            {exporting ? '  Exporting…' : '  Export jobs + contacts to CSV'}
          </button>

          <div className="flex flex-col gap-3">
            {confirmTarget !== 'jobs' && (
              <button
                onClick={() => { setConfirmTarget('jobs'); }}
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

            {confirmTarget !== 'contacts' && (
              <button
                onClick={() => { setConfirmTarget('contacts'); }}
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

            <button
              onClick={() => { setConfirmTarget('full'); setFullResetPhrase('') }}
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
        {(subscriptionLoading || checkoutPending) && !isSubscribed ? (
          <span className="text-secondary text-[8px] leading-none animate-pixel-spin inline-block">▪</span>
        ) : isSubscribed ? (
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
            <p className="text-[10px] text-muted px-1">Unlimited AI requests</p>
            <button
              onClick={handleManageSubscription}
              className="text-left text-xs px-4 py-3 border-2 border-muted text-muted hover:border-red-500 hover:text-red-500 transition-none w-fit"
            >
              {'  Manage / cancel subscription'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] text-muted px-1 leading-relaxed">
              Free tier: {AI_MONTHLY_LIMIT} AI requests/month
            </p>
            <p className="text-[10px] text-muted px-1 leading-relaxed">
              Pro: Unlimited AI requests
            </p>
            <button
              onClick={handleUpgrade}
              className="text-left text-xs px-4 py-3 border-2 border-secondary text-secondary hover:opacity-80 transition-none w-fit"
            >
              {`  ${PRO_UPGRADE_CTA}`}
            </button>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-sm mb-6 text-secondary">AI SETTINGS</h2>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-muted text-[10px] tracking-widest">AI PROVIDER</label>
            <div className="flex flex-col gap-2">
              {(['proxy', 'openai', 'anthropic'] as const).map((p) => (
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
                  {p === 'proxy'   ? `Claude managed by F Jobhunt — free, ${AI_MONTHLY_LIMIT} requests/month`
                    : p === 'openai' ? 'OpenAI (your key)'
                    :                  'Anthropic (your key)'}
                </button>
              ))}
            </div>
            {aiProvider === 'proxy' && aiUsage && (
              <p className="text-[10px] text-muted px-1">
                {aiUsage.count}/{aiUsage.limit} requests used this month
              </p>
            )}
          </div>

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
        </div>
      </section>

      {/* ── Full reset modal ── */}
      {confirmTarget === 'full' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-bg border-2 border-red-500 p-8 flex flex-col gap-5 w-full max-w-md font-pixel">
            <h2 className="text-sm text-red-500">FULL RESET</h2>
            <p className="text-xs text-red-400 leading-relaxed">
              This permanently deletes ALL jobs, contacts, activity logs, CV, tailored resumes, cover letters, music playlists, and journal, and resets your XP to 0. This cannot be undone.
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
