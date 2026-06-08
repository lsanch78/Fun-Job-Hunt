import { useState } from 'react'
import { useFeedback } from '@/hooks/dev/useFeedback'
import { FEEDBACK_TOPICS } from '@/services/feedbackService'
import type { FeedbackTopic } from '@/types'
import CostsTab from '@/pages/dev/CostsTab'
import type { Tab } from '@/types'

const TOPIC_COLORS: Record<FeedbackTopic | 'Other', string> = {
  'User Interface': 'text-blue-400',
  'User Experience': 'text-purple-400',
  'Bug':            'text-red-400',
  'Feature Idea':   'text-green-400',
  'Other':          'text-muted',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function DevPortalPage() {
  const [tab, setTab] = useState<Tab>('FEEDBACK')

  const { entries, loading, filter, setFilter, displayed, counts } = useFeedback()

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

      {/* Header + tab switcher */}
      <div className="bg-surface border-b border-border px-6 py-3 flex items-center gap-6 shrink-0">
        <span className="font-pixel text-[9px] tracking-widest text-primary">DEV PORTAL</span>
        <div className="flex items-center gap-1">
          {(['FEEDBACK', 'COSTS'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`font-pixel text-[8px] px-3 py-1 border transition-none ${
                tab === t
                  ? 'border-primary text-primary bg-border'
                  : 'border-transparent text-muted hover:text-secondary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === 'FEEDBACK' && (
          <span className="font-pixel text-[8px] text-muted ml-auto">{entries.length} ENTRIES</span>
        )}
      </div>

      {/* ── FEEDBACK tab ─────────────────────────────────────────────────── */}
      {tab === 'FEEDBACK' && (
        <>
          <div className="bg-bg border-b border-border px-6 py-2 flex items-center gap-3 shrink-0 flex-wrap">
            {(['All', ...FEEDBACK_TOPICS] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`font-pixel text-[8px] border px-2 py-0.5 transition-none ${
                  filter === t
                    ? 'border-primary text-primary'
                    : 'border-border text-muted hover:border-secondary hover:text-secondary'
                }`}
              >
                {t}{t !== 'All' && counts[t] != null ? ` (${counts[t]})` : ''}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <p className="font-pixel text-[9px] text-muted tracking-wider">LOADING...</p>
            ) : displayed.length === 0 ? (
              <p className="font-pixel text-[9px] text-muted tracking-wider">NO ENTRIES</p>
            ) : (
              <div className="flex flex-col gap-3">
                {displayed.map((entry) => (
                  <div key={entry.id} className="border border-border bg-surface p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-4">
                      <span className={`font-pixel text-[8px] tracking-wider ${TOPIC_COLORS[entry.topic] ?? 'text-muted'}`}>
                        {entry.topic.toUpperCase()}
                      </span>
                      <span className="font-pixel text-[8px] text-muted ml-auto">{formatDate(entry.created_at)}</span>
                    </div>
                    <p className="text-xs text-text leading-relaxed whitespace-pre-wrap">{entry.message}</p>
                    {entry.contact && (
                      <p className="font-pixel text-[8px] text-secondary">
                        CONTACT: {entry.contact}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── COSTS tab ────────────────────────────────────────────────────── */}
      {tab === 'COSTS' && <CostsTab />}

    </div>
  )
}
