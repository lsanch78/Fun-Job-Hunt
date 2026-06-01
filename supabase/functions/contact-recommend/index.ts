import { createClient } from 'jsr:@supabase/supabase-js@2'

interface DbJob {
  id: string
  user_id: string
  company: string
  title: string
  posting_url: string | null
  salary: string | null
  description: string | null
}

interface WebhookPayload {
  type: 'INSERT' | 'MANUAL'
  record: DbJob
}

interface PdlContact {
  full_name?: string
  work_email?: string
  linkedin_url?: string
  job_title?: string
}

interface RecommendedContact {
  name: string
  title?: string
  email?: string
  linkedin_url?: string
  seniority: 'peer' | 'manager'
  why: string
}

function bucketTitle(title: string): string {
  const t = title.toLowerCase()
  if (/\b(ceo|cto|coo|cpo|chief)\b/.test(t))              return 'c_suite'
  if (/\b(vp|vice president)\b/.test(t))                   return 'vp'
  if (/\b(director)\b/.test(t))                            return 'director'
  if (/\b(staff|principal)\b/.test(t))                     return 'staff_engineer'
  if (/\b(engineering manager|eng manager|em)\b/.test(t))  return 'eng_manager'
  if (/\b(manager)\b/.test(t))                             return 'manager'
  if (/\b(senior|sr\.?)\b/.test(t))                        return 'senior_engineer'
  if (/\b(junior|jr\.?|associate)\b/.test(t))              return 'junior_engineer'
  if (/\b(product manager|pm)\b/.test(t))                  return 'product_manager'
  if (/\b(design|ux|ui)\b/.test(t))                        return 'designer'
  if (/\b(data scientist|ml|machine learning|ai)\b/.test(t)) return 'data_ml'
  if (/\b(devops|sre|platform|infra)\b/.test(t))           return 'infra'
  if (/\b(engineer|developer|swe|software)\b/.test(t))     return 'engineer'
  return 'other'
}

function normalizeLinkedin(url: string | undefined): string | null {
  if (!url) return null
  if (url.startsWith('http')) return url
  if (url.startsWith('linkedin.com')) return `https://www.${url}`
  if (url.startsWith('www.linkedin.com')) return `https://${url}`
  // bare slug like "in/johndoe"
  return `https://www.linkedin.com/${url.replace(/^\//, '')}`
}

