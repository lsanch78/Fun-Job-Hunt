// ── Mute state ────────────────────────────────────────────────────────────────

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

// ── Internal helpers ──────────────────────────────────────────────────────────

function squareNotes(notes: { freq: number; t: number; dur: number; vol: number }[]): void {
  const ctx = new AudioContext()
  const last = notes.reduce((max, n) => Math.max(max, n.t + n.dur), 0)
  notes.forEach(({ freq, t, dur, vol }) => {
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
  setTimeout(() => ctx.close(), (last + 0.1) * 1000)
}

// ── WorkdayBar ────────────────────────────────────────────────────────────────

/** Clock tick-tock punch-in sound. */
export function playPunchIn(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const sr = ctx.sampleRate
    function makeTick(t: number, highPitch: boolean) {
      const bufLen = Math.ceil(sr * 0.012)
      const buf = ctx.createBuffer(1, bufLen, sr)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
      const src = ctx.createBufferSource()
      src.buffer = buf
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = highPitch ? 3200 : 2000
      bp.Q.value = 3.5
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.28, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.012)
      src.connect(bp); bp.connect(gain); gain.connect(ctx.destination)
      src.start(t); src.stop(t + 0.015)
    }
    makeTick(ctx.currentTime,        false)
    makeTick(ctx.currentTime + 0.18, true)
  } catch { /* AudioContext blocked */ }
}

/** Punch-out stamp + paper slide. */
export function playPunchOut(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const sr = ctx.sampleRate
    const now = ctx.currentTime

    const thudOsc = ctx.createOscillator()
    const thudGain = ctx.createGain()
    thudOsc.type = 'sine'
    thudOsc.frequency.setValueAtTime(75, now)
    thudOsc.frequency.exponentialRampToValueAtTime(32, now + 0.10)
    thudGain.gain.setValueAtTime(0.6, now)
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    thudOsc.connect(thudGain); thudGain.connect(ctx.destination)
    thudOsc.start(now); thudOsc.stop(now + 0.14)

    const crackBuf = ctx.createBuffer(1, Math.ceil(sr * 0.06), sr)
    const cd = crackBuf.getChannelData(0)
    for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1
    const crackSrc = ctx.createBufferSource()
    crackSrc.buffer = crackBuf
    const crackHpf = ctx.createBiquadFilter()
    crackHpf.type = 'bandpass'; crackHpf.frequency.value = 1800; crackHpf.Q.value = 0.7
    const crackGain = ctx.createGain()
    crackGain.gain.setValueAtTime(0.25, now)
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    crackSrc.connect(crackHpf); crackHpf.connect(crackGain); crackGain.connect(ctx.destination)
    crackSrc.start(now); crackSrc.stop(now + 0.06)

    const slideDur = 0.28
    const slideBuf = ctx.createBuffer(1, Math.ceil(sr * slideDur), sr)
    const sd = slideBuf.getChannelData(0)
    for (let i = 0; i < sd.length; i++) sd[i] = Math.random() * 2 - 1
    const slideSrc = ctx.createBufferSource()
    slideSrc.buffer = slideBuf; slideSrc.playbackRate.value = 0.6
    const slideLpf = ctx.createBiquadFilter()
    slideLpf.type = 'lowpass'; slideLpf.frequency.value = 800
    const slideGain = ctx.createGain()
    const slideStart = now + 0.08
    slideGain.gain.setValueAtTime(0, slideStart)
    slideGain.gain.linearRampToValueAtTime(0.09, slideStart + 0.05)
    slideGain.gain.exponentialRampToValueAtTime(0.001, slideStart + slideDur)
    slideSrc.connect(slideLpf); slideLpf.connect(slideGain); slideGain.connect(ctx.destination)
    slideSrc.start(slideStart); slideSrc.stop(slideStart + slideDur)
  } catch { /* AudioContext blocked */ }
}

