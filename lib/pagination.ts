export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 100

export type PaginationMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function parsePagination(searchParams: URLSearchParams, defaultPageSize = DEFAULT_PAGE_SIZE) {
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(searchParams.get("pageSize") ?? defaultPageSize) || defaultPageSize),
  )
  const skip = (page - 1) * pageSize
  return { page, pageSize, skip }
}

export function buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}