async function searchPdlContacts(company: string, pdlKey: string): Promise<PdlContact[]> {
  const res = await fetch('https://api.peopledatalabs.com/v5/person/search', {
    method: 'POST',
    headers: {
      'X-Api-Key': pdlKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: {
        bool: {
          must: [
            { term: { job_company_name: company.toLowerCase() } },
          ],
        },
      },
      size: 3,
      fields: ['full_name', 'work_email', 'linkedin_url', 'job_title'],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('PDL error:', res.status, text)
    return []
  }

  const body = await res.json() as { data?: PdlContact[] }
  return body.data ?? []
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS })
  }

  if (payload.type !== 'INSERT' && payload.type !== 'MANUAL') {
    return new Response(JSON.stringify({ skipped: true }), { status: 200, headers: CORS_HEADERS })
  }

  const job = payload.record

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // For direct calls, verify the Bearer token matches the job's user_id
  if (payload.type === 'MANUAL') {
    const authHeader = req.headers.get('Authorization')
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!jwt) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user || user.id !== job.user_id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
    }
  }

  // Only run for premium users
  const now = new Date().toISOString()
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', job.user_id)
    .maybeSingle()

  const isPremium =
    sub?.status === 'active' &&
    sub?.current_period_end != null &&
    sub.current_period_end > now

  if (!isPremium) {
    return new Response(JSON.stringify({ error: 'Premium required' }), { status: 403, headers: CORS_HEADERS })
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'AI service not configured' }), { status: 503, headers: CORS_HEADERS })
  }

  const pdlKey = Deno.env.get('PDL_API_KEY')
  if (!pdlKey) {
    return new Response(JSON.stringify({ error: 'PDL not configured' }), { status: 503, headers: CORS_HEADERS })
  }

  const tools = [
    {
      name: 'search_contacts',
      description: 'Search for people currently working at a company. Returns a list of contacts with name, title, email, and LinkedIn URL.',
      input_schema: {
        type: 'object',
        properties: {
          company: { type: 'string', description: 'The company name to search for employees at' },
        },
        required: ['company'],
      },
    },
    {
      name: 'save_recommendations',
      description: 'Save the final ranked contact recommendations for this job application.',
      input_schema: {
        type: 'object',
        properties: {
          contacts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                title: { type: 'string' },
                email: { type: 'string' },
                linkedin_url: { type: 'string' },
                seniority: { type: 'string', enum: ['peer', 'manager'] },
                why: { type: 'string', description: '1-sentence explanation of why this person is a useful connection' },
              },
              required: ['name', 'seniority', 'why'],
            },
          },
        },
        required: ['contacts'],
      },
    },
  ]

  const systemPrompt = `You are a job search assistant helping users find the right people to reach out to at companies they've applied to. You help identify both peer-level connections (similar role/seniority) and manager-level connections (one level above the applied role). You are concise and practical.`

  const userPrompt = `The user has applied to the following job:
- Company: ${job.company}
- Title: ${job.title}${job.salary ? `\n- Salary: ${job.salary}` : ''}${job.description ? `\n- Job description: ${job.description.slice(0, 800)}` : ''}

Use search_contacts to find people at ${job.company}, then select the 3–5 most useful contacts for someone applying to this role. Classify each as "peer" (similar level to the applied role) or "manager" (one level above). Write a single sentence for each explaining why they're worth reaching out to. Then call save_recommendations with your ranked list.`

  // Agentic loop — runs until the agent calls save_recommendations or stops
  const messages: { role: string; content: unknown }[] = [
    { role: 'user', content: userPrompt },
  ]

  let savedContacts: RecommendedContact[] = []
  const maxIterations = 5

  for (let i = 0; i < maxIterations; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages,
      }),
    })

    if (!res.ok) {
      console.error('Anthropic error:', res.status, await res.text())
      return new Response(JSON.stringify({ error: 'AI call failed' }), { status: 502, headers: CORS_HEADERS })
    }

    const completion = await res.json() as {
      stop_reason: string
      content: { type: string; id?: string; name?: string; input?: unknown; text?: string }[]
    }

    messages.push({ role: 'assistant', content: completion.content })

    if (completion.stop_reason === 'end_turn') break

    if (completion.stop_reason === 'tool_use') {
      const toolResults: { type: string; tool_use_id: string; content: string }[] = []

      for (const block of completion.content) {
        if (block.type !== 'tool_use' || !block.id || !block.name) continue

        if (block.name === 'search_contacts') {
          const input = block.input as { company: string }
          const contacts = await searchPdlContacts(input.company, pdlKey)
          // Seed PDL cache — always, even on empty, so scan skips this company
          await supabase.from('company_contact_cache').upsert({
            company_name: input.company.toLowerCase(),
            contacts,
            fetched_at: new Date().toISOString(),
            cache_hits: 0,
            cache_misses: 0,
          }, { onConflict: 'company_name' })
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: contacts.length > 0
              ? JSON.stringify(contacts)
              : 'No contacts found for this company in the database.',
          })
        }

        if (block.name === 'save_recommendations') {
          const input = block.input as { contacts: RecommendedContact[] }
          savedContacts = input.contacts
          // Seed Claude cache — always, even on empty
          await supabase.from('claude_rec_cache').upsert({
            company_name: job.company.toLowerCase(),
            title_bucket: bucketTitle(job.title),
            recommendations: savedContacts,
            fetched_at: new Date().toISOString(),
            cache_hits: 0,
          }, { onConflict: 'company_name,title_bucket' })
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: 'Recommendations saved successfully.',
          })
        }
      }

      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults })
      }

      // If save_recommendations was called, we're done
      if (savedContacts.length > 0) break
    }
  }

  if (savedContacts.length === 0) {
    console.error('Agent did not produce recommendations for job', job.id)
    return new Response(JSON.stringify({ error: 'Agent produced no recommendations' }), { status: 500, headers: CORS_HEADERS })
  }

  const rows = savedContacts.map((c) => ({
    job_id: job.id,
    user_id: job.user_id,
    company: job.company,
    name: c.name,
    title: c.title ?? null,
    email: c.email ?? null,
    linkedin_url: normalizeLinkedin(c.linkedin_url),
    seniority: c.seniority,
    why: c.why,
  }))

  const { error: insertError } = await supabase.from('recommended_contacts').insert(rows)
  if (insertError) {
    console.error('Insert failed:', insertError)
    return new Response(JSON.stringify({ error: 'DB insert failed' }), { status: 500, headers: CORS_HEADERS })
  }

  return new Response(JSON.stringify({ ok: true, count: rows.length }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
