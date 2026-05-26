import { isSfxMuted, setSfxMuted, toggleSfxMuted, onSfxMutedChange } from '@/lib/sfx'

const STORAGE_KEY = 'fjobhunt:sfx:muted'

beforeEach(() => {
  localStorage.clear()
  jest.restoreAllMocks()
})

describe('isSfxMuted', () => {
  it('returns false when localStorage has no entry', () => {
    expect(isSfxMuted()).toBe(false)
  })

  it('returns true when localStorage has "true"', () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    expect(isSfxMuted()).toBe(true)
  })

  it('returns false when localStorage has "false"', () => {
    localStorage.setItem(STORAGE_KEY, 'false')
    expect(isSfxMuted()).toBe(false)
  })

  it('returns false when localStorage throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage unavailable') })
    expect(isSfxMuted()).toBe(false)
  })
})

describe('setSfxMuted', () => {
  it('persists true to localStorage', () => {
    setSfxMuted(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('persists false to localStorage', () => {
    setSfxMuted(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false')
  })

  it('dispatches fjobhunt:sfx-muted-change event with true', () => {
    const spy = jest.fn()
    window.addEventListener('fjobhunt:sfx-muted-change', (e) => spy((e as CustomEvent<boolean>).detail))
    setSfxMuted(true)
    expect(spy).toHaveBeenCalledWith(true)
    window.removeEventListener('fjobhunt:sfx-muted-change', spy)
  })

  it('dispatches fjobhunt:sfx-muted-change event with false', () => {
    const spy = jest.fn()
    window.addEventListener('fjobhunt:sfx-muted-change', (e) => spy((e as CustomEvent<boolean>).detail))
    setSfxMuted(false)
    expect(spy).toHaveBeenCalledWith(false)
    window.removeEventListener('fjobhunt:sfx-muted-change', spy)
  })
})

describe('toggleSfxMuted', () => {
  it('toggles from unmuted to muted and returns true', () => {
    localStorage.setItem(STORAGE_KEY, 'false')
    const result = toggleSfxMuted()
    expect(result).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('toggles from muted to unmuted and returns false', () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    const result = toggleSfxMuted()
    expect(result).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false')
  })

  it('returns true when starting from empty (defaults false)', () => {
    const result = toggleSfxMuted()
    expect(result).toBe(true)
  })
})

describe('onSfxMutedChange', () => {
  it('calls the callback when mute state changes', () => {
    const cb = jest.fn()
    const unsub = onSfxMutedChange(cb)
    setSfxMuted(true)
    expect(cb).toHaveBeenCalledWith(true)
    unsub()
  })

  it('does not call callback after unsubscribing', () => {
    const cb = jest.fn()
    const unsub = onSfxMutedChange(cb)
    unsub()
    setSfxMuted(false)
    expect(cb).not.toHaveBeenCalled()
  })

  it('receives the correct boolean value', () => {
    const received: boolean[] = []
    const unsub = onSfxMutedChange((v) => received.push(v))
    setSfxMuted(true)
    setSfxMuted(false)
    setSfxMuted(true)
    expect(received).toEqual([true, false, true])
    unsub()
  })
})
