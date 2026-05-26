const STORAGE_KEY = 'fjobhunt:sfx:muted'

export function isSfxMuted(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
}

export function setSfxMuted(muted: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, muted ? 'true' : 'false') } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('fjobhunt:sfx-muted-change', { detail: muted }))
}

export function toggleSfxMuted(): boolean {
  const next = !isSfxMuted()
  setSfxMuted(next)
  return next
}

/** Subscribe to mute-state changes across the app. Returns an unsubscribe fn. */
export function onSfxMutedChange(cb: (muted: boolean) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<boolean>).detail)
  window.addEventListener('fjobhunt:sfx-muted-change', handler)
  return () => window.removeEventListener('fjobhunt:sfx-muted-change', handler)
}
