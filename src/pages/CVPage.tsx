import { useRef, useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import CVCanvas from '@/components/cv/CVCanvas'
import { linkTailoredResumeToJob } from '@/services/jobService'
import { playNetworkMapClose } from '@/lib/sfx'
import { registerTutorialTrigger, unregisterTutorialTrigger, broadcastTutorialActive } from '@/lib/tutorialBus'
import TutorialModal from '@/components/modals/TutorialModal'
import { CV_STEPS } from '@/lib/tutorialSteps'
import type { CVCanvasHandle } from '@/types'

interface CVPageLocationState {
  initialTailorText?: string | null
  initialTailoredResumeId?: string | null
  initialCompany?: string | null
  initialJobId?: string | null
}

export default function CVPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { userId, username } = useAuth()
  const canvasRef = useRef<CVCanvasHandle>(null)

  const [previewActive, setPreviewActive] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)

  const state = (location.state as CVPageLocationState | null) ?? {}

  useEffect(() => {
    registerTutorialTrigger(() => setShowTutorial(true))
    return () => { unregisterTutorialTrigger() }
  }, [])

  useEffect(() => { broadcastTutorialActive(showTutorial) }, [showTutorial])

  useEffect(() => {
    if (searchParams.get('tutorial') === '1') {
      setShowTutorial(true)
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full bg-bg font-pixel text-primary scanlines flex flex-col overflow-hidden">

      {/* Header */}
      <div data-tutorial="cv-header" className="px-6 py-4 short:py-2 border-b border-border flex items-center justify-between gap-4 min-h-[100px] short:min-h-[48px]">
        <div>
          <h1 className="text-sm tracking-widest">CV</h1>
          <p className="text-muted text-xs mt-1">your master resume</p>
        </div>
        <div className="flex items-center gap-2">
          {!previewActive && (
            <button
              onClick={() => canvasRef.current?.openAddSection()}
              className="text-[10px] px-3 py-1.5 border border-border text-muted hover:border-secondary hover:text-secondary transition-none"
            >
              ADD SECTION
            </button>
          )}
          <button
            onClick={() => canvasRef.current?.openPreview()}
            className={`text-[10px] px-3 py-1.5 border transition-none ${
              previewActive
                ? 'border-primary text-primary'
                : 'border-border text-muted hover:border-secondary hover:text-secondary'
            }`}
          >
            {previewActive ? 'EDIT' : 'PREVIEW'}
          </button>
        </div>
      </div>

      {/* Tutorial overlay */}
      {showTutorial && userId && <TutorialModal steps={CV_STEPS} screen="cv" userId={userId} onDone={() => setShowTutorial(false)} />}

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <CVCanvas
          ref={canvasRef}
          userName={username ?? null}
          userId={userId}
          initialTailorText={state.initialTailorText ?? null}
          initialTailoredResumeId={state.initialTailoredResumeId ?? null}
          initialCompany={state.initialCompany ?? null}
          initialJobId={state.initialJobId ?? null}
          onResumeSaved={(jobId, resumeId) => linkTailoredResumeToJob(jobId, resumeId)}
          onClose={() => { playNetworkMapClose(); navigate('/jobs') }}
          onInitialTailorConsumed={() => navigate(location.pathname, { replace: true, state: null })}
          onPreviewOpenChange={setPreviewActive}
        />
      </div>
    </div>
  )
}
