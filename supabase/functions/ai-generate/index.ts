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

  // Stream the Anthropic SSE response straight back to the client
  return new Response(anthropicRes.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
})
