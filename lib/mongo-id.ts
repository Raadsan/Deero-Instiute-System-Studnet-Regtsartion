/** Legacy helpers kept for API routes during Postgres migration — IDs are plain strings (cuid). */

export function buildIdVariants(id: string) {
  return [id]
}

export function buildIdFilter(id: string) {
  return { id }
}

export function buildIdFilterList(ids: string[]) {
  if (!ids.length) return null
  return { id: { in: ids } }
}

export function buildFieldIdFilter(field: string, id: string) {
  return { [field]: id }
}

export function idsMatch(stored: unknown, id: string): boolean {
  if (stored == null) return false
  return String(stored) === id
}
