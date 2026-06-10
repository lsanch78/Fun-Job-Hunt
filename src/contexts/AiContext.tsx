import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { streamCompletion, fetchModels, fetchUsage, getAiProvider, setAiProvider as writeAiProvider } from '@/services/aiService'
import { createCheckoutSession } from '@/services/subscriptionService'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { playAiConsume } from '@/lib/sfx'
import { PRO_UPGRADE_CTA } from '@/config/pricing'
import type { AiPhase, AiProvider, RunParams } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type Usage = { count: number; limit: number; period: string }

interface AiContextValue {
  run: (params: RunParams) => Promise<void>
  cancel: () => void
  reset: () => void
  phase: AiPhase
  dots: number
  statusLabel: string
  streaming: boolean
  aiProvider: AiProvider
  setProvider: (p: AiProvider) => void
  usage: Usage | null
  refreshUsage: () => Promise<void>
}

// ── Context ───────────────────────────────────────────────────────────────────

const AiContext = createContext<AiContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function AiProvider({ children }: { children: ReactNode }) {
  const { isSubscribed } = useSubscription()

  const [phase, setPhase] = useState<AiPhase>('idle')
  const [dots, setDots]   = useState(0)
  const abortRef          = useRef<AbortController | null>(null)

  const [limitPopupVisible, setLimitPopupVisible] = useState(false)
  const [usageSnapshot, setUsageSnapshot]         = useState<Usage | null>(null)

  const [aiProvider, setAiProviderState] = useState<AiProvider>(() => getAiProvider())
  const [usage, setUsage]                = useState<Usage | null>(null)

  const refreshUsage = useCallback(async () => {
    if (aiProvider !== 'proxy') { setUsage(null); return }
    const u = await fetchUsage()
    setUsage(u)
  }, [aiProvider])

  useEffect(() => { refreshUsage() }, [refreshUsage])

  const setProvider = useCallback((p: AiProvider) => {
    writeAiProvider(p)
    setAiProviderState(p)
  }, [])

  useEffect(() => {
    if (phase !== 'generating') return
    const id = setInterval(() => setDots((d) => (d + 1) % 3), 500)
    return () => clearInterval(id)
  }, [phase])

  const run = useCallback(async ({ system, prompt, onComplete, onError, model: modelOverride }: RunParams) => {
    if (phase === 'generating') return

    const { connected, models } = fetchModels()
    if (!connected) {
      onError?.('AI not configured. Add an API key in Settings.')
      return
    }

    abortRef.current = new AbortController()
    setPhase('generating')
    setDots(0)
    playAiConsume()

    let accumulated = ''

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const systemWithDate = `Today's date is ${today}. Use this to correctly determine whether dates are in the past or future.\n\n${system}`

    await streamCompletion({
      model: modelOverride ?? models[0],
      system: systemWithDate,
      prompt,
      signal: abortRef.current.signal,
      onToken: (token) => { accumulated += token },
      onDone: () => {
        setPhase('ready')
        onComplete(accumulated)
        refreshUsage()
        setTimeout(() => setPhase('idle'), 2500)
      },
      onError: (msg) => {
        setPhase('idle')
        const isLimitError = msg.includes('Monthly limit') || msg.includes('limit reached')
        if (isLimitError && aiProvider === 'proxy' && !isSubscribed) {
          fetchUsage().then((u) => { if (u) { setUsageSnapshot(u); setUsage(u) } })
          setLimitPopupVisible(true)
        }
        onError?.(msg)
      },
    })
  }, [phase, isSubscribed, aiProvider, refreshUsage])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setPhase('idle')
  }, [])

  const reset = useCallback(() => {
    setPhase('idle')
    setDots(0)
  }, [])

  const statusLabel =
    phase === 'generating' ? `GEN${'.'.repeat(dots + 1)}${'  '.repeat(2 - dots)}`
    : phase === 'ready'    ? '● READY'
    :                        '● ON'

  return (
    <AiContext.Provider value={{
      run, cancel, reset, phase, dots, statusLabel, streaming: phase === 'generating',
      aiProvider, setProvider, usage, refreshUsage,
    }}>
      {children}
      {limitPopupVisible && (
        <AiLimitModal
          usageSnapshot={usageSnapshot}
          onClose={() => setLimitPopupVisible(false)}
        />
      )}
    </AiContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAI(): AiContextValue {
  const ctx = useContext(AiContext)
  if (!ctx) throw new Error('useAI must be used within AiProvider')
  return ctx
}

// ── Limit modal ───────────────────────────────────────────────────────────────

function AiLimitModal({
  usageSnapshot,
  onClose,
}: {
  usageSnapshot: { count: number; limit: number; period: string } | null
  onClose: () => void
}) {
  // Derive reset date: first day of the month after `period` (YYYY-MM)
  const resetLabel = usageSnapshot
    ? (() => {
        const [y, m] = usageSnapshot.period.split('-').map(Number)
        const next = new Date(y, m, 1) // month is 0-indexed; m is already next month index
        return next.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      })()
    : null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          padding: '32px 36px',
          minWidth: 340,
          maxWidth: 420,
          fontFamily: '"Press Start 2P", monospace',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 14,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-muted)', fontSize: 11, fontFamily: 'inherit',
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        {/* Title */}
        <div style={{ color: 'var(--color-warning)', fontSize: 10, letterSpacing: '0.15em', marginBottom: 20 }}>
          AI LIMIT REACHED
        </div>

        {/* Usage */}
        {usageSnapshot && (
          <div style={{ color: 'var(--color-muted)', fontSize: 8, letterSpacing: '0.1em', lineHeight: 2, marginBottom: 20 }}>
            <div>
              <span style={{ color: 'var(--color-primary)' }}>{usageSnapshot.count}</span>
              <span> / {usageSnapshot.limit} requests used this month</span>
            </div>
            {resetLabel && (
              <div>Credits reset on <span style={{ color: 'var(--color-primary)' }}>{resetLabel}</span></div>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{ color: 'var(--color-muted)', fontSize: 8, letterSpacing: '0.08em', lineHeight: 2, marginBottom: 24 }}>
          Upgrade to Pro for unlimited AI requests, or add your own API key in Settings.
        </div>

        {/* CTA */}
        <button
          onClick={() => { createCheckoutSession().catch(() => {}); onClose() }}
          style={{
            width: '100%',
            fontFamily: 'inherit',
            fontSize: 9,
            letterSpacing: '0.12em',
            color: 'var(--color-surface)',
            background: 'var(--color-primary)',
            border: '1px solid var(--color-primary)',
            padding: '10px 0',
            cursor: 'pointer',
          }}
        >
          {PRO_UPGRADE_CTA}
        </button>
      </div>
    </div>
  )
}
