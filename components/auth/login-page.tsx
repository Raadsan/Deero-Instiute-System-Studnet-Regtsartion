"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface LoginPageProps {
  onLogin: (role: "ADMIN" | "TEACHER" | "REGISTRAR" | "FINANCE") => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post<{ role: "ADMIN" | "TEACHER" | "REGISTRAR" | "FINANCE" }>("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      })
      onLogin(res.data.role)
    } catch (error: any) {
      const status = error?.response?.status
      const message = error?.response?.data?.message
      toast({
        title: "Login failed",
        description:
          status === 503
            ? message ?? "Database not connected. Run: npx prisma migrate deploy && npx prisma db seed"
            : message ?? "Check email and password. Admin: admin@deeroinstitute",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left Side - Login Image */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-0 relative overflow-hidden">
        <img
          src="/images/3333.jpg"
          alt="Login Visual"
          className="w-full h-full object-cover object-center"
          style={{ minHeight: "100vh", background: "linear-gradient(135deg, #003D9E 0%, #003D9E 100%)" }}
        />
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 min-h-screen overflow-visible">
        <div className="w-full max-w-[420px] mx-auto overflow-visible">
          {/* Mobile Header (Only visible on small screens) */}
          <div className="lg:hidden mb-8 text-center">
            <div className="flex justify-center">
              <img src="/images/logo dero isntiute-01.png" alt="Deero Institute Logo" className="h-20 w-auto object-contain" />
            </div>
          </div>

          <Card className="relative z-10 gap-0 overflow-visible border border-slate-200/80 bg-white p-8 sm:p-10 shadow-md shadow-slate-200/80">
            <div className="mb-6 hidden lg:flex justify-center sm:justify-start">
              <img src="/images/logo dero isntiute-01.png" alt="Deero Institute Logo" className="h-16 w-auto object-contain" />
            </div>
            <div className="mb-8 space-y-1.5 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Welcome Back</h1>
              <p className="text-sm text-slate-500">Enter your credentials to access the admin portal.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase font-semibold text-muted-foreground tracking-wide">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 bg-background border-muted rounded-lg shadow-sm focus-visible:ring-primary/20 transition-all"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs uppercase font-semibold text-muted-foreground tracking-wide">
                    Password
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:text-primary/80 hover:underline font-medium transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 bg-background border-muted rounded-lg shadow-sm focus-visible:ring-primary/20 transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Submit */}
              <div className="space-y-6 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remember"
                    className="w-4 h-4 rounded border-input text-primary focus:ring-primary/20 cursor-pointer accent-primary"
                  />
                  <Label htmlFor="remember" className="text-sm font-medium text-muted-foreground cursor-pointer select-none">
                    Remember me for 30 days
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-base font-semibold shadow-sm hover:shadow-md rounded-xl transition-all active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                      Signing in...
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </div>
            </form>
          </Card>

          {/* Footer */}
          <div className="mt-8 text-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-muted/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-50 px-2 text-slate-500">Or</span>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Need help?{" "}
              <a href="https://wa.me/252618553566" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium transition-colors">Contact Support</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
