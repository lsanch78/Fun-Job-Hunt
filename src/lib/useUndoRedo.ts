import { useState, useRef, useCallback } from 'react'

const DEFAULT_CAP = 50

function serialize(value: unknown): string {
  return JSON.stringify(value) ?? ''
}

interface UndoRedoState<T> {
  state:    T
  canUndo:  boolean
  canRedo:  boolean
  push:     (value: T) => void
  undo:     () => void
  redo:     () => void
  reset:    (value: T) => void
  // Returns a debounced version of push — coalesces rapid calls into one history entry.
  debouncedPush: (value: T) => void
}

export function useUndoRedo<T>(initial: T, cap = DEFAULT_CAP): UndoRedoState<T> {
  const [state,   setState]   = useState<T>(initial)
  const [past,    setPast]    = useState<T[]>([])
  const [future,  setFuture]  = useState<T[]>([])

  // Tracks the value at the moment the debounce timer was started so we push
  // the pre-edit snapshot, not the in-progress value.
  const debounceTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotRef    = useRef<T>(initial)

  const push = useCallback((value: T) => {
    setState((prev) => {
      if (serialize(value) === serialize(prev)) return prev
      setPast((p) => {
        const next = [...p, prev]
        return next.length > cap ? next.slice(next.length - cap) : next
      })
      setFuture([])
      return value
    })
  }, [cap])

  const debouncedPush = useCallback((value: T) => {
    if (debounceTimer.current === null) {
      // Capture the snapshot before any edits in this burst
      snapshotRef.current = state
    } else {
      clearTimeout(debounceTimer.current)
    }
    // Apply the value immediately so the UI stays responsive
    setState(value)
    setFuture([])

    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null
      setState((current) => {
        if (serialize(current) === serialize(snapshotRef.current)) return current
        setPast((p) => {
          const next = [...p, snapshotRef.current]
          return next.length > cap ? next.slice(next.length - cap) : next
        })
        return current
      })
    }, 2000)
  }, [state, cap])

  const undo = useCallback(() => {
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }
    setPast((p) => {
      if (p.length === 0) return p
      const prev = p[p.length - 1]
      const next = p.slice(0, -1)
      setState((current) => {
        setFuture((f) => [current, ...f])
        return prev
      })
      return next
    })
  }, [])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f
      const next = f[0]
      const rest = f.slice(1)
      setState((current) => {
        setPast((p) => {
          const updated = [...p, current]
          return updated.length > cap ? updated.slice(updated.length - cap) : updated
        })
        return next
      })
      return rest
    })
  }, [cap])

  const reset = useCallback((value: T) => {
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }
    setState(value)
    setPast([])
    setFuture([])
  }, [])

  return {
    state,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    push,
    undo,
    redo,
    reset,
    debouncedPush,
  }
}
