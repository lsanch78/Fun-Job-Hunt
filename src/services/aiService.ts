import {
  fetchModels as ollamaFetchModels,
  streamCompletion as ollamaStreamCompletion,
} from './ollamaService'
import { supabase } from '@/lib/supabase'

export type AiProvider = 'proxy' | 'ollama' | 'openai' | 'anthropic'

export const AI_MONTHLY_LIMIT = 5

export const OPENAI_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
]

export const ANTHROPIC_MODELS = [
  'claude-opus-4-5',
  'claude-sonnet-4-5',
  'claude-haiku-4-5',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
]

const PROVIDER_KEY = 'fjobhunt:ai:provider'
const APIKEY_KEY   = 'fjobhunt:ai:apikey'

const FUNCTION_URL = `${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/ai-generate`

// ── Provider / key helpers ────────────────────────────────────────────────────

export function getAiProvider(): AiProvider {
  try {
    const val = localStorage.getItem(PROVIDER_KEY)
    if (val === 'openai' || val === 'anthropic' || val === 'ollama' || val === 'proxy') return val
  } catch { /* ignore */ }
  return 'proxy'
}

export function setAiProvider(p: AiProvider): void {
  try { localStorage.setItem(PROVIDER_KEY, p) } catch { /* ignore */ }
}

export function getAiApiKey(): string {
  try { return localStorage.getItem(APIKEY_KEY) ?? '' } catch { return '' }
}

export function setAiApiKey(k: string): void {
  try { localStorage.setItem(APIKEY_KEY, k) } catch { /* ignore */ }
}

// ── Usage (proxy provider only) ───────────────────────────────────────────────

export async function fetchUsage(): Promise<{ count: number; limit: number; period: string } | null> {
  try {
    const { data, error } = await supabase
      .from('ai_usage')
      .select('count, period')
      .maybeSingle()
    if (error || !data) return null
    const row = data as { count: number; period: string }
    const currentPeriod = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
    const count = row.period === currentPeriod ? row.count : 0
    return { count, limit: AI_MONTHLY_LIMIT, period: row.period }
  } catch { return null }
}

// ── Unified fetchModels ───────────────────────────────────────────────────────

export async function fetchModels(): Promise<{
  status: 'connected' | 'not_connected'
  models: string[]
}> {
  const provider = getAiProvider()
  if (provider === 'ollama') return ollamaFetchModels()
  if (provider === 'proxy') return { status: 'connected', models: ['claude-haiku-4-5'] }
  const models = provider === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS
  const apiKey = getAiApiKey()
  if (!apiKey) return { status: 'not_connected', models }
  return { status: 'connected', models }
}

// ── Unified streamCompletion ──────────────────────────────────────────────────

export async function streamCompletion(params: {
  model: string
  system: string
  prompt: string
  onToken: (token: string) => void
  onDone: () => void
  onError: (message: string) => void
  signal?: AbortSignal
}): Promise<void> {
  const provider = getAiProvider()
  if (provider === 'ollama')    return ollamaStreamCompletion(params)
  if (provider === 'proxy')     return streamProxy(params)
  if (provider === 'openai')    return streamOpenAI(params)
  return streamAnthropic(params)
}

// ── Proxy (managed, server-side key) ─────────────────────────────────────────

async function streamProxy(params: {
  model: string
  system: string
  prompt: string
  onToken: (token: string) => void
  onDone: () => void
  onError: (message: string) => void
  signal?: AbortSignal
}): Promise<void> {
  const { system, prompt, onToken, onDone, onError, signal } = params
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { onError('Not logged in'); return }
  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'claude-haiku-4-5', system, prompt }),
      signal,
    })
    if (!res.ok || !res.body) {
      if (res.status === 429) {
        onError(`Monthly limit reached (${AI_MONTHLY_LIMIT}/${AI_MONTHLY_LIMIT}). Add your own API key in Settings to continue.`)
      } else {
        let msg = `AI: HTTP ${res.status}`
        try {
          const json = await res.clone().json() as { error?: string }
          if (json.error) msg = json.error
        } catch { /* ignore */ }
        onError(msg)
      }
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
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        try {
          const obj = JSON.parse(data) as { type?: string; delta?: { text?: string } }
          if (obj.type === 'content_block_delta' && obj.delta?.text) {
            onToken(obj.delta.text)
          }
        } catch { /* skip malformed line */ }
      }
    }
    onDone()
  } catch (err) {
    if (signal?.aborted) return
    onError(err instanceof Error ? err.message : 'Unknown error')
  }
}

// ── OpenAI (BYOK) ─────────────────────────────────────────────────────────────

async function streamOpenAI(params: {
  model: string
  system: string
  prompt: string
  onToken: (token: string) => void
  onDone: () => void
  onError: (message: string) => void
  signal?: AbortSignal
}): Promise<void> {
  const { model, system, prompt, onToken, onDone, onError, signal } = params
  const apiKey = getAiApiKey()
  if (!apiKey) { onError('No OpenAI API key configured'); return }
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        stream: true,
      }),
      signal,
    })
    if (!res.ok || !res.body) {
      let msg = `OpenAI: HTTP ${res.status}`
      try {
        const json = await res.json() as { error?: { message?: string } }
        if (json.error?.message) msg = `OpenAI: ${json.error.message}`
      } catch { /* ignore */ }
      onError(msg)
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
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') { onDone(); return }
        try {
          const obj = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }
          const token = obj.choices?.[0]?.delta?.content
          if (token) onToken(token)
        } catch { /* skip malformed line */ }
      }
    }
    onDone()
  } catch (err) {
    if (signal?.aborted) return
    onError(err instanceof Error ? err.message : 'Unknown error')
  }
}

// ── Anthropic (BYOK) ──────────────────────────────────────────────────────────

async function streamAnthropic(params: {
  model: string
  system: string
  prompt: string
  onToken: (token: string) => void
  onDone: () => void
  onError: (message: string) => void
  signal?: AbortSignal
}): Promise<void> {
  const { model, system, prompt, onToken, onDone, onError, signal } = params
  const apiKey = getAiApiKey()
  if (!apiKey) { onError('No Anthropic API key configured'); return }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
      signal,
    })
    if (!res.ok || !res.body) {
      let msg = `Anthropic: HTTP ${res.status}`
      try {
        const json = await res.json() as { error?: { message?: string } }
        if (json.error?.message) msg = `Anthropic: ${json.error.message}`
      } catch { /* ignore */ }
      onError(msg)
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
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        try {
          const obj = JSON.parse(data) as { type?: string; delta?: { text?: string } }
          if (obj.type === 'content_block_delta' && obj.delta?.text) {
            onToken(obj.delta.text)
          }
        } catch { /* skip malformed line */ }
      }
    }
    onDone()
  } catch (err) {
    if (signal?.aborted) return
    onError(err instanceof Error ? err.message : 'Unknown error')
  }
}
