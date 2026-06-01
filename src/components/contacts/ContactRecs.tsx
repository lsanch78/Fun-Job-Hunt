import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useSubscription } from '@/lib/SubscriptionContext'
import { scanRecentJobsForContacts, type ScanResult, type ScanEntry } from '@/services/contactRecommendService'
import type { RecommendedContact } from '@/types'

const SCAN_STORAGE_KEY = 'contact_scan_last_result'

const DEV_MODE = import.meta.env['VITE_DEV_BYPASS'] === 'true'

const DOTS = [' .', ' . .', ' . . .']

function StatusDot({ loading, count }: { loading: boolean; count: number }) {
  const [frame, setFrame] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!loading) { if (ref.current) clearInterval(ref.current); return }
    ref.current = setInterval(() => setFrame(f => (f + 1) % DOTS.length), 500)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [loading])

  if (loading) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        <span className="text-[10px] text-yellow-400 select-none">
          Searching{DOTS[frame]}
        </span>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary" />
      <span className="text-[10px] text-secondary select-none">
        {count} New Contact{count !== 1 ? 's' : ''}
      </span>
    </span>
  )
}

interface GroupedRec {
  key: string        // job_id — unique per group
  company: string
  jobTitle: string
  peers: RecommendedContact[]
  managers: RecommendedContact[]
}

interface ContactRecCardProps {
  contact: RecommendedContact
  onSave: (rec: RecommendedContact) => Promise<void>
  saved: boolean
}

function ContactRecCard({ contact, onSave, saved }: ContactRecCardProps) {
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(contact)
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 border border-border hover:border-secondary transition-none">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] text-primary font-medium">{contact.name}</span>
        {contact.title && (
          <span className="text-[10px] text-muted">{contact.title}</span>
        )}
        <span className={`text-[9px] px-1.5 py-0.5 border ${
          contact.seniority === 'manager'
            ? 'border-warning text-warning'
            : 'border-secondary text-secondary'
        }`}>
          {contact.seniority === 'manager' ? 'MGR' : 'PEER'}
        </span>
        <button
          onClick={handleSave}
          disabled={saved || saving}
          className="ml-auto text-[9px] px-2 py-0.5 border border-border text-muted hover:border-primary hover:text-primary transition-none disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saved ? 'SAVED' : saving ? '…' : '+ SAVE'}
        </button>
      </div>
      {contact.why && (
        <p className="text-[10px] text-muted leading-relaxed">{contact.why}</p>
      )}
      <div className="flex items-center gap-3 mt-1">
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="text-[10px] text-primary hover:text-secondary transition-none"
          >
            {contact.email}
          </a>
        )}
        {contact.linkedin_url && (
          <a
            href={contact.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary hover:text-secondary transition-none"
          >
            linkedin ↗
          </a>
        )}
      </div>
    </div>
  )
}

type DiagTab = 'missed' | 'hits' | 'adds' | 'none'

