import { useReducer, useRef, useCallback } from 'react'

const DEFAULT_CAP = 50

function serialize(value: unknown): string {
  return JSON.stringify(value) ?? ''
}

interface History<T> {
  past:    T[]
  present: T
  future:  T[]
}

type Action<T> =
  | { type: 'PUSH';  value: T; cap: number }
  | { type: 'UNDO' }
  | { type: 'REDO';  cap: number }
  | { type: 'RESET'; value: T }
  | { type: 'COMMIT_DEBOUNCE'; snapshot: T; cap: number }
  | { type: 'SET_PRESENT'; value: T }

function reducer<T>(history: History<T>, action: Action<T>): History<T> {
  switch (action.type) {
    case 'PUSH': {
      if (serialize(action.value) === serialize(history.present)) return history
      const past = [...history.past, history.present]
      return {
        past:    past.length > action.cap ? past.slice(past.length - action.cap) : past,
        present: action.value,
        future:  [],
      }
    }
    case 'UNDO': {
      if (history.past.length === 0) return history
      const past    = history.past.slice(0, -1)
      const present = history.past[history.past.length - 1]
      return { past, present, future: [history.present, ...history.future] }
    }
    case 'REDO': {
      if (history.future.length === 0) return history
      const present = history.future[0]
      const future  = history.future.slice(1)
      const past    = [...history.past, history.present]
      return {
        past:    past.length > action.cap ? past.slice(past.length - action.cap) : past,
        present,
        future,
      }
    }
    case 'RESET':
      return { past: [], present: action.value, future: [] }
    case 'COMMIT_DEBOUNCE': {
      if (serialize(history.present) === serialize(action.snapshot)) return history
      const past = [...history.past, action.snapshot]
      return {
        past:    past.length > action.cap ? past.slice(past.length - action.cap) : past,
        present: history.present,
        future:  [],
      }
    }
    case 'SET_PRESENT':
      return { ...history, present: action.value, future: [] }
  }
}

interface UndoRedoState<T> {
  state:         T
  canUndo:       boolean
  canRedo:       boolean
  push:          (value: T) => void
  undo:          () => void
  redo:          () => void
  reset:         (value: T) => void
  debouncedPush: (value: T) => void
}

export function useUndoRedo<T>(initial: T, cap = DEFAULT_CAP): UndoRedoState<T> {
  const [history, dispatch] = useReducer(reducer as (s: History<T>, a: Action<T>) => History<T>, {
    past:    [],
    present: initial,
    future:  [],
  })

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotRef   = useRef<T>(initial)

  const push = useCallback((value: T) => {
    dispatch({ type: 'PUSH', value, cap })
  }, [cap])

  const debouncedPush = useCallback((value: T) => {
    if (debounceTimer.current === null) {
      snapshotRef.current = history.present
    } else {
      clearTimeout(debounceTimer.current)
    }
    dispatch({ type: 'SET_PRESENT', value })

    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null
      dispatch({ type: 'COMMIT_DEBOUNCE', snapshot: snapshotRef.current, cap })
    }, 2000)
  }, [history.present, cap])

  const undo = useCallback(() => {
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }
    dispatch({ type: 'UNDO' })
  }, [])

  const redo = useCallback(() => {
    dispatch({ type: 'REDO', cap })
  }, [cap])

  const reset = useCallback((value: T) => {
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }
    dispatch({ type: 'RESET', value })
  }, [])

  return {
    state:   history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    push,
    undo,
    redo,
    reset,
    debouncedPush,
  }
}
