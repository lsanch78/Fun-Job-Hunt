import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/lib/ThemeContext'
import { SubscriptionProvider } from '@/lib/SubscriptionContext'
import { supabase } from '@/lib/supabase'
import AuthPage from '@/pages/AuthPage'
import AuthCallbackPage from '@/pages/AuthCallbackPage'
import JobLogPage from '@/pages/JobLogPage'
import StatsPage from '@/pages/StatsPage'
import SettingsPage from '@/pages/SettingsPage'
import StoryPage from '@/pages/StoryPage'
import CreditsPage from '@/pages/CreditsPage'
import DevPortalPage from '@/pages/DevPortalPage'
import NavBar from '@/components/shell/NavBar'
import QuickCast from '@/components/hud/QuickCast'
import WorkdayBar from '@/components/hud/WorkdayBar'
import ScratchPad from '@/components/hud/ScratchPad'
import type { Session } from '@supabase/supabase-js'
import { useIsMobile } from '@/hooks/useIsMobile'
import MobileJobLogPage from '@/pages/MobileJobLogPage'
import NetworkPage from '@/pages/NetworkPage'
import MobileNetworkPage from '@/pages/MobileNetworkPage'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import MobileUnsupported from '@/components/shell/MobileUnsupported'
import LandingPage from '@/pages/LandingPage'

const DEV_BYPASS = import.meta.env['VITE_DEV_BYPASS'] === 'true'

// Prefetch credits photos while the browser is idle so they're instant on arrival
const CREDITS_PHOTOS = ['/me1.webp', '/me2.webp', '/me3.webp']
function prefetchCreditsPhotos() {
  const cb = () => {
    CREDITS_PHOTOS.forEach((src) => {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.as = 'image'
      link.href = src
      document.head.appendChild(link)
    })
  }
  if ('requestIdleCallback' in window) {
    requestIdleCallback(cb, { timeout: 3000 })
  } else {
    setTimeout(cb, 2000)
  }
}

function ProtectedRoute({
  session,
  children,
}: {
  session: Session | null | undefined
  children: React.ReactNode
}) {
  const userId = session?.user?.id ?? null
  if (DEV_BYPASS) return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
      <ScratchPad userId={userId} />
      <QuickCast />
      <WorkdayBar userId={userId} inline />
    </div>
  )
  // undefined = still loading, null = no session
  if (session === undefined) return null
  if (!session) return <Navigate to="/auth" replace />
  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
      <ScratchPad userId={userId} />
      <QuickCast />
      <WorkdayBar userId={userId} inline />
    </div>
  )
}

function MobileGatedRoute({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileUnsupported />
  return <>{children}</>
}

function NetworkRoute({ session }: { session: Session | null | undefined }) {
  const isMobile = useIsMobile()
  const userId = session?.user?.id ?? null
  if (isMobile) return <MobileNetworkPage userId={userId} />
  return <NetworkPage userId={userId} />
}

function JobLogRoute({ session }: { session: Session | null | undefined }) {
  const isMobile = useIsMobile()
  const userId = session?.user?.id ?? null
  const userName =
    (session?.user?.user_metadata?.['username'] as string | undefined) ??
    null
  if (isMobile) return <MobileJobLogPage userId={userId} userName={userName} />
  return <JobLogPage userId={userId} userName={userName} />
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    prefetchCreditsPhotos()
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <ThemeProvider>
      <SubscriptionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/landing" element={session ? <Navigate to="/jobs" replace /> : <LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/" element={<Navigate to="/landing" replace />} />
          <Route
            path="/jobs"
            element={
              <ProtectedRoute session={session}>
                <JobLogRoute session={session} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/network"
            element={
              <ProtectedRoute session={session}>
                <NetworkRoute session={session} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute session={session}>
                <MobileGatedRoute>
                  <StatsPage userId={session?.user?.id ?? null} />
                </MobileGatedRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/story"
            element={
              <ProtectedRoute session={session}>
                <MobileGatedRoute>
                  <StoryPage userId={session?.user?.id ?? null} />
                </MobileGatedRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute session={session}>
                <MobileGatedRoute>
                  <SettingsPage />
                </MobileGatedRoute>
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
                <MobileGatedRoute>
                  <DevPortalPage />
                </MobileGatedRoute>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Analytics />
        <SpeedInsights />
      </BrowserRouter>
      </SubscriptionProvider>
    </ThemeProvider>
  )
}
