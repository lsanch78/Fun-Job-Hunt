import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import AuthPage from '@/pages/AuthPage'
import AuthCallbackPage from '@/pages/AuthCallbackPage'
import JobLogPage from '@/pages/JobLogPage'
import StatsPage from '@/pages/StatsPage'
import SettingsPage from '@/pages/SettingsPage'
import CreditsPage from '@/pages/CreditsPage'
import DevPortalPage from '@/pages/DevPortalPage'
import NavBar from '@/components/shell/NavBar'
import QuickCast from '@/components/hud/QuickCast'
import WorkdayBar from '@/components/hud/WorkdayBar'
import Journal from '@/components/hud/Journal'
import { useIsMobile } from '@/hooks/useIsMobile'
import MobileJobLogPage from '@/pages/MobileJobLogPage'
import NetworkPage from '@/pages/NetworkPage'
import MobileNetworkPage from '@/pages/MobileNetworkPage'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import MobileUnsupported from '@/components/shell/MobileUnsupported'
import LandingPage from '@/pages/LandingPage'
import CVPage from '@/pages/CVPage'

const DEV_BYPASS = import.meta.env['VITE_DEV_BYPASS'] === 'true'


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, userId } = useAuth()
  if (DEV_BYPASS) return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
      <Journal userId={userId} />
      <QuickCast />
      <WorkdayBar userId={userId} inline />
    </div>
  )
  if (session === undefined) return null
  if (!session) return <Navigate to="/auth" replace />
  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
      <Journal userId={userId} />
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

function NetworkRoute() {
  const { userId } = useAuth()
  const isMobile = useIsMobile()
  if (isMobile) return <MobileNetworkPage userId={userId} />
  return <NetworkPage userId={userId} />
}

function JobLogRoute() {
  const { userId, username } = useAuth()
  const isMobile = useIsMobile()
  if (isMobile) return <MobileJobLogPage userId={userId} userName={username || null} />
  return <JobLogPage userId={userId} userName={username || null} />
}

function AppRoutes() {
  const { session } = useAuth()

  useEffect(() => {
    const photos = ['/me1.webp', '/me2.webp', '/me3.webp']
    const cb = () => photos.forEach((src) => {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.as = 'image'
      link.href = src
      document.head.appendChild(link)
    })
    if ('requestIdleCallback' in window) requestIdleCallback(cb, { timeout: 3000 })
    else setTimeout(cb, 2000)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={session ? <Navigate to="/jobs" replace /> : <LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="/jobs" element={<ProtectedRoute><JobLogRoute /></ProtectedRoute>} />
        <Route path="/network" element={<ProtectedRoute><NetworkRoute /></ProtectedRoute>} />
        <Route
          path="/stats"
          element={
            <ProtectedRoute>
              <MobileGatedRoute>
                <StatsPage userId={session?.user?.id ?? null} />
              </MobileGatedRoute>
            </ProtectedRoute>
          }
        />
        <Route path="/settings" element={<ProtectedRoute><MobileGatedRoute><SettingsPage /></MobileGatedRoute></ProtectedRoute>} />
        <Route path="/credits" element={<ProtectedRoute><CreditsPage /></ProtectedRoute>} />
        <Route path="/dev" element={<ProtectedRoute><MobileGatedRoute><DevPortalPage /></MobileGatedRoute></ProtectedRoute>} />
        <Route path="/cv" element={<ProtectedRoute><MobileGatedRoute><CVPage /></MobileGatedRoute></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <AppRoutes />
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
