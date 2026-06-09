import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import { useCvIsEmpty } from '@/hooks/cv/useCvIsEmpty'

interface Props {
  userId: string
}

export default function CvNudge({ userId }: Props) {
  const navigate = useNavigate()
  const isEmpty = useCvIsEmpty(userId)
  const [dismissed, setDismissed] = useState(() => lsGet<boolean>(SK.cvNudgeDismissed(userId), false))

  if (dismissed || isEmpty === null || !isEmpty) return null

  function dismiss() {
    lsSet(SK.cvNudgeDismissed(userId), true)
    setDismissed(true)
  }

  return (
    <div className="px-6 py-3 border-b border-border bg-surface font-pixel text-xs flex items-center gap-4">
      <div className="flex flex-col gap-0.5 flex-1">
        <span className="text-primary tracking-widest text-[10px]">BUILD YOUR CV FIRST</span>
        <span className="text-muted text-[10px] leading-relaxed">
          Leverage AI to build tailored resumes, cover letters, outreach drafts. The better your CV, the better your results.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => navigate('/cv')}
          className="text-[10px] px-3 py-1.5 border border-primary text-primary hover:bg-primary hover:text-bg transition-none"
        >
          GO TO CV
        </button>
        <button
          onClick={dismiss}
          className="text-[10px] text-muted hover:text-primary transition-none"
          title="Dismiss"
        >
          X
        </button>
      </div>
    </div>
  )
}
