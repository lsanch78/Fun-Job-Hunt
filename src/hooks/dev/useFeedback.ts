import { useState, useEffect } from 'react'
import { fetchAllFeedback, FEEDBACK_TOPICS } from '@/services/feedbackService'
import type { FeedbackEntry, FeedbackTopic } from '@/types'

export function useFeedback() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<FeedbackTopic | 'All'>('All')

  useEffect(() => {
    fetchAllFeedback().then((data) => {
      setEntries(data)
      setLoading(false)
    })
  }, [])

  const displayed = filter === 'All' ? entries : entries.filter((e) => e.topic === filter)
  const counts = FEEDBACK_TOPICS.reduce<Record<string, number>>((acc, t) => {
    acc[t] = entries.filter((e) => e.topic === t).length
    return acc
  }, {})

  return { entries, loading, filter, setFilter, displayed, counts }
}
