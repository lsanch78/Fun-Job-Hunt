import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
  const jwt = authHeader.slice(7)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const { data: usageData, error: usageError } = await supabase
    .rpc('check_and_increment_ai_usage', { p_user_id: user.id })

  if (usageError) {
    return new Response(JSON.stringify({ error: 'Usage check failed' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const usage = usageData as { allowed: boolean; count: number; limit: number }
  if (!usage.allowed) {
    // Check if user has an active subscription — subscribers bypass the free limit
    const now = new Date().toISOString()
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle()

    const isSubscribed =
      subData?.status === 'active' &&
      subData?.current_period_end != null &&
      subData.current_period_end > now

    if (!isSubscribed) {
      return new Response(
        JSON.stringify({ error: 'Monthly limit reached', count: usage.count, limit: usage.limit }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }
  }

  // ── Parse request body ────────────────────────────────────────────────────
  let body: { model?: string; system?: string; resumeSystem?: string; prompt?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const model        = body.model        ?? 'claude-sonnet-4-5'
  const system       = body.system       ?? ''
  const resumeSystem = body.resumeSystem ?? ''
  const prompt       = body.prompt       ?? ''

  // ── Proxy to Anthropic ────────────────────────────────────────────────────
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'AI service not configured' }), {
      status: 503,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // Resume text is the stable cached prefix; instruction text follows uncached.
  const systemBlocks = []
  if (resumeSystem) systemBlocks.push({ type: 'text', text: resumeSystem, cache_control: { type: 'ephemeral' } })
  if (system)       systemBlocks.push({ type: 'text', text: system })

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemBlocks.length > 0 ? systemBlocks : undefined,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    }),
  })

  if (!anthropicRes.ok || !anthropicRes.body) {
    let msg = `Anthropic: HTTP ${anthropicRes.status}`
    try {
      const json = await anthropicRes.json() as { error?: { message?: string; type?: string } }
      if (json.error?.message) msg = `Anthropic ${anthropicRes.status}: ${json.error.message}`
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: msg, anthropic_status: anthropicRes.status }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // ── Intercept stream to capture token usage, then forward to client ───────
  // We tee the stream: one branch goes to the client, the other we parse for
  // the message_stop event which carries the final usage counts.
  const [clientStream, logStream] = anthropicRes.body.tee()

  // Parse the log stream in the background — fire and forget.
  // We intentionally don't await this so the client response starts immediately.
  logTokenUsage(logStream, supabase, user.id, model).catch((e) =>
    console.error('[ai-generate] token log failed:', e),
  )

  return new Response(clientStream, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
})

// ── Token usage logger ────────────────────────────────────────────────────────
// Reads the SSE stream looking for the message_stop event, which contains:
// { type: "message_stop", usage: { input_tokens, output_tokens,
//   cache_read_input_tokens, cache_creation_input_tokens } }
async function logTokenUsage(
  stream: ReadableStream<Uint8Array>,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  model: string,
) {
  const decoder = new TextDecoder()
  let buffer = ''

  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE lines
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (raw === '[DONE]') continue

        let evt: SseEvent
        try { evt = JSON.parse(raw) } catch { continue }

        // message_stop carries the authoritative final usage
        if (evt.type === 'message_stop' && evt.usage) {
          await insertCostLog(supabase, userId, model, evt.usage)
          return
        }
        // Fallback: message_delta also has a usage field on some versions
        if (evt.type === 'message_delta' && evt.usage) {
          await insertCostLog(supabase, userId, model, evt.usage)
          // Don't return — message_stop may still come with more accurate totals
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

async function insertCostLog(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  model: string,
  usage: TokenUsage,
) {
  const period = new Date().toISOString().slice(0, 7) // YYYY-MM
  const { error } = await supabase.from('ai_cost_log').insert({
    user_id:                    userId,
    model,
    period,
    input_tokens:               usage.input_tokens               ?? 0,
    output_tokens:              usage.output_tokens              ?? 0,
    cache_read_input_tokens:    usage.cache_read_input_tokens    ?? 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
  })
  if (error) console.error('[ai-generate] insert cost log:', error.message)
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface TokenUsage {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

interface SseEvent {
  type: string
  usage?: TokenUsage
}
