import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(() => {
      navigate('/', { replace: true })
    })
  }, [navigate])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center font-pixel scanlines">
      <p className="text-primary text-xs tracking-widest animate-blink">SIGNING IN...</p>
    </div>
  )
}
