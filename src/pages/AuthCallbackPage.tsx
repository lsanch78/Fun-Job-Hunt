import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Supabase OAuth popup callback page.
 * Supabase exchanges the `code` param automatically on load via its internal
 * detectSessionInUrl logic. We just need this page to exist so the popup lands
 * here, the session is written to localStorage, and the parent window's
 * onAuthStateChange fires. Then we close the popup.
 */
export default function AuthCallbackPage() {
  useEffect(() => {
    supabase.auth.getSession().then(() => {
      // Session is now set — close the popup so the parent can take over
      window.close()
    })
  }, [])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center font-pixel scanlines">
      <p className="text-primary text-xs tracking-widest animate-blink">SIGNING IN...</p>
    </div>
  )
}
