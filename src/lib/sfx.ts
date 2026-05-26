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

/** Rising three-note boot blip (220 → 440 → 880 Hz). */
export function playBootBlip(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const schedule = () => {
      ;[
        { freq: 220, t: 0,    dur: 0.06, vol: 0.022 },
        { freq: 440, t: 0.07, dur: 0.05, vol: 0.018 },
        { freq: 880, t: 0.13, dur: 0.12, vol: 0.015 },
      ].forEach(({ freq, t, dur, vol }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + t)
        gain.gain.setValueAtTime(0, ctx.currentTime + t)
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + t + 0.005)
        gain.gain.setValueAtTime(vol, ctx.currentTime + t + dur - 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur)
        osc.connect(gain); gain.connect(ctx.destination)
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + dur + 0.01)
      })
    }
    ctx.resume().then(schedule)
  } catch { /* blocked */ }
}

/** Falling three-note exit blip (880 → 440 → 220 Hz). */
export function playExitBlip(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    ;[
      { freq: 880, t: 0,    dur: 0.06, vol: 0.030 },
      { freq: 440, t: 0.07, dur: 0.05, vol: 0.028 },
      { freq: 220, t: 0.13, dur: 0.12, vol: 0.026 },
    ].forEach(({ freq, t, dur, vol }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + t)
      gain.gain.setValueAtTime(0, ctx.currentTime + t)
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + t + 0.005)
      gain.gain.setValueAtTime(vol, ctx.currentTime + t + dur - 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + dur + 0.01)
    })
  } catch { /* blocked */ }
}
