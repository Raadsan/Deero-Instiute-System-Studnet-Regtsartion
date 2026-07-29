"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import LoginPage from "@/components/auth/login-page"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/lib/api"

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ role?: string }>("/api/auth/me")
        const data = res.data
        if (data.role === "TEACHER") router.replace("/attendance")
        else if (data.role === "REGISTRAR") router.replace("/students")
        else if (data.role === "FINANCE") router.replace("/finance")
        else router.replace("/dashboard")
      } catch {
        setShowLogin(true)
      } finally {
        setChecking(false)
      }
    })()
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    )
  }

  if (showLogin) {
    return (
      <LoginPage
        onLogin={(role) => {
          if (role === "TEACHER") router.replace("/attendance")
          else if (role === "REGISTRAR") router.replace("/students")
          else if (role === "FINANCE") router.replace("/finance")
          else router.replace("/dashboard")
        }}
      />
    )
  }

  return null
}