// ── JobLogPage ────────────────────────────────────────────────────────────────

/** Two ascending notes: G4 → B4. Status upgrade chime (Phone Screen / Interview). */
export function playProgressChime(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const notes = [392.00, 493.88]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.connect(gain); gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.14
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.09, t + 0.03)
      gain.gain.setValueAtTime(0.09, t + 0.14)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
      osc.start(t); osc.stop(t + 0.45)
    })
  } catch { /* AudioContext blocked */ }
}

/** Offer celebration fanfare: C5 → E5 → G5 → E5 → C6. */
export function playCelebrationFanfare(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const notes = [523.25, 659.25, 783.99, 659.25, 1046.5]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.connect(gain); gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.13
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.04, t + 0.02)
      gain.gain.setValueAtTime(0.04, t + 0.11)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
      osc.start(t); osc.stop(t + 0.55)
    })
  } catch { /* AudioContext blocked */ }
}

/** Keyboard thud on job add. Pass `mega: true` for delete-mode multi-select. */
export function playThud(mega = false): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const keyCount = mega ? 14 : 7
    const spacing  = mega ? 0.045 : 0.055
    for (let i = 0; i < keyCount; i++) {
      const t = ctx.currentTime + i * spacing + Math.random() * 0.015
      const bufLen = ctx.sampleRate * 0.025
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let s = 0; s < bufLen; s++) data[s] = Math.random() * 2 - 1
      const src = ctx.createBufferSource(); src.buffer = buf
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'; bp.frequency.value = 1000 + Math.random() * 5200; bp.Q.value = 1.2
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(mega ? 0.28 : 0.22, t + 0.002)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.022)
      src.connect(bp); bp.connect(gain); gain.connect(ctx.destination)
      src.start(t); src.stop(t + 0.03)
    }
  } catch { /* AudioContext blocked */ }
}

/** Low sub-bass thud for entering delete mode. */
export function playDeleteBump(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(90, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.18)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25)
    const bufLen = ctx.sampleRate * 0.012
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(); src.buffer = buf
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800
    const clickGain = ctx.createGain()
    clickGain.gain.setValueAtTime(0.3, ctx.currentTime)
    clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.012)
    src.connect(lp); lp.connect(clickGain); clickGain.connect(ctx.destination)
    src.start(ctx.currentTime); src.stop(ctx.currentTime + 0.015)
  } catch { /* AudioContext blocked */ }
}

/** Palatal click for checkbox select. */
export function playSelectClick(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const t = ctx.currentTime
    const bufLen = Math.ceil(ctx.sampleRate * 0.018)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(); src.buffer = buf
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 2.2
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.18, t + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.018)
    src.connect(bp); bp.connect(gain); gain.connect(ctx.destination)
    src.start(t); src.stop(t + 0.02)
  } catch { /* AudioContext blocked */ }
}

/** Scratch pad drawer opening — rising noise slide. */
export function playScratchOpen(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const t0 = ctx.currentTime
    const slideLen = ctx.sampleRate * 0.18
    const slideBuf = ctx.createBuffer(1, slideLen, ctx.sampleRate)
    const slideData = slideBuf.getChannelData(0)
    for (let i = 0; i < slideLen; i++) slideData[i] = Math.random() * 2 - 1
    const slideSrc = ctx.createBufferSource(); slideSrc.buffer = slideBuf
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
    bp.frequency.setValueAtTime(400, t0); bp.frequency.linearRampToValueAtTime(1800, t0 + 0.18); bp.Q.value = 1.5
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t0); gain.gain.linearRampToValueAtTime(0.12, t0 + 0.02)
    gain.gain.setValueAtTime(0.12, t0 + 0.14); gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18)
    slideSrc.connect(bp); bp.connect(gain); gain.connect(ctx.destination)
    slideSrc.start(t0); slideSrc.stop(t0 + 0.19)
  } catch { /* AudioContext blocked */ }
}

