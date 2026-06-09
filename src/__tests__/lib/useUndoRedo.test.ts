import { renderHook, act } from '@testing-library/react'
import { useUndoRedo } from '@/lib/useUndoRedo'

describe('useUndoRedo', () => {
  describe('push', () => {
    it('updates state', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.push('b'))
      expect(result.current.state).toBe('b')
    })

    it('enables undo after push', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.push('b'))
      expect(result.current.canUndo).toBe(true)
    })

    it('clears future on push', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.push('b'))
      act(() => result.current.undo())
      act(() => result.current.push('c'))
      expect(result.current.canRedo).toBe(false)
    })
  })

  describe('undo', () => {
    it('restores previous state', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.push('b'))
      act(() => result.current.undo())
      expect(result.current.state).toBe('a')
    })

    it('enables redo after undo', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.push('b'))
      act(() => result.current.undo())
      expect(result.current.canRedo).toBe(true)
    })

    it('does nothing when nothing to undo', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.undo())
      expect(result.current.state).toBe('a')
      expect(result.current.canUndo).toBe(false)
    })

    it('canUndo is false after undoing all history', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.push('b'))
      act(() => result.current.undo())
      expect(result.current.canUndo).toBe(false)
    })
  })

  describe('redo', () => {
    it('reapplies undone state', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.push('b'))
      act(() => result.current.undo())
      act(() => result.current.redo())
      expect(result.current.state).toBe('b')
    })

    it('does nothing when nothing to redo', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.push('b'))
      act(() => result.current.redo())
      expect(result.current.state).toBe('b')
    })

    it('canRedo is false after redoing all', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.push('b'))
      act(() => result.current.undo())
      act(() => result.current.redo())
      expect(result.current.canRedo).toBe(false)
    })
  })

  describe('cap', () => {
    it('does not exceed the cap', () => {
      const { result } = renderHook(() => useUndoRedo(0, 3))
      act(() => result.current.push(1))
      act(() => result.current.push(2))
      act(() => result.current.push(3))
      act(() => result.current.push(4))
      // Past is capped at 3 entries; undoing 3 times reaches the oldest kept state
      act(() => result.current.undo())
      act(() => result.current.undo())
      act(() => result.current.undo())
      expect(result.current.canUndo).toBe(false)
    })
  })

  describe('deduplication', () => {
    it('does not push a history entry when value is identical to current state', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.push('a'))
      expect(result.current.canUndo).toBe(false)
    })

    it('does not commit debounce entry when value is unchanged after 2s', () => {
      jest.useFakeTimers()
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.debouncedPush('a'))
      act(() => jest.advanceTimersByTime(2000))
      expect(result.current.canUndo).toBe(false)
      jest.useRealTimers()
    })
  })

  describe('reset', () => {
    it('clears all history and sets new initial value', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.push('b'))
      act(() => result.current.push('c'))
      act(() => result.current.reset('x'))
      expect(result.current.state).toBe('x')
      expect(result.current.canUndo).toBe(false)
      expect(result.current.canRedo).toBe(false)
    })
  })

  describe('debouncedPush', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it('updates state immediately', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.debouncedPush('b'))
      expect(result.current.state).toBe('b')
    })

    it('does not push to history until debounce window elapses', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.debouncedPush('b'))
      expect(result.current.canUndo).toBe(false)
      act(() => jest.advanceTimersByTime(2000))
      expect(result.current.canUndo).toBe(true)
    })

    it('coalesces rapid calls into one history entry', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.debouncedPush('b'))
      act(() => result.current.debouncedPush('c'))
      act(() => result.current.debouncedPush('d'))
      act(() => jest.advanceTimersByTime(2000))
      // One undo should bring us back to 'a'
      act(() => result.current.undo())
      expect(result.current.state).toBe('a')
      expect(result.current.canUndo).toBe(false)
    })

    it('cancels pending debounce on undo', () => {
      const { result } = renderHook(() => useUndoRedo('a'))
      act(() => result.current.push('b'))
      act(() => result.current.debouncedPush('c'))
      act(() => result.current.undo())
      // Undo restores the state before push('b') — 'a'; debounce timer is cancelled
      // so no extra history entry appears after the undo.
      expect(result.current.state).toBe('a')
      expect(result.current.canUndo).toBe(false)
    })
  })
})
