"use client"

import { useMemo, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Menu, Moon, Sun, Bell, Settings, User, X, KeyRound } from "lucide-react"
import { useTheme } from "next-themes"

import type { AppRole } from "@/lib/auth"
import ChangePasswordDialog from "@/components/auth/change-password-dialog"
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

  useEffect(() => setMounted(true), [])

  const derivedTitle = useMemo(() => {
    if (title) return title
    if (pathname.startsWith("/classes")) return "Classes"
    if (pathname.startsWith("/attendance-management")) return "Attendance"
    if (pathname.startsWith("/attendance")) return role === "TEACHER" ? "Teacher Dashboard" : "Attendance"
    if (pathname.startsWith("/registrars")) return "Registration Users"
    if (pathname.startsWith("/students")) return "Students"
    if (pathname.startsWith("/teachers")) return "Teachers"
    if (pathname.startsWith("/courses")) return "Courses"
    if (pathname.startsWith("/finance")) return "Finance"
    if (pathname.startsWith("/staff")) return "Staff"
    if (pathname.startsWith("/finance-users")) return "Finance Users"
    if (pathname.startsWith("/partners")) return "Partners"
    if (pathname.startsWith("/contracts")) return "Contracts"
    if (pathname.startsWith("/payments")) return "Payments"
    if (pathname.startsWith("/reports")) return "Reports"
    if (pathname.startsWith("/messages")) return "Messages"
    if (role === "REGISTRAR") return "Student Registration"
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
              className="hidden sm:inline-flex p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Account menu"
            >
              <User className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
              <KeyRound className="h-4 w-4" />
              Change Password
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </header>
  )
}
