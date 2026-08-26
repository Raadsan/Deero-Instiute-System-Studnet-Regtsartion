"use client"

import { useMemo, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Menu, Moon, Sun, Bell, Settings, X, KeyRound, UserRoundPen, LogOut } from "lucide-react"
import { useTheme } from "next-themes"

import type { AppRole } from "@/lib/auth"
import ChangePasswordDialog from "@/components/auth/change-password-dialog"
import ProfileDialog, { type ProfileUser } from "@/components/auth/profile-dialog"
import { api } from "@/lib/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface TopBarProps {
  menuOpen: boolean
  onMenuClick: () => void
  title?: string
  role?: AppRole | null
}

export default function TopBar({ menuOpen, onMenuClick, title, role }: TopBarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profile, setProfile] = useState<ProfileUser | null>(null)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    let active = true
    void api.get<ProfileUser>("/api/auth/me")
      .then((response) => {
        if (active) setProfile(response.data)
      })
      .catch(() => {
        if (active) setProfile(null)
      })
    return () => {
      active = false
    }
  }, [])

  const initials = useMemo(
    () =>
      profile?.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "U",
    [profile?.name],
  )

  const derivedTitle = useMemo(() => {
    if (title) return title
    if (pathname.startsWith("/classes")) return "Classes"
    if (pathname.startsWith("/attendance-management")) return "Attendance"
    if (pathname.startsWith("/teacher-classes")) return "My Classes"
    if (pathname.startsWith("/attendance-report")) return "Attendance Report"
    if (pathname.startsWith("/attendance")) return role === "TEACHER" ? "Teacher Dashboard" : "Attendance"
    if (pathname.startsWith("/permissions")) return "Roles & Permissions"
    if (pathname.startsWith("/registrars")) return "Registration Users"
    if (pathname.startsWith("/students")) return "Students"
    if (pathname.startsWith("/teachers")) return "Teachers"
    if (pathname.startsWith("/courses")) return "Courses"
    if (pathname.startsWith("/finance")) return "Finance"
    if (pathname.startsWith("/finance-users")) return "Finance Users"
    if (pathname.startsWith("/partners")) return "Partners"
    if (pathname.startsWith("/contracts")) return "Contracts"
    if (pathname.startsWith("/payments")) return "Payments"
    if (pathname.startsWith("/reports")) return "Reports"
    if (pathname.startsWith("/messages")) return "Messages"
    if (role === "REGISTRAR") return "Student Registration"
    if (role === "TEACHER") return "Teacher Dashboard"
    return "Admin Dashboard"
  }, [pathname, title, role])

  return (
    <header className="relative z-[60] h-16 bg-card border-b border-border flex items-center justify-between px-3 sm:px-6 shrink-0">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="p-2 hover:bg-muted rounded-lg transition-colors md:hidden"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={onMenuClick}
          aria-label={menuOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="hidden md:inline-flex p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h2 className="text-base sm:text-xl font-semibold text-foreground truncate">{derivedTitle}</h2>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 sm:p-2 hover:bg-muted rounded-lg transition-colors"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-700" />}
          </button>
        )}

        <button type="button" className="p-1.5 sm:p-2 hover:bg-muted rounded-lg transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
        </button>

        <button type="button" className="hidden sm:inline-flex p-2 hover:bg-muted rounded-lg transition-colors">
          <Settings className="w-5 h-5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted transition-colors"
              aria-label="Account menu"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {initials}
              </span>
              {profile?.name && (
                <span className="hidden max-w-32 truncate text-left text-sm font-medium lg:block">
                  {profile.name}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="space-y-1">
              <span className="block truncate">{profile?.name ?? "Account"}</span>
              {profile?.email && (
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {profile.email}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <UserRoundPen className="h-4 w-4" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
              <KeyRound className="h-4 w-4" />
              Change Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                try {
                  await api.post("/api/auth/logout")
                } finally {
                  window.location.href = "/login"
                }
              }}
              className="text-rose-600 focus:text-rose-600 focus:bg-rose-500/10 cursor-pointer"
            >
              <LogOut className="h-4 w-4 text-rose-600" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={profile}
        onUpdated={setProfile}
      />
    </header>
  )
}
