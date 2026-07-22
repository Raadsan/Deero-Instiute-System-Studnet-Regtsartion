"use client"

import { useRouter } from "next/navigation"
import LoginPage from "@/components/auth/login-page"

export default function LoginRoutePage() {
  const router = useRouter()

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
