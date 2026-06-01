import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PDL_TTL_DAYS = 30
const CLAUDE_TTL_DAYS = 7

interface DbJob {
  id: string
  company: string
  title: string
  posting_url: string | null
  salary: string | null
  description: string | null
  date_applied: string
}

interface PdlContact {
  full_name?: string
  work_email?: string
  linkedin_url?: string
  job_title?: string
}

interface CachedContact {
  name: string
  title: string | null
  email: string | null
  linkedin_url: string | null
}

interface PdlCacheRow {
  id: string
  company_name: string
  contacts: CachedContact[]
  fetched_at: string
  cache_hits: number
  cache_misses: number
}

interface ClaudeRecCacheRow {
  id: string
  company_name: string
  title_bucket: string
  recommendations: RecommendedContact[]
  fetched_at: string
  cache_hits: number
}

interface RecommendedContact {
  name: string
  title?: string
  email?: string
  linkedin_url?: string
  seniority: 'peer' | 'manager'
  why: string
}

// Coarsely bucket job titles so similar roles share Claude cache entries.
// e.g. "Senior Software Engineer II" and "SWE" both → "engineer"
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
  return `https://www.linkedin.com/${url.replace(/^\//, '')}`
}

async function fetchFromPdl(company: string, pdlKey: string): Promise<CachedContact[]> {
  const res = await fetch('https://api.peopledatalabs.com/v5/person/search', {
    method: 'POST',
    headers: { 'X-Api-Key': pdlKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: { bool: { must: [{ term: { job_company_name: company.toLowerCase() } }] } },
      size: 25,
      fields: ['full_name', 'work_email', 'linkedin_url', 'job_title'],
    }),
  })
  if (!res.ok) { console.error('PDL error for', company, res.status); return [] }
  const body = await res.json() as { data?: PdlContact[] }
  return (body.data ?? []).map((p) => ({
    name: p.full_name ?? 'Unknown',
    title: p.job_title ?? null,
    email: p.work_email ?? null,
    linkedin_url: normalizeLinkedin(p.linkedin_url),
  }))
}