/** Scratch pad drawer closing — falling noise slide. */
export function playScratchClose(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const t0 = ctx.currentTime
    const slideLen = ctx.sampleRate * 0.16
    const slideBuf = ctx.createBuffer(1, slideLen, ctx.sampleRate)
    const slideData = slideBuf.getChannelData(0)
    for (let i = 0; i < slideLen; i++) slideData[i] = Math.random() * 2 - 1
    const slideSrc = ctx.createBufferSource(); slideSrc.buffer = slideBuf
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
    bp.frequency.setValueAtTime(1600, t0); bp.frequency.linearRampToValueAtTime(300, t0 + 0.16); bp.Q.value = 1.5
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.10, t0); gain.gain.linearRampToValueAtTime(0.02, t0 + 0.14)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16)
    slideSrc.connect(bp); bp.connect(gain); gain.connect(ctx.destination)
    slideSrc.start(t0); slideSrc.stop(t0 + 0.17)
  } catch { /* AudioContext blocked */ }
}

/** Trash delete whoosh. `count` scales the duration. */
export function playTrash(count = 1): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const duration = Math.min(0.08 + count * 0.04, 0.55)
    const bufLen = Math.ceil(ctx.sampleRate * duration)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(); src.buffer = buf
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'
    hp.frequency.setValueAtTime(3200, ctx.currentTime)
    hp.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.22, ctx.currentTime)
    gain.gain.setValueAtTime(0.22, ctx.currentTime + duration * 0.6)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    src.connect(hp); hp.connect(gain); gain.connect(ctx.destination)
    src.start(ctx.currentTime); src.stop(ctx.currentTime + duration + 0.01)
    const crunch = ctx.createOscillator(); crunch.type = 'sawtooth'
    const t0 = ctx.currentTime + duration * 0.5
    crunch.frequency.setValueAtTime(220, t0); crunch.frequency.exponentialRampToValueAtTime(55, t0 + duration * 0.5)
    const crunchGain = ctx.createGain()
    crunchGain.gain.setValueAtTime(0.06, t0); crunchGain.gain.exponentialRampToValueAtTime(0.001, t0 + duration * 0.5)
    crunch.connect(crunchGain); crunchGain.connect(ctx.destination)
    crunch.start(t0); crunch.stop(t0 + duration * 0.5 + 0.01)
  } catch { /* AudioContext blocked */ }
}

// ── AppDetailCard ─────────────────────────────────────────────────────────────

/** Rising three-note boot blip (220 → 440 → 880 Hz). */
export function playBootBlip(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const schedule = () => squareNotes([
      { freq: 220, t: 0,    dur: 0.06, vol: 0.022 },
      { freq: 440, t: 0.07, dur: 0.05, vol: 0.018 },
      { freq: 880, t: 0.13, dur: 0.12, vol: 0.015 },
    ])
    ctx.resume().then(schedule)
  } catch { /* AudioContext blocked */ }
}

/** Falling three-note exit blip (880 → 440 → 220 Hz). */
export function playExitBlip(): void {
  if (isSfxMuted()) return
  try {
    squareNotes([
      { freq: 880, t: 0,    dur: 0.06, vol: 0.030 },
      { freq: 440, t: 0.07, dur: 0.05, vol: 0.028 },
      { freq: 220, t: 0.13, dur: 0.12, vol: 0.026 },
    ])
  } catch { /* AudioContext blocked */ }
}

