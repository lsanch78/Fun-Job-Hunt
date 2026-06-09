import { useState, useEffect, useMemo } from 'react'
import { fetchHeartbeats, readHeartbeatCache } from '@/services/activityTimerService'
import type { ActivityHeartbeat } from '@/types'
import { fetchJobs, readCache } from '@/services/jobService'
import { fetchContacts } from '@/services/contactService'
import type { Job, Contact } from '@/types'

export function useStats(userId: string | null) {
  const [heartbeats, setHeartbeats] = useState<ActivityHeartbeat[]>(() =>
    userId ? readHeartbeatCache(userId) : []
  )
  const [jobs, setJobs] = useState<Job[]>(() =>
    userId ? readCache(userId) : []
  )
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(() =>
    userId ? readCache(userId).length === 0 && readHeartbeatCache(userId).length === 0 : true
  )

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let cancelled = false
    async function load() {
      const [hbRows, jobRows, contactRows] = await Promise.all([
        fetchHeartbeats(userId!),
        fetchJobs(userId!),
        fetchContacts(userId!),
      ])
      if (!cancelled) {
        setHeartbeats(hbRows)
        setJobs(jobRows)
        setContacts(contactRows)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  const huntStartDate = useMemo(() => {
    if (jobs.length === 0) return null
    return jobs.map((j) => j.applicationDate).filter(Boolean).sort()[0] ?? null
  }, [jobs])

  const totalApps = jobs.length

  const interviewRatio = useMemo(() => {
    if (totalApps === 0) return null
    const interviewed = jobs.filter((j) =>
      j.status === 'PHONE_SCREEN' || j.status === 'INTERVIEW' || j.status === 'OFFER'
    ).length
    return Math.round((interviewed / totalApps) * 100)
  }, [jobs, totalApps])

  const offerCount    = useMemo(() => jobs.filter((j) => j.status === 'OFFER').length, [jobs])
  const ghostedCount  = useMemo(() => jobs.filter((j) => j.status === 'GHOSTED').length, [jobs])
  const rejectedCount = useMemo(() => jobs.filter((j) => j.status === 'REJECTED').length, [jobs])

  const ghostRate = useMemo(() => {
    if (totalApps === 0) return null
    return Math.round((ghostedCount / totalApps) * 100)
  }, [ghostedCount, totalApps])

  const rejectionRate = useMemo(() => {
    if (totalApps === 0) return null
    return Math.round((rejectedCount / totalApps) * 100)
  }, [rejectedCount, totalApps])

  const winRate = useMemo(() => {
    if (totalApps === 0) return null
    return Math.round((offerCount / totalApps) * 100)
  }, [offerCount, totalApps])

  const avgRating = useMemo(() => {
    const rated = jobs.filter((j) => j.rating > 0)
    if (rated.length === 0) return null
    return (rated.reduce((acc, j) => acc + j.rating, 0) / rated.length).toFixed(1)
  }, [jobs])

  const highConvictionCount = useMemo(() => jobs.filter((j) => j.rating >= 4).length, [jobs])

  const daysSinceLastApp = useMemo(() => {
    const dates = jobs.map((j) => j.applicationDate).filter(Boolean).sort()
    if (dates.length === 0) return null
    const last = new Date(dates[dates.length - 1])
    last.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.floor((today.getTime() - last.getTime()) / 86_400_000)
  }, [jobs])

  const bestWeek = useMemo(() => {
    const weekCounts = new Map<string, number>()
    for (const job of jobs) {
      if (!job.applicationDate) continue
      const w = isoWeek(job.applicationDate)
      weekCounts.set(w, (weekCounts.get(w) ?? 0) + 1)
    }
    if (weekCounts.size === 0) return null
    return Math.max(...weekCounts.values())
  }, [jobs])

  const busiestDayOfWeek = useMemo(() => {
    const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const counts = new Array(7).fill(0)
    for (const job of jobs) {
      if (!job.applicationDate) continue
      counts[new Date(job.applicationDate).getDay()]++
    }
    const max = Math.max(...counts)
    if (max === 0) return null
    return DAY_NAMES[counts.indexOf(max)]
  }, [jobs])

  const totalContacts      = contacts.length
  const champCount         = useMemo(() => contacts.filter((c) => c.commExp >= 80).length, [contacts])
  const allyCount          = useMemo(() => contacts.filter((c) => c.commExp >= 60 && c.commExp < 80).length, [contacts])
  const avgCommExp         = useMemo(() => {
    if (contacts.length === 0) return null
    return Math.round(contacts.reduce((sum, c) => sum + c.commExp, 0) / contacts.length)
  }, [contacts])
  const mostActiveContact  = useMemo(() => {
    if (contacts.length === 0) return null
    return contacts.reduce((best, c) => c.commExp > best.commExp ? c : best)
  }, [contacts])
  const contactsCommThisWeek = useMemo(() => {
    const since = Date.now() - 7 * 86_400_000
    return contacts.filter((c) => c.lastCommAt && new Date(c.lastCommAt).getTime() > since).length
  }, [contacts])

  return {
    loading,
    heartbeats,
    jobs,
    contacts,
    huntStartDate,
    totalApps,
    interviewRatio,
    offerCount,
    ghostedCount,
    rejectedCount,
    ghostRate,
    rejectionRate,
    winRate,
    avgRating,
    highConvictionCount,
    daysSinceLastApp,
    bestWeek,
    busiestDayOfWeek,
    totalContacts,
    champCount,
    allyCount,
    avgCommExp,
    mostActiveContact,
    contactsCommThisWeek,
  }
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const daysDiff = Math.floor((d.getTime() - startOfWeek1.getTime()) / 86_400_000)
  return `${d.getFullYear()}-W${String(Math.floor(daysDiff / 7) + 1).padStart(2, '0')}`
}
