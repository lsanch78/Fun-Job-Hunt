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
  )
}
