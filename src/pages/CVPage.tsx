import { useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import CVCanvas from '@/components/cv/CVCanvas'
import { linkCuratedResumeToJob } from '@/services/jobService'
import { playNetworkMapClose } from '@/lib/sfx'
import type { CVCanvasHandle } from '@/types'

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
  const canvasRef = useRef<CVCanvasHandle>(null)

  const [curateActive, setCurateActive] = useState(false)
  const [previewActive, setPreviewActive] = useState(false)

  const state = (location.state as CVPageLocationState | null) ?? {}

  return (
    <div className="h-full bg-bg font-pixel text-primary scanlines flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 min-h-[100px]">
        <div>
          <h1 className="text-sm tracking-widest">CV</h1>
          <p className="text-muted text-xs mt-1">your master resume</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => canvasRef.current?.openAddSection()}
            className="text-[10px] px-3 py-1.5 border border-border text-muted hover:border-secondary hover:text-secondary transition-none"
          >
            ADD SECTION
          </button>
          <button
            onClick={() => canvasRef.current?.openCurate()}
            className={`text-[10px] px-3 py-1.5 border transition-none ${
              curateActive
                ? 'border-primary text-primary'
                : 'border-border text-muted hover:border-secondary hover:text-secondary'
            }`}
          >
            CURATE
          </button>
          <button
            onClick={() => canvasRef.current?.openPreview()}
            className={`text-[10px] px-3 py-1.5 border transition-none ${
              previewActive
                ? 'border-primary text-primary'
                : 'border-border text-muted hover:border-secondary hover:text-secondary'
            }`}
          >
            PREVIEW
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <CVCanvas
          ref={canvasRef}
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
          onCurateOpenChange={setCurateActive}
          onPreviewOpenChange={setPreviewActive}
        />
      </div>
    </div>
  )
}
