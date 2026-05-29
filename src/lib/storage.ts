export function lsGet<T>(key: string, fallback: T): T {
  if (!key) return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      // Legacy values stored as raw strings (not JSON-encoded) — return as-is
      return raw as unknown as T
    }
  } catch {
    return fallback
  }
}

export function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* storage full */ }
}

export function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch { /* ignore */ }
}
