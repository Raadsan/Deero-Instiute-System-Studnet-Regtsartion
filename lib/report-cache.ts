const store = new Map<string, { expiresAt: number; data: unknown }>()

export async function getCachedReport<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && hit.expiresAt > now) {
    return hit.data as T
  }

  const data = await loader()
  store.set(key, { data, expiresAt: now + ttlMs })
  return data
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