async function runAgentForJob(
  job: DbJob,
  contacts: CachedContact[],
  anthropicKey: string,
): Promise<RecommendedContact[]> {
  if (contacts.length === 0) return []

  const tools = [{
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
              why: { type: 'string' },
            },
            required: ['name', 'seniority', 'why'],
          },
        },
      },
      required: ['contacts'],
    },
  }]

  const prompt = `The user applied to this job:
- Company: ${job.company}
- Title: ${job.title}${job.description ? `\n- Description: ${job.description.slice(0, 600)}` : ''}

Here are people who work at ${job.company}:
${JSON.stringify(contacts.slice(0, 20))}

Pick the 3–5 most useful contacts for someone applying to this role. Classify each as "peer" (similar level) or "manager" (one level above). Write one sentence per contact explaining why they're worth reaching out to. Call save_recommendations with your ranked list.`

  const messages: { role: string; content: unknown }[] = [{ role: 'user', content: prompt }]
  let saved: RecommendedContact[] = []

  for (let i = 0; i < 4; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, tools, messages }),
    })
    if (!res.ok) { console.error('Anthropic error:', res.status); break }

    const completion = await res.json() as {
      stop_reason: string
      content: { type: string; id?: string; name?: string; input?: unknown }[]
    }
    messages.push({ role: 'assistant', content: completion.content })
    if (completion.stop_reason === 'end_turn') break

    if (completion.stop_reason === 'tool_use') {
      const results: { type: string; tool_use_id: string; content: string }[] = []
      for (const block of completion.content) {
        if (block.type !== 'tool_use' || !block.id || !block.name) continue
        if (block.name === 'save_recommendations') {
          saved = (block.input as { contacts: RecommendedContact[] }).contacts
          results.push({ type: 'tool_result', tool_use_id: block.id, content: 'Saved.' })
        }
      }
      if (results.length > 0) messages.push({ role: 'user', content: results })
      if (saved.length > 0) break
    }
  }

  return saved
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS })

  const authHeader = req.headers.get('Authorization')
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!jwt) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })

  const now = new Date().toISOString()
  const { data: sub } = await supabase
    .from('subscriptions').select('status, current_period_end').eq('user_id', user.id).maybeSingle()

  const isPremium = sub?.status === 'active' && sub?.current_period_end != null && sub.current_period_end > now
  if (!isPremium) return new Response(JSON.stringify({ error: 'Premium required' }), { status: 403, headers: CORS_HEADERS })

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const pdlKey = Deno.env.get('PDL_API_KEY')
  if (!anthropicKey || !pdlKey) return new Response(JSON.stringify({ error: 'Service not configured' }), { status: 503, headers: CORS_HEADERS })

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs').select('id, company, title, posting_url, salary, description, date_applied')
    .eq('user_id', user.id).gte('date_applied', yesterday)

  if (jobsError) return new Response(JSON.stringify({ error: 'Failed to fetch jobs' }), { status: 500, headers: CORS_HEADERS })
  if (!jobs || jobs.length === 0) return new Response(JSON.stringify({ ok: true, scanned: 0, message: 'No jobs in the last 24 hours' }), { status: 200, headers: CORS_HEADERS })

  const byCompany = new Map<string, DbJob[]>()
  for (const job of jobs as DbJob[]) {
    const key = job.company.toLowerCase()
    if (!byCompany.has(key)) byCompany.set(key, [])
    byCompany.get(key)!.push(job)
  }

  type ScanEntry = { company: string; jobTitle: string; layer: 'pdl' | 'claude' }
  let totalInserted = 0
  const cacheStats = { pdl: { hits: 0, misses: 0 }, claude: { hits: 0, misses: 0 }, jobs: { skipped: 0 } }
  const noEnrichment: { company: string; jobTitle: string }[] = []
  const cacheHits: ScanEntry[] = []
  const cacheMisses: ScanEntry[] = []
  const cacheAdds: ScanEntry[] = []

  for (const [companyKey, companyJobs] of byCompany) {
    const companyName = companyJobs[0].company

    // ── Layer 2: PDL cache ────────────────────────────────────────────────────
    const pdlCutoff = new Date(Date.now() - PDL_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data: pdlRow } = await supabase
      .from('company_contact_cache').select('*')
      .eq('company_name', companyKey).gte('fetched_at', pdlCutoff).maybeSingle() as { data: PdlCacheRow | null }

    let contacts: CachedContact[]
    if (pdlRow) {
      contacts = pdlRow.contacts
      cacheStats.pdl.hits++
      cacheHits.push({ company: companyName, jobTitle: '(company)', layer: 'pdl' })
      await supabase.from('company_contact_cache')
        .update({ cache_hits: pdlRow.cache_hits + 1 }).eq('id', pdlRow.id)
    } else {
      contacts = await fetchFromPdl(companyName, pdlKey)
      cacheStats.pdl.misses++
      cacheMisses.push({ company: companyName, jobTitle: '(company)', layer: 'pdl' })
      await supabase.from('company_contact_cache').upsert({
        company_name: companyKey,
        contacts,
        fetched_at: new Date().toISOString(),
        cache_hits: 0,
        cache_misses: (pdlRow as PdlCacheRow | null)?.cache_misses ?? 0 + 1,
      }, { onConflict: 'company_name' })
      cacheAdds.push({ company: companyName, jobTitle: '(company)', layer: 'pdl' })
    }

    for (const job of companyJobs) {
      // ── Layer 1: already have recs for this job ───────────────────────────
      const { count } = await supabase
        .from('recommended_contacts').select('id', { count: 'exact', head: true }).eq('job_id', job.id)
      if ((count ?? 0) > 0) { cacheStats.jobs.skipped++; continue }

      if (contacts.length === 0) {
        noEnrichment.push({ company: companyName, jobTitle: job.title })
        continue
      }

      // ── Layer 3: Claude rec cache ─────────────────────────────────────────
      const bucket = bucketTitle(job.title)
      const claudeCutoff = new Date(Date.now() - CLAUDE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { data: claudeRow } = await supabase
        .from('claude_rec_cache').select('*')
        .eq('company_name', companyKey).eq('title_bucket', bucket)
        .gte('fetched_at', claudeCutoff).maybeSingle() as { data: ClaudeRecCacheRow | null }

      let recs: RecommendedContact[]
      if (claudeRow) {
        recs = claudeRow.recommendations
        cacheStats.claude.hits++
        cacheHits.push({ company: companyName, jobTitle: job.title, layer: 'claude' })
        await supabase.from('claude_rec_cache')
          .update({ cache_hits: claudeRow.cache_hits + 1 }).eq('id', claudeRow.id)
      } else {
        recs = await runAgentForJob(job, contacts, anthropicKey)
        cacheStats.claude.misses++
        cacheMisses.push({ company: companyName, jobTitle: job.title, layer: 'claude' })
        // Always cache — even empty results, so we don't retry on next scan
        await supabase.from('claude_rec_cache').upsert({
          company_name: companyKey,
          title_bucket: bucket,
          recommendations: recs,
          fetched_at: new Date().toISOString(),
          cache_hits: 0,
        }, { onConflict: 'company_name,title_bucket' })
        cacheAdds.push({ company: companyName, jobTitle: job.title, layer: 'claude' })
      }

      if (recs.length === 0) {
        noEnrichment.push({ company: companyName, jobTitle: job.title })
        continue
      }

      const rows = recs.map((r) => ({
        job_id: job.id,
        user_id: user.id,
        company: companyName,
        name: r.name,
        title: r.title ?? null,
        email: r.email ?? null,
        linkedin_url: r.linkedin_url ?? null,
        seniority: r.seniority,
        why: r.why,
      }))

      const { error: insertError } = await supabase.from('recommended_contacts').insert(rows)
      if (!insertError) totalInserted += rows.length
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    scanned: jobs.length,
    companies: byCompany.size,
    inserted: totalInserted,
    cache: cacheStats,
    noEnrichment,
    cacheHits,
    cacheMisses,
    cacheAdds,
  }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
})
