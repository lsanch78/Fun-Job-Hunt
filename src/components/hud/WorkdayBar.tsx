import { useState, useEffect } from 'react'
import { useActivityTimer } from '@/hooks/stats/useActivityTimer'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useAI } from '@/contexts/AiContext'
import { createCheckoutSession } from '@/services/subscriptionService'

function formatClock(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function WorkdayBar({
  userId,
  inline = false,
}: {
  userId: string | null
  inline?: boolean
}) {
  const [now, setNow] = useState(() => new Date())
  const { sessionStart, isActive } = useActivityTimer(userId)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsedMs = sessionStart ? now.getTime() - sessionStart.getTime() : 0

  return (
    <div
      data-tutorial="workday-bar"
      className={
        inline
          ? 'bg-surface border-b border-border font-pixel'
          : 'fixed bottom-0 left-0 right-0 z-[9990] bg-surface border-t border-border font-pixel'
      }
    >
      <div className="flex items-center gap-6 px-6 py-2 text-xs">

        {/* Live clock */}
        <div className="flex flex-col gap-0.5 min-w-[96px]">
          <span className="text-muted text-[8px] tracking-widest">TIME</span>
          <span className="text-primary tabular-nums text-[11px]">{formatClock(now)}</span>
        </div>

        <div className="h-8 w-px bg-border" />

        {/* Shift elapsed */}
        <div className="flex flex-col gap-0.5 min-w-[100px]">
          <span className="text-muted text-[8px] tracking-widest">SHIFT</span>
          <span className={`tabular-nums text-[11px] ${sessionStart ? 'text-primary' : 'text-muted'}`}>
            {sessionStart ? formatElapsed(elapsedMs) : '--:--:--'}
          </span>
        </div>

        {/* Activity status */}
        {sessionStart && (
          <>
            <div className="h-8 w-px bg-border" />
            <ActivityStatus isActive={isActive} />
          </>
        )}

        {/* AI credits — pushed to the right end */}
        <AiCredits />

      </div>
    </div>
  )
}

function ActivityStatus({ isActive }: { isActive: boolean }) {
  const [dots, setDots] = useState(0)

  useEffect(() => {
    if (!isActive) return
    const id = setInterval(() => setDots((d) => (d + 1) % 4), 500)
    return () => clearInterval(id)
  }, [isActive])

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted text-[8px] tracking-widest">STATUS</span>
      <span className={`text-[9px] inline-block w-[92px] ${isActive ? 'text-primary' : 'text-warning'}`}>
        {isActive ? `TRACKING${'.'.repeat(dots)}` : 'IDLE'}
      </span>
    </div>
  )
}

export function AiCredits() {
  const { isSubscribed, loading: subLoading } = useSubscription()
  const { aiProvider, usage } = useAI()

  if (aiProvider !== 'proxy') return null

  return (
    <>
      <div className="h-8 w-px bg-border" />
      <div className="flex flex-col gap-0.5 ml-auto">
                {subLoading ? (
          <span className="text-muted text-[9px]">--</span>
        ) : isSubscribed ? (
          <span className="text-secondary text-[9px]">Unlimited AI Credits</span>
        ) : usage ? (
          usage.count >= usage.limit ? (
            <span className="text-warning text-[9px]">
              No AI Credits Remaining,{' '}
              <button
                onClick={() => createCheckoutSession().catch(() => {})}
                className="underline cursor-pointer bg-transparent border-none p-0 font-pixel text-warning text-[9px]"
              >
                Upgrade To Pro
              </button>
            </span>
          ) : (
            <span className="text-primary text-[9px]">{usage.limit - usage.count} AI Credits Remaining</span>
          )
        ) : (
          <span className="text-muted text-[9px]">--</span>
        )}
      </div>
    </>
  )
}