/** Short typewriter-style navigation click. `dir` controls pitch (forward = higher). */
export function playConsoleBlip(dir: 'forward' | 'back' = 'forward'): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const freq = dir === 'forward' ? 660 : 440
    const clickBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.018), ctx.sampleRate)
    const cd = clickBuf.getChannelData(0)
    for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(); src.buffer = clickBuf
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.5
    const cGain = ctx.createGain()
    cGain.gain.setValueAtTime(0.18, ctx.currentTime); cGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.018)
    src.connect(bp); bp.connect(cGain); cGain.connect(ctx.destination)
    src.start(ctx.currentTime); src.stop(ctx.currentTime + 0.02)
    const osc = ctx.createOscillator(); const oGain = ctx.createGain()
    osc.type = 'square'; osc.frequency.setValueAtTime(freq, ctx.currentTime + 0.018)
    oGain.gain.setValueAtTime(0, ctx.currentTime + 0.018)
    oGain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.022)
    oGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09)
    osc.connect(oGain); oGain.connect(ctx.destination)
    osc.start(ctx.currentTime + 0.018); osc.stop(ctx.currentTime + 0.10)
  } catch { /* AudioContext blocked */ }
}

/** Short confirm tone for saves. */
export function playSaveBlip(): void {
  if (isSfxMuted()) return
  try {
    squareNotes([
      { freq: 660, t: 0,    dur: 0.06, vol: 0.028 },
      { freq: 880, t: 0.07, dur: 0.10, vol: 0.022 },
    ])
  } catch { /* AudioContext blocked */ }
}

/** Looping terminal fan drone. Returns a teardown function to fade out and close. */
export function startTerminalHum(): () => void {
  if (isSfxMuted()) return () => {}
  try {
    const ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.setValueAtTime(0, ctx.currentTime)
    master.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 2.5)
    master.connect(ctx.destination)

    const globalHpf = ctx.createBiquadFilter()
    globalHpf.type = 'highpass'; globalHpf.frequency.value = 100; globalHpf.Q.value = 0.7
    globalHpf.connect(master)

    const rumble = ctx.createOscillator(); rumble.type = 'sine'
    rumble.frequency.setValueAtTime(120, ctx.currentTime)
    rumble.frequency.setValueAtTime(118.5, ctx.currentTime + 1.7)
    rumble.frequency.setValueAtTime(121.2, ctx.currentTime + 3.4)
    rumble.frequency.setValueAtTime(119.4, ctx.currentTime + 5.1)
    const rumbleGain = ctx.createGain()
    rumbleGain.gain.setValueAtTime(0, ctx.currentTime); rumbleGain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + 2.5)
    rumble.connect(rumbleGain); rumbleGain.connect(globalHpf); rumble.start()

    const chopBufLen = ctx.sampleRate * 3
    const chopBuf = ctx.createBuffer(1, chopBufLen, ctx.sampleRate)
    const chopData = chopBuf.getChannelData(0)
    for (let i = 0; i < chopBufLen; i++) chopData[i] = Math.random() * 2 - 1
    const chopSrc = ctx.createBufferSource(); chopSrc.buffer = chopBuf; chopSrc.loop = true
    chopSrc.loopStart = 0; chopSrc.loopEnd = chopBufLen / ctx.sampleRate; chopSrc.playbackRate.value = 1.0
    const chopBp = ctx.createBiquadFilter(); chopBp.type = 'bandpass'; chopBp.frequency.value = 210; chopBp.Q.value = 3.5
    const chopGain = ctx.createGain()
    chopGain.gain.setValueAtTime(0, ctx.currentTime); chopGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 2.5)
    chopSrc.connect(chopBp); chopBp.connect(chopGain); chopGain.connect(globalHpf); chopSrc.start()

    const hissBufLen = ctx.sampleRate * 5
    const hissBuf = ctx.createBuffer(1, hissBufLen, ctx.sampleRate)
    const hissData = hissBuf.getChannelData(0)
    for (let i = 0; i < hissBufLen; i++) hissData[i] = Math.random() * 2 - 1
    const hissSrc = ctx.createBufferSource(); hissSrc.buffer = hissBuf; hissSrc.loop = true
    const hissHpf = ctx.createBiquadFilter(); hissHpf.type = 'highpass'; hissHpf.frequency.value = 3800
    const hissGain = ctx.createGain()
    hissGain.gain.setValueAtTime(0, ctx.currentTime); hissGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2.5)
    hissSrc.connect(hissHpf); hissHpf.connect(hissGain); hissGain.connect(globalHpf); hissSrc.start()

    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.18
    const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.018
    lfo.connect(lfoDepth); lfoDepth.connect(master.gain); lfo.start()

    return () => {
      try {
        const t = ctx.currentTime
        master.gain.cancelScheduledValues(t)
        master.gain.setValueAtTime(master.gain.value, t)
        master.gain.linearRampToValueAtTime(0, t + 0.3)
        setTimeout(() => ctx.close(), 400)
      } catch { /* ignore */ }
    }
  } catch {
    return () => {}
  }
}

