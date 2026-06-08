import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import CVCanvas from '@/components/cv/CVCanvas'
import { linkCuratedResumeToJob } from '@/services/jobService'
import { playNetworkMapClose } from '@/lib/sfx'

interface CVPageLocationState {
  initialCurateText?: string | null
  initialCuratedResumeId?: string | null
  initialOpenCuratePanel?: boolean
  initialCompany?: string | null
  initialJobId?: string | null
}

export default function CVPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userId, username } = useAuth()

  const state = (location.state as CVPageLocationState | null) ?? {}

  return (
    <div className="h-full bg-bg font-pixel text-primary scanlines flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 min-h-[100px]">
        <div>
          <h1 className="text-sm tracking-widest">CV</h1>
          <p className="text-muted text-xs mt-1">your master resume</p>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <CVCanvas
          userName={username ?? null}
          userId={userId}
          initialCurateText={state.initialCurateText ?? null}
          initialCuratedResumeId={state.initialCuratedResumeId ?? null}
          initialOpenCuratePanel={state.initialOpenCuratePanel ?? false}
          initialCompany={state.initialCompany ?? null}
          initialJobId={state.initialJobId ?? null}
          onResumeSaved={(jobId, resumeId) => linkCuratedResumeToJob(jobId, resumeId)}
          onClose={() => { playNetworkMapClose(); navigate('/jobs') }}
          onInitialCurateConsumed={() => navigate(location.pathname, { replace: true, state: null })}
        />
      </div>
    </div>
  )
}
