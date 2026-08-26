"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  BookOpen,
  DollarSign,
  FileText,
  School,
  ChevronDown,
  ChevronRight,
  LogOut,
  Calendar,
  Mail,
  UserPlus,
  Handshake,
  ScrollText,
  Wallet,
  Briefcase,
  ClipboardList,
  X,
  Shield,
} from "lucide-react"
import { api } from "@/lib/api"
import type { AppRole } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface SidebarProps {
  isOpen: boolean
  mobileOpen?: boolean
  isMobile?: boolean
  role?: AppRole | null
  onNavigate?: () => void
  onClose?: () => void
}

const allMenuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: Users },
  { href: "/registrars", label: "Registration Users", icon: UserPlus },
  { href: "/teachers", label: "Teachers", icon: Users },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/classes", label: "Classes", icon: School },
  { href: "/partners", label: "Partners", icon: Handshake },
  { href: "/attendance-management", label: "Attendance", icon: Calendar },
  { href: "/contracts", label: "Contracts", icon: ScrollText },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/finance-users", label: "Finance Users", icon: UserPlus },
  { href: "/payments", label: "Payments", icon: DollarSign },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/finance/student-fees", label: "Student Fees", icon: DollarSign },
  { href: "/finance/teacher-payroll", label: "Teacher Payroll", icon: ScrollText },
  { href: "/finance/partners", label: "Partner Payouts", icon: Handshake },
  { href: "/finance/reports", label: "Financial Reports", icon: FileText },
  { href: "/finance/expenses", label: "Income & Expenses", icon: FileText },
  { href: "/permissions", label: "Role Permissions", icon: Shield },
  { href: "/audit", label: "Audit Log", icon: ClipboardList },
]

const teacherMenuItems = [
  { href: "/attendance", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teacher-classes", label: "Classes", icon: School },
  { href: "/attendance-report", label: "Attendance Report", icon: FileText },
]

type TeacherSidebarClass = {
  id: string
  name: string
  level: string | null
}

function normalizeClientRole(role: unknown): AppRole | null {
  if (role === "Register") return "REGISTRAR"
  if (role === "ADMIN" || role === "TEACHER" || role === "REGISTRAR" || role === "FINANCE") return role
  return null
}

export default function Sidebar({
  isOpen,
  mobileOpen = false,
  isMobile = false,
  role: roleProp,
  onNavigate,
  onClose,
}: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [role, setRole] = useState<AppRole | null>(roleProp ?? null)
  const [allowedRoutes, setAllowedRoutes] = useState<string[] | null>(null)
  const [teacherClasses, setTeacherClasses] = useState<TeacherSidebarClass[]>([])
  const [classesLoading, setClassesLoading] = useState(false)
  const [classesOpen, setClassesOpen] = useState(pathname.startsWith("/teacher-classes"))
  const selectedClassId = searchParams.get("classId")
  const [profile, setProfile] = useState<{ name: string; email: string; role: AppRole } | null>(null)

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

  useEffect(() => {
    setRole(roleProp ?? null)
  }, [roleProp])

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ role: AppRole; allowedRoutes: string[]; name: string; email: string }>("/api/auth/me")
        const resolved = normalizeClientRole(res.data.role)
        if (resolved) setRole(resolved)
        if (res.data.allowedRoutes) setAllowedRoutes(res.data.allowedRoutes)
        if (res.data.name) {
          setProfile({
            name: res.data.name,
            email: res.data.email || "",
            role: res.data.role,
          })
        }
      } catch {
        // keep server-provided role
      }
    })()
  }, [])

  useEffect(() => {
    if (pathname.startsWith("/teacher-classes")) setClassesOpen(true)
  }, [pathname])

  useEffect(() => {
    if (role !== "TEACHER") {
      setTeacherClasses([])
      return
    }

    let cancelled = false
    setClassesLoading(true)
    void api
      .get<TeacherSidebarClass[]>("/api/attendance/classes")
      .then((response) => {
        if (!cancelled) setTeacherClasses(response.data)
      })
      .catch(() => {
        if (!cancelled) setTeacherClasses([])
      })
      .finally(() => {
        if (!cancelled) setClassesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [role])

  const menuItems = role === "TEACHER"
    ? teacherMenuItems
    : allowedRoutes
      ? allMenuItems.filter((item) => allowedRoutes.includes(item.href))
      : role === "ADMIN"
        ? allMenuItems
        : []

  return (
    <aside
      className={cn(
        "bg-sidebar border-r border-sidebar-border flex flex-col h-svh shrink-0",
        "fixed inset-y-0 left-0 z-50 w-[min(100vw,280px)]",
        "transition-transform duration-300 ease-in-out will-change-transform",
        "md:static md:z-auto md:w-auto md:translate-x-0",
        isMobile ? (mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full") : "translate-x-0",
        !isMobile && (isOpen ? "md:w-64" : "md:w-[72px]"),
      )}
      aria-hidden={isMobile ? !mobileOpen : false}
    >
      <div className="relative flex items-center justify-between gap-2 p-4 border-b border-sidebar-border">
        <img
          src="/images/logo dero isntiute-01.png"
          alt="Deero Institute Logo"
          className={cn("object-contain mx-auto transition-all", isOpen ? "w-full max-h-20" : "h-10 w-10")}
        />
        {isMobile && mobileOpen && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="absolute right-3 top-4 rounded-lg p-2 text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {role === "REGISTRAR" && isOpen && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admission Portal</p>
        </div>
      )}

      {role === "FINANCE" && isOpen && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Finance Portal</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const label = item.label
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

          if (role === "TEACHER" && item.href === "/teacher-classes") {
            if (!isOpen) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-200",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/80",
                  )}
                  title={label}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                </Link>
              )
            }

            return (
              <Collapsible key={item.href} open={classesOpen} onOpenChange={setClassesOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-200",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/80",
                    )}
                    aria-label="Toggle assigned classes"
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="flex-1 text-left text-sm font-medium">{label}</span>
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform duration-200", classesOpen && "rotate-180")}
                    />
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="ml-5 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                    {classesLoading ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Loading classes...</p>
                    ) : teacherClasses.length ? (
                      teacherClasses.map((teacherClass) => {
                        const classActive = isActive && selectedClassId === teacherClass.id
                        return (
                          <Link
                            key={teacherClass.id}
                            href={`/teacher-classes?classId=${encodeURIComponent(teacherClass.id)}`}
                            onClick={onNavigate}
                            className={cn(
                              "block rounded-md px-3 py-2 text-sm transition-colors",
                              classActive
                                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                            )}
                            title={teacherClass.name}
                          >
                            <span className="block truncate">{teacherClass.name}</span>
                            {teacherClass.level && (
                              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                {teacherClass.level}
                              </span>
                            )}
                          </Link>
                        )
                      })
                    ) : (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No assigned classes</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/80",
              )}
              title={!isOpen ? label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {isOpen && (
                <>
                  <span className="flex-1 text-left text-sm font-medium">{label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 opacity-80" />}
                </>
              )}
            </Link>
          )
        })}
      </nav>


    </aside>
  )
}