// ── NavBar ────────────────────────────────────────────────────────────────────

/** Sharp terminal snap — jobs page nav. */
export function playJobsBoot(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const bufLen = ctx.sampleRate * 0.04
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let s = 0; s < bufLen; s++) data[s] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(); src.buffer = buf
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200; hp.Q.value = 0.8
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.038)
    src.connect(hp); hp.connect(gain); gain.connect(ctx.destination)
    src.start(); src.stop(ctx.currentTime + 0.04)
  } catch { /* AudioContext blocked */ }
}

/** Soft single blip for profile dropdown open. */
export function playProfileBlip(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(660, ctx.currentTime); osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.04)
    gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.linearRampToValueAtTime(0.028, ctx.currentTime + 0.006)
    gain.gain.setValueAtTime(0.028, ctx.currentTime + 0.04); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.11)
  } catch { /* AudioContext blocked */ }
}

/** Descending two-note blip for sign out. */
export function playSignOutBlip(): void {
  if (isSfxMuted()) return
  try {
    squareNotes([
      { freq: 440, t: 0,    dur: 0.06, vol: 0.030 },
      { freq: 220, t: 0.07, dur: 0.10, vol: 0.025 },
    ])
  } catch { /* AudioContext blocked */ }
}

/** Gentle ascending arpeggio for credits nav: C5 E5 G5. */
export function playCreditsBlip(): void {
  if (isSfxMuted()) return
  try {
    squareNotes([
      { freq: 523.25, t: 0,    dur: 0.10, vol: 0.026 },
      { freq: 659.25, t: 0.10, dur: 0.10, vol: 0.024 },
      { freq: 783.99, t: 0.20, dur: 0.14, vol: 0.021 },
    ])
  } catch { /* AudioContext blocked */ }
}

/** Three rapid ascending blips for stats nav: D5 F#5 A5. */
export function playStatsBlip(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const notes = [587.33, 739.99, 880.00]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.type = 'square'; osc.connect(gain); gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.05
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.035, t + 0.008)
      gain.gain.setValueAtTime(0.035, t + 0.045); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
      osc.start(t); osc.stop(t + 0.15)
    })
  } catch { /* AudioContext blocked */ }
}

// ── StoryPage ─────────────────────────────────────────────────────────────────

/** Two-note story page entry chime: A4 → E4. */
export function playStoryChime(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const notes = [440.00, 329.63]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.type = 'sine'; osc.connect(gain); gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.22
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.07, t + 0.04)
      gain.gain.setValueAtTime(0.07, t + 0.18); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65)
      osc.start(t); osc.stop(t + 0.65)
    })
  } catch { /* AudioContext blocked */ }
}

/** Ascending trumpet fanfare: C5 E5 G5 C6. */
export function playFanfare(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const notes = [
      { freq: 523.25, start: 0.00, dur: 0.18 },
      { freq: 659.25, start: 0.16, dur: 0.18 },
      { freq: 783.99, start: 0.30, dur: 0.18 },
      { freq: 1046.5, start: 0.44, dur: 0.55 },
    ]
    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(0, ctx.currentTime + start)
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur)
    })
    setTimeout(() => ctx.close(), 1400)
  } catch { /* AudioContext blocked */ }
}

