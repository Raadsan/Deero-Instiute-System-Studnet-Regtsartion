const store = new Map<string, { expiresAt: number; data: unknown }>()
const pending = new Map<string, Promise<unknown>>()

export async function getCachedReport<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && hit.expiresAt > now) {
    return hit.data as T
  }

  const existing = pending.get(key)
  if (existing) return existing as Promise<T>

  const request = loader()
    .then((data) => {
      store.set(key, { data, expiresAt: Date.now() + ttlMs })
      return data
    })
    .finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}

export function invalidateReportCache(prefix?: string) {
  if (!prefix) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
