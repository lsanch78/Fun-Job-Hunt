import { useAuthCallback } from '@/hooks/auth/useAuthCallback'

export default function AuthCallbackPage() {
  useAuthCallback()

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center font-pixel scanlines">
      <p className="text-primary text-xs tracking-widest animate-blink">SIGNING IN...</p>
    </div>
  )
}
