import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => subscription.unsubscribe()
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function signInWithOtp(email: string, stayLoggedIn: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, data: { stayLoggedIn } },
  })
  return { error: error?.message ?? null }
}

export async function verifyOtp(email: string, token: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) return { error: error.message }
  await supabase.auth.refreshSession()
  return { error: null }
}

export async function signInWithIdToken(token: string, nonce?: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token,
    nonce,
  })
  return { error: error?.message ?? null }
}

export async function signInWithOAuth(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/auth/callback' },
  })
  return { error: error?.message ?? null }
}

export async function updateUsername(username: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ data: { username } })
  return { error: error?.message ?? null }
}