// ── CreditsPage ───────────────────────────────────────────────────────────────

/** Level-complete ascending arpeggio: C5 E5 G5 C6. */
export function playCreditsChime(): void {
  if (isSfxMuted()) return
  try {
    squareNotes([
      { freq: 523.25, t: 0,    dur: 0.12, vol: 0.028 },
      { freq: 659.25, t: 0.12, dur: 0.12, vol: 0.026 },
      { freq: 783.99, t: 0.24, dur: 0.12, vol: 0.024 },
      { freq: 1046.5, t: 0.36, dur: 0.25, vol: 0.020 },
    ])
  } catch { /* AudioContext blocked */ }
}

/** Short rising blip for credits links: 880 → 1046 Hz. */
export function playLinkBlip(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(880, ctx.currentTime); osc.frequency.linearRampToValueAtTime(1046.5, ctx.currentTime + 0.05)
    gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 0.006)
    gain.gain.setValueAtTime(0.025, ctx.currentTime + 0.05); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(); osc.stop(ctx.currentTime + 0.13)
  } catch { /* AudioContext blocked */ }
}

// ── FeedbackModal ─────────────────────────────────────────────────────────────

/** Rising square blip for feedback submission: 440 → 880 Hz. */
export function playSubmitBlip(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(440, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.06, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15)
  } catch { /* blocked */ }
}

/** Falling square blip for modal close: 440 → 220 Hz. */
export function playCloseBlip(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(440, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.04, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12)
  } catch { /* blocked */ }
}

// ── QuickCast ─────────────────────────────────────────────────────────────────

/** Three-hit page-flip sound for QuickCast open/close. */
export function playPageFlip(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const hitDuration = 0.65
    const spacing     = 0.10
    const hitCount    = 3
    const bufSize = Math.ceil(ctx.sampleRate * hitDuration)
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) nd[i] = Math.random() * 2 - 1
    const volumes = [0.1, 0.07, 0.05]
    for (let h = 0; h < hitCount; h++) {
      const t0 = ctx.currentTime + h * spacing
      const src = ctx.createBufferSource(); src.buffer = noiseBuf
      const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 300
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(volumes[h], t0); gain.gain.exponentialRampToValueAtTime(0.001, t0 + hitDuration)
      src.connect(hpf); hpf.connect(gain); gain.connect(ctx.destination)
      src.start(t0); src.stop(t0 + hitDuration)
    }
  } catch { /* AudioContext blocked */ }
}

/** Ascending arpeggio spell-cast for AI activation in QuickCast. */
export function playSpellCast(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const notes = [220, 277.18, 329.63, 440, 554.37, 659.25]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.type = 'square'; osc.connect(gain); gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.045
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.07, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
      osc.start(t); osc.stop(t + 0.1)
    })
  } catch { /* AudioContext blocked */ }
}

/** Whooshing noise swell for AI generation start. */
export function playAiConsume(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const dur = 0.9
    const bufSize = Math.ceil(ctx.sampleRate * dur)
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) nd[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.4
    const bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass'
    bpf.frequency.setValueAtTime(200, ctx.currentTime); bpf.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + dur); bpf.Q.value = 1.2
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0, ctx.currentTime); gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    src.connect(bpf); bpf.connect(gain); gain.connect(ctx.destination)
    src.start(ctx.currentTime); src.stop(ctx.currentTime + dur)
  } catch { /* AudioContext blocked */ }
}

/** Bell-like ding for AI generation complete. */
export function playAiDing(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const partials: { freq: number; vol: number; decay: number }[] = [
      { freq: 1046.5, vol: 0.12, decay: 0.9 },
      { freq: 2093.0, vol: 0.05, decay: 0.5 },
    ]
    partials.forEach(({ freq, vol, decay }) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.type = 'sine'; osc.frequency.value = freq
      gain.gain.setValueAtTime(vol, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + decay)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + decay)
    })
  } catch { /* AudioContext blocked */ }
}

