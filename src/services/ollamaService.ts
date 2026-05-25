const OLLAMA_BASE = 'http://localhost:11434'

export interface OllamaModel {
  name: string
}

export async function fetchModels(): Promise<{
  status: 'connected' | 'not_connected'
  models: string[]
}> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return { status: 'not_connected', models: [] }
    const json = await res.json() as { models?: { name: string }[] }
    const models = (json.models ?? []).map((m) => m.name)
    return { status: 'connected', models }
  } catch {
    clearTimeout(timeout)
    return { status: 'not_connected', models: [] }
  }
}

export async function streamCompletion(params: {
  model: string
  system: string
  prompt: string
  onToken: (token: string) => void
  onDone: () => void
  onError: (message: string) => void
  signal?: AbortSignal
}): Promise<void> {
  const { model, system, prompt, onToken, onDone, onError, signal } = params
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, system, prompt, stream: true }),
      signal,
    })
    if (!res.ok || !res.body) {
      onError(`HTTP ${res.status}`)
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const obj = JSON.parse(trimmed) as { response?: string; done?: boolean }
          if (obj.response) onToken(obj.response)
          if (obj.done) { onDone(); return }
        } catch { /* skip malformed line */ }
      }
    }
    onDone()
  } catch (err) {
    if (signal?.aborted) return
    onError(err instanceof Error ? err.message : 'Unknown error')
  }
}
