import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChange } from '@/services/authService'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    return onAuthStateChange((session) => {
      if (session) navigate('/', { replace: true })
    })
  }, [navigate])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center font-pixel scanlines">
      <p className="text-primary text-xs tracking-widest animate-blink">SIGNING IN...</p>
    </div>
  )
}
