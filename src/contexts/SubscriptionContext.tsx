import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchSubscription, isSubscribed as checkSubscribed } from '@/services/subscriptionService'
import type { Subscription } from '@/types'

interface SubscriptionContextValue {
  subscription: Subscription | null
  isSubscribed: boolean
  loading: boolean
  refresh: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  isSubscribed: false,
  loading: true,
  refresh: async () => {},
})

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading]           = useState(true)

  async function load() {
    if (!userId) { setLoading(false); return }
    const sub = await fetchSubscription(userId)
    setSubscription(sub)
    setLoading(false)
  }

  useEffect(() => { load() }, [userId])

  return (
    <SubscriptionContext.Provider value={{
      subscription,
      isSubscribed: checkSubscribed(subscription),
      loading,
      refresh: load,
    }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  return useContext(SubscriptionContext)
}
