export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_SESSION_TTL_SECONDS = 8 * 60 * 60
export const REFRESH_IDLE_TTL_SECONDS = 30 * 60

/** Backwards-compatible name used by access-token verification. */
export const SESSION_TTL_SECONDS = ACCESS_TOKEN_TTL_SECONDS
export const ACCESS_TOKEN_COOKIE = "token"
export const REFRESH_TOKEN_COOKIE = "refreshToken"
