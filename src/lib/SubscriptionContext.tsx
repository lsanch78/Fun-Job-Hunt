import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchSubscription, isSubscribed as checkSubscribed, type Subscription } from '@/services/subscriptionService'

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
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading]           = useState(true)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const sub = await fetchSubscription(user.id)
    setSubscription(sub)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
