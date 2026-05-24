import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/lib/ThemeContext'
import { supabase } from '@/lib/supabase'
import AuthPage from '@/pages/AuthPage'
import JobLogPage from '@/pages/JobLogPage'
import StatsPage from '@/pages/StatsPage'
import SettingsPage from '@/pages/SettingsPage'
import NavBar from '@/components/NavBar'
import WorkdayBar from '@/components/WorkdayBar'
import type { Session } from '@supabase/supabase-js'

const DEV_BYPASS = import.meta.env['VITE_DEV_BYPASS'] === 'true'

function ProtectedRoute({
  session,
  children,
}: {
  session: Session | null | undefined
  children: React.ReactNode
}) {
  if (DEV_BYPASS) return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <div className="flex-1 pb-12">{children}</div>
      <WorkdayBar />
    </div>
  )
  // undefined = still loading, null = no session
  if (session === undefined) return null
  if (!session) return <Navigate to="/auth" replace />
  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <div className="flex-1 pb-12">{children}</div>
      <WorkdayBar />
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<Navigate to="/jobs" replace />} />
          <Route
            path="/jobs"
            element={
              <ProtectedRoute session={session}>
                <JobLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute session={session}>
                <StatsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute session={session}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