function EntryList({ entries }: { entries: ScanEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-[10px] text-muted py-1">None this scan.</p>
  }
  return (
    <div className="flex flex-col gap-0.5">
      {entries.map((e, i) => (
        <div key={i} className="flex items-baseline gap-2 py-0.5">
          <span className={`text-[9px] px-1 border ${
            e.layer === 'pdl'
              ? 'border-secondary/50 text-secondary'
              : 'border-primary/40 text-primary/60'
          } select-none`}>
            {e.layer.toUpperCase()}
          </span>
          <span className="text-[10px] text-primary">{e.company}</span>
          {e.jobTitle !== '(company)' && (
            <>
              <span className="text-muted text-[10px]">—</span>
              <span className="text-[10px] text-muted">{e.jobTitle}</span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function ScanDiagnosticsPanel({ scan, scannedAt }: {
  scan: ScanResult
  scannedAt: string
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<DiagTab>('missed')

  const totalIssues = scan.noEnrichment.length
  const hasWarning = totalIssues > 0

  const tabs: { id: DiagTab; label: string; count: number }[] = [
    { id: 'missed', label: 'No Enrichment', count: scan.noEnrichment.length },
    { id: 'hits',   label: 'Cache Hits',    count: scan.cacheHits?.length ?? 0 },
    { id: 'adds',   label: 'Added',         count: scan.cacheAdds?.length ?? 0 },
    { id: 'none',   label: 'API Calls',     count: scan.cacheMisses?.length ?? 0 },
  ]

  return (
    <div className={`border ${hasWarning ? 'border-warning/40' : 'border-border'}`}>
      <button
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface/50 transition-none"
        onClick={() => setOpen(v => !v)}
      >
        <span className="flex items-center gap-2">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${hasWarning ? 'bg-warning' : 'bg-secondary'}`} />
          <span className={`text-[10px] select-none ${hasWarning ? 'text-warning' : 'text-muted'}`}>
            Last scan
          </span>
          <span className="text-[9px] text-muted select-none font-mono">{scannedAt}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="text-[9px] text-muted select-none font-mono">
            {scan.scanned} jobs · {scan.inserted} inserted
            {totalIssues > 0 ? ` · ${totalIssues} missed` : ''}
          </span>
          <span className="text-[10px] text-muted select-none">{open ? '↑' : '↓'}</span>
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1">
          {/* Tab row */}
          <div className="flex gap-0 border-b border-border mb-2">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`text-[9px] px-2.5 py-1 select-none transition-none ${
                  tab === t.id
                    ? 'text-primary border-b border-primary -mb-px'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {t.label}
                <span className="ml-1 opacity-60">{t.count}</span>
              </button>
            ))}
          </div>

          {tab === 'missed' && (
            <>
              {scan.noEnrichment.length === 0
                ? <p className="text-[10px] text-muted py-1">All companies returned contacts.</p>
                : (
                  <>
                    <p className="text-[10px] text-muted mb-1.5">
                      PDL returned no contacts. Right-click the job → Find Contacts to force a fresh lookup.
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {scan.noEnrichment.map((item, i) => (
                        <div key={i} className="flex items-baseline gap-2 py-0.5">
                          <span className="text-[10px] text-warning">{item.company}</span>
                          <span className="text-muted text-[10px]">—</span>
                          <span className="text-[10px] text-muted">{item.jobTitle}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              }
            </>
          )}

          {tab === 'hits' && <EntryList entries={scan.cacheHits ?? []} />}
          {tab === 'adds' && <EntryList entries={scan.cacheAdds ?? []} />}
          {tab === 'none' && <EntryList entries={scan.cacheMisses ?? []} />}
        </div>
      )}
    </div>
  )
}

function JobGroup({ group, onSave, savedIds }: {
  group: GroupedRec
  onSave: (rec: RecommendedContact) => Promise<void>
  savedIds: Set<string>
}) {
  const [open, setOpen] = useState(false)
  const contacts = [...group.peers, ...group.managers]

  return (
    <div className="border border-border">
      <button
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface/50 transition-none"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-[10px] text-primary select-none">
          {group.company}
          <span className="text-muted"> — {group.jobTitle}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[9px] text-muted select-none">{contacts.length}</span>
          <span className="text-[10px] text-muted select-none">{open ? '↑' : '↓'}</span>
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-1 p-2">
          {contacts.map((rec) => (
            <ContactRecCard
              key={rec.id}
              contact={rec}
              onSave={onSave}
              saved={savedIds.has(rec.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ContactRecsProps {
  onSaveContact: (fields: { name: string; company?: string; email?: string; linkedin?: string }, jobId: string) => Promise<boolean>
}

export default function ContactRecs({ onSaveContact }: ContactRecsProps) {
  const { isSubscribed, loading: subLoading } = useSubscription()
  const [recs, setRecs] = useState<RecommendedContact[]>([])
  const [jobTitles, setJobTitles] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState<ScanResult | null>(() => {
    try { return JSON.parse(localStorage.getItem(SCAN_STORAGE_KEY) ?? 'null') } catch { return null }
  })
  const [lastScanAt, setLastScanAt] = useState<string>(() =>
    localStorage.getItem(SCAN_STORAGE_KEY + '_at') ?? ''
  )

  useEffect(() => {
    if (subLoading || !isSubscribed) { setLoading(false); return }

    // Fetch recs joined with job title
    supabase
      .from('recommended_contacts')
      .select('*, jobs(title)')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const rows = (data ?? []) as (RecommendedContact & { jobs?: { title: string } })[]
        const titles = new Map<string, string>()
        rows.forEach(r => { if (r.jobs?.title) titles.set(r.job_id, r.jobs!.title) })
        setRecs(rows)
        setJobTitles(titles)
        setLoading(false)
      })

    const channel = supabase
      .channel('recommended_contacts_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recommended_contacts' },
        async (payload) => {
          const newRec = payload.new as RecommendedContact
          // Fetch the job title for the new rec
          const { data: job } = await supabase
            .from('jobs').select('title').eq('id', newRec.job_id).maybeSingle()
          if (job?.title) setJobTitles(prev => new Map(prev).set(newRec.job_id, job.title))
          setRecs(prev => [newRec, ...prev])
          setLoading(false)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isSubscribed, subLoading])

  async function handleScan() {
    setScanning(true)
    setExpanded(true)
    const { ok, result } = await scanRecentJobsForContacts()
    if (ok && result) {
      const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setLastScan(result)
      setLastScanAt(at)
      localStorage.setItem(SCAN_STORAGE_KEY, JSON.stringify(result))
      localStorage.setItem(SCAN_STORAGE_KEY + '_at', at)
    }
    setScanning(false)
  }

  async function handleSave(rec: RecommendedContact) {
    const ok = await onSaveContact({
      name: rec.name,
      company: rec.company ?? undefined,
      email: rec.email ?? undefined,
      linkedin: rec.linkedin_url ?? undefined,
    }, rec.job_id)
    if (ok) setSavedIds(prev => new Set(prev).add(rec.id))
  }

  if (subLoading || !isSubscribed) return null

  // Group by job_id so each job application is its own collapsible group
  const grouped: GroupedRec[] = []
  const seen = new Map<string, GroupedRec>()
  for (const rec of recs) {
    if (!seen.has(rec.job_id)) {
      const group: GroupedRec = {
        key: rec.job_id,
        company: rec.company ?? 'Unknown Company',
        jobTitle: jobTitles.get(rec.job_id) ?? '…',
        peers: [],
        managers: [],
      }
      seen.set(rec.job_id, group)
      grouped.push(group)
    }
    const group = seen.get(rec.job_id)!
    if (rec.seniority === 'manager') group.managers.push(rec)
    else group.peers.push(rec)
  }

  return (
    <div className="border-b border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <button
          className="flex items-center gap-3 hover:opacity-80 transition-none"
          onClick={() => !loading && setExpanded(v => !v)}
        >
          <span className="text-[10px] text-muted select-none tracking-widest">
            RECOMMENDED CONTACTS
          </span>
          <StatusDot loading={loading || scanning} count={recs.length} />
        </button>

        <div className="flex items-center gap-3">
          {lastScan && DEV_MODE && (
            <span className="text-[9px] text-muted select-none font-mono" title="PDL hits/misses · Claude hits/misses · jobs skipped">
              <span className="text-yellow-400">[DEV]</span>
              {' '}pdl {lastScan.cache.pdl.hits}h/{lastScan.cache.pdl.misses}m
              {' · '}ai {lastScan.cache.claude.hits}h/{lastScan.cache.claude.misses}m
              {' · '}{lastScan.scanned} scanned
              {' · '}{lastScan.inserted} inserted
              {lastScan.cache.jobs.skipped > 0 ? ` · ${lastScan.cache.jobs.skipped} skip` : ''}
            </span>
          )}
          <button
            onClick={handleScan}
            disabled={scanning}
            className="text-[9px] px-2 py-0.5 border border-border text-muted hover:border-primary hover:text-primary transition-none disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {scanning ? 'SCANNING…' : 'SCAN 24H'}
          </button>
          {!loading && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-[10px] text-muted hover:text-primary transition-none select-none"
            >
              {expanded ? '↑' : '↓'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable body */}
      {!loading && expanded && (
        <div className="px-4 pb-3">
          {recs.length === 0 ? (
            <span className="text-[10px] text-muted">
              No contacts found — right-click a job and select Find Contacts to get started.
            </span>
          ) : (
            <div className="flex flex-col gap-1 max-h-[420px] overflow-y-auto pr-1">
              {lastScan && DEV_MODE && (
                <ScanDiagnosticsPanel scan={lastScan} scannedAt={lastScanAt} />
              )}
              {grouped.map((group) => (
                <JobGroup
                  key={group.key}
                  group={group}
                  onSave={handleSave}
                  savedIds={savedIds}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
