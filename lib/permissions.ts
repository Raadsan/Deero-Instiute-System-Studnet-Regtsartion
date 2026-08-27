import { prisma } from "@/lib/prisma"

export type RouteConfig = {
  path: string
  label: string
  defaultRoles: string[]
}

export const CONFIGURABLE_ROUTES: RouteConfig[] = [
  { path: "/dashboard", label: "Dashboard", defaultRoles: ["ADMIN"] },
  { path: "/students", label: "Students List & Registration", defaultRoles: ["ADMIN", "REGISTRAR"] },
  { path: "/teachers", label: "Teachers List", defaultRoles: ["ADMIN"] },
  { path: "/registrars", label: "Registration Users", defaultRoles: ["ADMIN"] },
  { path: "/courses", label: "Courses", defaultRoles: ["ADMIN"] },
  { path: "/classes", label: "Classes", defaultRoles: ["ADMIN"] },
  { path: "/partners", label: "Partners", defaultRoles: ["ADMIN"] },
  { path: "/contracts", label: "Contracts", defaultRoles: ["ADMIN"] },
  { path: "/finance", label: "Finance Dashboard", defaultRoles: ["ADMIN", "FINANCE"] },
  { path: "/finance/student-fees", label: "Student Fees", defaultRoles: ["ADMIN", "FINANCE"] },
  { path: "/finance/teacher-payroll", label: "Teacher Payroll", defaultRoles: ["ADMIN", "FINANCE"] },
  { path: "/finance/partners", label: "Partner Payouts", defaultRoles: ["ADMIN", "FINANCE"] },
  { path: "/finance/expenses", label: "Income & Expenses", defaultRoles: ["ADMIN", "FINANCE"] },
  { path: "/finance/audit", label: "Audit Log (Finance)", defaultRoles: ["ADMIN", "FINANCE"] },
  { path: "/finance/reports", label: "Financial Reports", defaultRoles: ["ADMIN", "FINANCE"] },
  { path: "/finance-users", label: "Finance Users", defaultRoles: ["ADMIN"] },
  { path: "/attendance-management", label: "Attendance Management", defaultRoles: ["ADMIN"] },
  { path: "/attendance", label: "Teacher Attendance Taking", defaultRoles: ["ADMIN", "TEACHER"] },
  { path: "/payments", label: "Payments List", defaultRoles: ["ADMIN", "FINANCE"] },
  { path: "/audit", label: "System Audit Log", defaultRoles: ["ADMIN"] },
  { path: "/reports", label: "System Reports", defaultRoles: ["ADMIN"] },
  { path: "/messages", label: "SMS & Email Messages", defaultRoles: ["ADMIN"] },
  { path: "/permissions", label: "Role Permissions", defaultRoles: ["ADMIN"] },
]

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = CONFIGURABLE_ROUTES.reduce(
  (acc, route) => {
    route.defaultRoles.forEach((role) => {
      if (!acc[role]) acc[role] = []
      acc[role].push(route.path)
    })
    return acc
  },
  {} as Record<string, string[]>,
)

export async function getAllowedRoutesForRole(role: string): Promise<string[]> {
  // Admin always has access to all configurable routes
  if (role === "ADMIN") {
    return CONFIGURABLE_ROUTES.map((r) => r.path)
  }

  try {
    const permissions = await prisma.rolePermission.findMany({
      where: { role: role as any },
      select: { route: true, allowed: true },
    })
    const explicit = new Map(permissions.map((permission) => [permission.route, permission.allowed]))
    const defaults = DEFAULT_ROLE_PERMISSIONS[role] ?? []

    return CONFIGURABLE_ROUTES
      .filter((route) => explicit.get(route.path) ?? defaults.includes(route.path))
      .map((route) => route.path)
  } catch (error) {
    console.error(`Error loading permissions for role ${role}:`, error)
    return DEFAULT_ROLE_PERMISSIONS[role] ?? []
  }
}

export async function hasRoutePermission(role: string, route: string): Promise<boolean> {
  if (role === "ADMIN") return true
  if (!CONFIGURABLE_ROUTES.some((item) => item.path === route)) return false

  try {
    const permission = await prisma.rolePermission.findUnique({
      where: { role_route: { role: role as any, route } },
      select: { allowed: true },
    })
    return permission?.allowed ?? (DEFAULT_ROLE_PERMISSIONS[role]?.includes(route) ?? false)
  } catch (error) {
    console.error(`Error checking ${route} permission for role ${role}:`, error)
    return DEFAULT_ROLE_PERMISSIONS[role]?.includes(route) ?? false
  }
}
