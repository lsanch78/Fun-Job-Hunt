import { useNavigate } from 'react-router-dom'

export default function MobileUnsupported() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6 px-8 text-center bg-background text-foreground">
      <div className="text-5xl">🖥️</div>
      <div>
        <p className="text-lg font-semibold">Desktop only</p>
        <p className="text-sm text-muted-foreground mt-1">
          This page isn't optimized for mobile. Open it on a larger screen for the full experience.
        </p>
      </div>
      <button
        onClick={() => navigate('/jobs')}
        className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground transition-colors"
      >
        Back to Jobs
      </button>
    </div>
  )
}
