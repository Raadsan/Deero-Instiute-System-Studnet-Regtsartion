import axios from "axios"

export const api = axios.create({
  baseURL: "",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
})

let refreshRequest: Promise<void> | null = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    const config = error?.config as (typeof error.config & { _sessionRetry?: boolean }) | undefined
    const url = String(config?.url ?? "")
    const isAuthRequest =
      url.includes("/api/auth/login") ||
      url.includes("/api/auth/logout") ||
      url.includes("/api/auth/refresh")

    if (status !== 401 || !config || config._sessionRetry || isAuthRequest) {
      return Promise.reject(error)
    }

    config._sessionRetry = true
    if (!refreshRequest) {
      refreshRequest = axios
        .post("/api/auth/refresh", undefined, { withCredentials: true })
        .then(() => undefined)
        .finally(() => {
          refreshRequest = null
        })
    }

    try {
      await refreshRequest
      return api.request(config)
    } catch {
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/" &&
        window.location.pathname !== "/login"
      ) {
        window.location.href = "/?session=expired"
      }
      return Promise.reject(error)
    }
  },
)
