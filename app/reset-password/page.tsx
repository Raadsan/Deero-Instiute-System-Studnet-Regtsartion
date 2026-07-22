import { Suspense } from "react"
import ResetPasswordPage from "@/components/auth/reset-password-page"
import { Spinner } from "@/components/ui/spinner"

export default function ResetPasswordRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  )
}
