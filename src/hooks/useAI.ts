import { useState, useRef, useCallback, useEffect } from 'react'
import { streamCompletion, fetchModels } from '@/services/aiService'
import { playAiConsume, playAiDing } from '@/lib/sfx'

export type AiPhase = 'idle' | 'generating' | 'ready'

interface RunParams {
  system: string
  prompt: string
  onComplete: (result: string) => void
  onError?: (message: string) => void
}

export function useAI() {
  const [phase, setPhase] = useState<AiPhase>('idle')
  const [dots, setDots]   = useState(0)
  const abortRef          = useRef<AbortController | null>(null)

  useEffect(() => {
    if (phase !== 'generating') return
    const id = setInterval(() => setDots((d) => (d + 1) % 3), 500)
    return () => clearInterval(id)
  }, [phase])

  const run = useCallback(async ({ system, prompt, onComplete, onError }: RunParams) => {
    if (phase === 'generating') return

    const { connected, models } = fetchModels()
    if (!connected) {
      onError?.('AI not configured. Add an API key in Settings.')
      return
    }

    abortRef.current = new AbortController()
    setPhase('generating')
    setDots(0)
    playAiConsume()

    let accumulated = ''

    await streamCompletion({
      model: models[0],
      system,
      prompt,
      signal: abortRef.current.signal,
      onToken: (token) => { accumulated += token },
      onDone: () => {
        setPhase('ready')
        playAiDing()
        onComplete(accumulated)
        setTimeout(() => setPhase('idle'), 2500)
      },
      onError: (msg) => {
        setPhase('idle')
        onError?.(msg)
      },
    })
  }, [phase])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setPhase('idle')
  }, [])

  const reset = useCallback(() => {
    setPhase('idle')
    setDots(0)
  }, [])

  const statusLabel =
    phase === 'generating' ? `GEN${'.'.repeat(dots + 1)}${'  '.repeat(2 - dots)}`
    : phase === 'ready'    ? '● READY'
    :                        '● ON'

  return { run, cancel, reset, phase, dots, statusLabel, streaming: phase === 'generating' }
}
