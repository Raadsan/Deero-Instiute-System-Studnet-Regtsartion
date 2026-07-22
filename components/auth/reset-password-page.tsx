"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { KeyRound, Eye, EyeOff } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams])

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!token) {
      toast({ title: "Invalid link", description: "Reset token is missing.", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      await api.post("/api/auth/reset-password", { token, password, confirmPassword })
      setDone(true)
      toast({ title: "Password updated", description: "You can sign in with your new password." })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string }
      toast({
        title: "Reset failed",
        description: err?.response?.data?.message ?? err?.message ?? "Something went wrong.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <Card className="p-8 border border-slate-200/80 bg-white shadow-md">
          <div className="mb-6 flex justify-center">
            <img src="/images/sodma.png" alt="Sodma Logo" className="h-14 w-auto object-contain" />
          </div>

          <div className="mb-6 space-y-1.5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset Password</h1>
            <p className="text-sm text-slate-500">Choose a new password for your account.</p>
          </div>

          {!token ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-destructive">This reset link is invalid. Request a new one.</p>
              <Button asChild className="w-full">
                <Link href="/forgot-password">Request Reset Link</Link>
              </Button>
            </div>
          ) : done ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">Your password has been updated successfully.</p>
              <Button asChild className="w-full">
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={6}
                  className="h-11"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11">
                {loading ? "Saving..." : "Update Password"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
