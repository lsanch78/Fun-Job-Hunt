import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/lib/ThemeContext'
import { supabase } from '@/lib/supabase'
import AuthPage from '@/pages/AuthPage'
import AuthCallbackPage from '@/pages/AuthCallbackPage'
import JobLogPage from '@/pages/JobLogPage'
import StatsPage from '@/pages/StatsPage'
import SettingsPage from '@/pages/SettingsPage'
import StoryPage from '@/pages/StoryPage'
import CreditsPage from '@/pages/CreditsPage'
import DevPortalPage from '@/pages/DevPortalPage'
import NavBar from '@/components/NavBar'
import QuickCast from '@/components/QuickCast'
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
    <div className="flex flex-col h-screen">
      <NavBar />
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
      <QuickCast />
      <WorkdayBar inline />
    </div>
  )
  // undefined = still loading, null = no session
  if (session === undefined) return null
  if (!session) return <Navigate to="/auth" replace />
  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
      <QuickCast />
      <WorkdayBar inline />
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
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/" element={<Navigate to="/jobs" replace />} />
          <Route
            path="/jobs"
            element={
              <ProtectedRoute session={session}>
                <JobLogPage
                  userId={session?.user?.id ?? null}
                  userName={
                    (session?.user?.user_metadata?.['username'] as string | undefined) ??
                    session?.user?.email?.split('@')[0] ??
                    null
                  }
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute session={session}>
                <StatsPage userId={session?.user?.id ?? null} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/story"
            element={
              <ProtectedRoute session={session}>
                <StoryPage userId={session?.user?.id ?? null} />
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
          <Route
            path="/credits"
            element={
              <ProtectedRoute session={session}>
                <CreditsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dev"
            element={
              <ProtectedRoute session={session}>
                <DevPortalPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
