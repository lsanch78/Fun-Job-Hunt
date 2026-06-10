import { useState, useEffect } from 'react'
import { fetchCostData, SUBSCRIPTION_PRICE_USD_WEEKLY } from '@/services/dev/costService'
import { weeklyToMonthlyIncome } from '@/lib/pricing'
import type { CostData } from '@/types'

const DEFAULT_FREE_CALLS_PER_USER = 8
const DEFAULT_PAID_CALLS_PER_USER = 20

export function useCosts() {
  const [data,    setData]    = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const [simTotalUsers,       setSimTotalUsers]       = useState(0)
  const [simConversionPct,    setSimConversionPct]    = useState(3)
  const [simSubPrice,         setSimSubPrice]         = useState(SUBSCRIPTION_PRICE_USD_WEEKLY)
  const [simFreeCallsPerUser, setSimFreeCallsPerUser] = useState(DEFAULT_FREE_CALLS_PER_USER)
  const [simPaidCallsPerUser, setSimPaidCallsPerUser] = useState(DEFAULT_PAID_CALLS_PER_USER)
  const [simDirty,            setSimDirty]            = useState(false)

  useEffect(() => {
    fetchCostData()
      .then((d) => {
        setData(d)
        setSimTotalUsers(d.usageRows.length)
        setSimFreeCallsPerUser(Math.round(d.avgCallsFreeUser) || DEFAULT_FREE_CALLS_PER_USER)
        setSimPaidCallsPerUser(Math.round(d.avgCallsPaidUser) || DEFAULT_PAID_CALLS_PER_USER)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  function resetSim() {
    if (!data) return
    setSimTotalUsers(data.usageRows.length)
    setSimConversionPct(3)
    setSimSubPrice(SUBSCRIPTION_PRICE_USD_WEEKLY)
    setSimFreeCallsPerUser(Math.round(data.avgCallsFreeUser) || DEFAULT_FREE_CALLS_PER_USER)
    setSimPaidCallsPerUser(Math.round(data.avgCallsPaidUser) || DEFAULT_PAID_CALLS_PER_USER)
    setSimDirty(false)
  }

  function handleSim(setter: (v: number) => void) {
    return (v: number) => { setter(v); setSimDirty(true) }
  }

  const simPaidUsers  = Math.round(simTotalUsers * simConversionPct / 100)
  const simFreeUsers  = simTotalUsers - simPaidUsers
  const simTotalCalls = simFreeUsers * simFreeCallsPerUser + simPaidUsers * simPaidCallsPerUser
  const simIncome     = weeklyToMonthlyIncome(simPaidUsers, simSubPrice)
  const simClaudeCost = data && data.avgCostPerCall > 0 ? data.avgCostPerCall * simTotalCalls : 0
  const simProfit     = simIncome - simClaudeCost

  return {
    data, loading, error,
    simTotalUsers, simConversionPct, simSubPrice, simFreeCallsPerUser, simPaidCallsPerUser, simDirty,
    setSimTotalUsers:       (v: number) => { setSimTotalUsers(v);             setSimDirty(true) },
    setSimConversionPct:    (v: number) => { setSimConversionPct(v);          setSimDirty(true) },
    setSimSubPrice:         (v: number) => { setSimSubPrice(Math.max(1, v));  setSimDirty(true) },
    setSimFreeCallsPerUser: (v: number) => { setSimFreeCallsPerUser(Math.max(0, v)); setSimDirty(true) },
    setSimPaidCallsPerUser: (v: number) => { setSimPaidCallsPerUser(Math.max(0, v)); setSimDirty(true) },
    simPaidUsers, simFreeUsers, simTotalCalls, simIncome, simClaudeCost, simProfit,
    handleSim: (setter: (v: number) => void) => handleSim(setter),
    resetSim,
  }
}
