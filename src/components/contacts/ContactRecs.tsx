import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useSubscription } from '@/lib/SubscriptionContext'
import type { RecommendedContact } from '@/types'

const DOTS = [' .', ' . .', ' . . .']

function SearchingText() {
  const [frame, setFrame] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    ref.current = setInterval(() => setFrame(f => (f + 1) % DOTS.length), 500)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [])

  return (
    <span className="text-[10px] text-muted">
      Searching For Contacts<span className="inline-block w-10">{DOTS[frame]}</span>
    </span>
  )
}

interface GroupedRec {
  company: string
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

interface ContactRecsProps {
  onSaveContact: (fields: { name: string; company?: string; email?: string; linkedin?: string }, jobId: string) => Promise<boolean>
}

export default function ContactRecs({ onSaveContact }: ContactRecsProps) {
  const { isSubscribed, loading: subLoading } = useSubscription()
  const [recs, setRecs] = useState<RecommendedContact[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (subLoading || !isSubscribed) {
      setLoading(false)
      return
    }

    // TODO: remove mock delay once real webhook pipeline is validated
    setTimeout(() => {
      supabase
        .from('recommended_contacts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          setRecs(data ?? [])
          setLoading(false)
        })
    }, 5000)
  }, [isSubscribed, subLoading])

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

  const grouped: GroupedRec[] = []
  const seen = new Map<string, GroupedRec>()
  for (const rec of recs) {
    const key = rec.company ?? rec.job_id
    if (!seen.has(key)) {
      const group: GroupedRec = { company: rec.company ?? 'Unknown Company', peers: [], managers: [] }
      seen.set(key, group)
      grouped.push(group)
    }
    const group = seen.get(key)!
    if (rec.seniority === 'manager') group.managers.push(rec)
    else group.peers.push(rec)
  }

  const visibleGroups = expanded ? grouped : grouped.slice(0, 1)
  const totalCount = recs.length

  return (
    <div className="border-b border-border px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted select-none tracking-widest">
          RECOMMENDED CONTACTS
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted">{totalCount} total</span>
          {grouped.length > 1 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-[10px] text-primary hover:text-secondary transition-none"
            >
              {expanded ? 'show less ↑' : `+${grouped.length - 1} more ↓`}
            </button>
          )}
        </div>
      </div>

      {loading && <SearchingText />}

      {!loading && recs.length === 0 && (
        <span className="text-[10px] text-muted">
          No contacts found — recommendations will appear here after you save a job application.
        </span>
      )}

      {!loading && visibleGroups.map((group) => (
        <div key={group.company} className="flex flex-col gap-1">
          <span className="text-[9px] text-muted tracking-widest select-none">{group.company}</span>
          {[...group.peers, ...group.managers].map((rec) => (
            <ContactRecCard
              key={rec.id}
              contact={rec}
              onSave={handleSave}
              saved={savedIds.has(rec.id)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
