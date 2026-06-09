import { useState, useEffect } from 'react'
import { fetchCvIsEmpty } from '@/services/cvService'

export function useCvIsEmpty(userId: string | null): boolean | null {
  const [isEmpty, setIsEmpty] = useState<boolean | null>(null)

  useEffect(() => {
    if (!userId) return
    fetchCvIsEmpty(userId).then(setIsEmpty)
  }, [userId])

  return isEmpty
}