// ── ResumeModal ───────────────────────────────────────────────────────────────

/** Low book-thud sound for resume modal open. */
export function playBookThud(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator(); const oscGain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(120, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.12)
    oscGain.gain.setValueAtTime(0.12, ctx.currentTime); oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
    osc.connect(oscGain); oscGain.connect(ctx.destination)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2)
    const bufLen = Math.ceil(ctx.sampleRate * 0.05)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(); src.buffer = buf
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 600
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.15, ctx.currentTime); noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    src.connect(lpf); lpf.connect(noiseGain); noiseGain.connect(ctx.destination)
    src.start(ctx.currentTime)
  } catch { /* AudioContext blocked */ }
}

// ── XpTracker ─────────────────────────────────────────────────────────────────

/** Four-note ascending sine arpeggio for rank level-up: C5 E5 G5 C6. */
export function playLevelUp(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.type = 'sine'; osc.connect(gain); gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.18
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.09, t + 0.04)
      gain.gain.setValueAtTime(0.09, t + 0.18); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
      osc.start(t); osc.stop(t + 0.55)
    })
  } catch { /* AudioContext blocked */ }
}

// ── MusicPlayer ───────────────────────────────────────────────────────────────

/** Rising blip for music player interactions: 440 → 880 Hz. */
export function playMusicBlip(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(440, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.06)
    gain.gain.setValueAtTime(0.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12)
  } catch { /* AudioContext blocked */ }
}

// ── AuthPage ──────────────────────────────────────────────────────────────────

/** Rising blip for auth success: 440 → 880 Hz. */
export function playAuthBlip(): void {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.setValueAtTime(440, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.06)
    gain.gain.setValueAtTime(0.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12)
  } catch { /* AudioContext blocked */ }
}

// ── MultiplayerPage ───────────────────────────────────────────────────────────

/** Two-note rising blip for multiplayer nav: A4 → E5. */
export function playMultiplayerBlip(): void {
  if (isSfxMuted()) return
  try {
    squareNotes([
      { freq: 440, t: 0,    dur: 0.07, vol: 0.030 },
      { freq: 659, t: 0.08, dur: 0.12, vol: 0.026 },
    ])
  } catch { /* AudioContext blocked */ }
}

/** Short ping confirm for logging a contact interaction. */
export function playPingBlip(): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(1046, ctx.currentTime)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.19)
  } catch { /* AudioContext blocked */ }
}

// ── TutorialOverlay ───────────────────────────────────────────────────────────

/** Page-turn click for tutorial navigation. Same shape as playConsoleBlip. */
export function playTutorialPage(dir: 'forward' | 'back' = 'forward'): void {
  if (isSfxMuted()) return
  try {
    const ctx = new AudioContext()
    const freq = dir === 'forward' ? 660 : 440
    const clickBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.018), ctx.sampleRate)
    const cd = clickBuf.getChannelData(0)
    for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(); src.buffer = clickBuf
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400
    const cg = ctx.createGain()
    cg.gain.setValueAtTime(0.12, ctx.currentTime); cg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.022)
    src.connect(bp); bp.connect(cg); cg.connect(ctx.destination)
    src.start(); src.stop(ctx.currentTime + 0.025)
    const osc = ctx.createOscillator(); const og = ctx.createGain()
    osc.type = 'square'; osc.frequency.setValueAtTime(freq, ctx.currentTime + 0.018)
    og.gain.setValueAtTime(0, ctx.currentTime + 0.018); og.gain.linearRampToValueAtTime(0.028, ctx.currentTime + 0.024)
    og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07)
    osc.connect(og); og.connect(ctx.destination)
    osc.start(ctx.currentTime + 0.018); osc.stop(ctx.currentTime + 0.08)
  } catch { /* blocked */ }
}
