import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getSession, onAuthStateChange } from '@/services/authService'
import type { Session } from '@supabase/supabase-js'

interface AuthContextValue {
  session: Session | null | undefined
  userId: string | null
  username: string
  email: string | null
}

const AuthContext = createContext<AuthContextValue>({
  session: undefined,
  userId: null,
  username: '',
  email: null,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    getSession().then(setSession)
    return onAuthStateChange(setSession)
  }, [])

  const userId   = session?.user?.id ?? null
  const username = (session?.user?.user_metadata?.['username'] as string | undefined) ?? ''
  const email    = session?.user?.email ?? null

  return (
    <AuthContext.Provider value={{ session, userId, username, email }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
