import { useState, useRef, useEffect } from 'react'
import { fetchJournal, upsertJournal, JOURNAL_LIMIT } from '@/services/journalService'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import type { CheckItem } from '@/types'

export function useJournal(userId: string | null) {
  const [tab,        setTabState]  = useState<'pad' | 'list'>(() => lsGet<string>(SK.journalTab, 'pad') as 'pad' | 'list')
  const [text,       setText]      = useState(() => userId ? lsGet<string>(SK.journal(userId), '') : '')
  const [items,      setItems]     = useState<CheckItem[]>(() => userId ? lsGet<CheckItem[]>(SK.journalList(userId), []) : [])
  const [newItem,    setNewItem]   = useState('')
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing'>('synced')

  const saveTextTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveListTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userId) return
    const cachedText = lsGet<string | null>(SK.journal(userId), null)
    if (cachedText) setText(cachedText)
    const cachedList = lsGet<CheckItem[] | null>(SK.journalList(userId), null)
    if (cachedList) setItems(cachedList)
    setSyncStatus('syncing')
    fetchJournal(userId).then((rec) => {
      if (rec) {
        if (rec.notes) {
          setText(rec.notes)
          lsSet(SK.journal(userId), rec.notes)
        }
        if (rec.list) {
          try {
            const parsed = JSON.parse(rec.list) as CheckItem[]
            setItems(parsed)
            lsSet(SK.journalList(userId), parsed)
          } catch { /* noop */ }
        }
      }
      setSyncStatus('synced')
    })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  function setTab(t: 'pad' | 'list') {
    setTabState(t)
    lsSet(SK.journalTab, t)
  }

  function persistText(val: string) {
    if (userId) lsSet(SK.journal(userId), val)
    if (!userId) return
    setSyncStatus('syncing')
    if (saveTextTimer.current) clearTimeout(saveTextTimer.current)
    saveTextTimer.current = setTimeout(async () => {
      await upsertJournal(userId, { notes: val })
      setSyncStatus('synced')
    }, 800)
  }

  function persistItems(next: CheckItem[]) {
    if (userId) lsSet(SK.journalList(userId), next)
    if (!userId) return
    setSyncStatus('syncing')
    if (saveListTimer.current) clearTimeout(saveListTimer.current)
    saveListTimer.current = setTimeout(async () => {
      await upsertJournal(userId, { list: JSON.stringify(next) })
      setSyncStatus('synced')
    }, 800)
  }

  function handleTextChange(val: string) {
    const trimmed = val.slice(0, JOURNAL_LIMIT)
    setText(trimmed)
    persistText(trimmed)
  }

  function clearText() {
    setText('')
    persistText('')
  }

  function addItem() {
    const trimmed = newItem.trim()
    if (!trimmed) return
    const next = [...items, { id: crypto.randomUUID(), text: trimmed, done: false }]
    setItems(next); persistItems(next); setNewItem('')
  }

  function toggleItem(id: string) {
    const next = items.map((it) => it.id === id ? { ...it, done: !it.done } : it)
    setItems(next); persistItems(next)
  }

  function deleteItem(id: string) {
    const next = items.filter((it) => it.id !== id)
    setItems(next); persistItems(next)
  }

  function clearDone() {
    const next = items.filter((it) => !it.done)
    setItems(next); persistItems(next)
  }

  function clearAll() {
    setItems([]); persistItems([])
  }

  function reorderItems(next: CheckItem[]) {
    setItems(next); persistItems(next)
  }

  return {
    tab, setTab,
    text,
    items, setItems,
    newItem, setNewItem,
    syncStatus,
    doneCount: items.filter((it) => it.done).length,
    hasActivity: !!text || items.length > 0,
    handleTextChange,
    clearText,
    addItem,
    toggleItem,
    deleteItem,
    clearDone,
    clearAll,
    reorderItems,
  }
}
