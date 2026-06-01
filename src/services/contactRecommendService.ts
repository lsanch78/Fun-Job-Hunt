import { supabase } from '@/lib/supabase'
import type { Job } from '@/types'

const FUNCTION_URL = `${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/contact-recommend`
const SCAN_URL = `${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/contact-scan`

export async function requestContactRecommendations(job: Job): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Not authenticated' }

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      type: 'MANUAL',
      record: {
        id: job.id,
        user_id: session.user.id,
        company: job.company,
        title: job.title,
        posting_url: job.postingUrl ?? null,
        salary: job.salary ?? null,
        description: job.description ?? null,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    return { ok: false, error: body.error ?? `HTTP ${res.status}` }
  }

  return { ok: true }
}

export interface ScanEntry {
  company: string
  jobTitle: string
  layer: 'pdl' | 'claude'
}

export interface ScanResult {
  scanned: number
  companies: number
  inserted: number
  cache: {
    pdl: { hits: number; misses: number }
    claude: { hits: number; misses: number }
    jobs: { skipped: number }
  }
  noEnrichment: { company: string; jobTitle: string }[]
  cacheHits: ScanEntry[]
  cacheMisses: ScanEntry[]
  cacheAdds: ScanEntry[]
  message?: string
}

export async function scanRecentJobsForContacts(): Promise<{ ok: boolean; result?: ScanResult; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Not authenticated' }

  const res = await fetch(SCAN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
  })

  const body = await res.json() as ScanResult & { error?: string }
  if (!res.ok) return { ok: false, error: body.error ?? `HTTP ${res.status}` }
  return { ok: true, result: body }
}
