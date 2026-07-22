import type { AppSession } from "@/lib/auth"

const TTL_MS = 60_000
const cache = new Map<string, { session: AppSession; expiresAt: number }>()

export function getCachedSession(userId: string): AppSession | null {
  const entry = cache.get(userId)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(userId)
    return null
  }
  return entry.session
}

export function setCachedSession(userId: string, session: AppSession) {
  cache.set(userId, { session, expiresAt: Date.now() + TTL_MS })
}

export function invalidateSessionCache(userId: string) {
  cache.delete(userId)
}
