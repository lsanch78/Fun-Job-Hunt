import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChange } from '@/services/authService'

export function useAuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    return onAuthStateChange((session) => {
      if (session) navigate('/', { replace: true })
    })
  }, [navigate])
}
