"use client"

import { useEffect, useMemo, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"

type ManagedRole = "TEACHER" | "REGISTRAR" | "FINANCE"

type RouteConfig = {
  path: string
  label: string
  defaultRoles: string[]
}

type Permission = {
  role: ManagedRole
  route: string
  allowed: boolean
}

type PermissionsResponse = {
  configurableRoutes: RouteConfig[]
  defaultPermissions: Record<string, string[]>
  permissions: Permission[]
}

const roles: Array<{ value: ManagedRole; label: string }> = [
  { value: "REGISTRAR", label: "Registrar" },
  { value: "TEACHER", label: "Teacher" },
  { value: "FINANCE", label: "Finance" },
]

export default function PermissionsPage() {
  const [data, setData] = useState<PermissionsResponse | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    void api
      .get<PermissionsResponse>("/api/permissions")
      .then((response) => setData(response.data))
      .catch(() =>
        toast({ title: "Unable to load permissions", description: "Please refresh and try again.", variant: "destructive" }),
      )
  }, [])

  const permissionMap = useMemo(() => {
    const map = new Map<string, boolean>()
    if (!data) return map

    for (const role of roles) {
      for (const route of data.configurableRoutes) {
        map.set(`${role.value}:${route.path}`, data.defaultPermissions[role.value]?.includes(route.path) ?? false)
      }
    }
    for (const permission of data.permissions) {
      map.set(`${permission.role}:${permission.route}`, permission.allowed)
    }
    return map
  }, [data])

  async function updatePermission(role: ManagedRole, route: string, allowed: boolean) {
    const key = `${role}:${route}`
    setSaving(key)
    try {
      await api.post("/api/permissions", { role, route, allowed })
      setData((current) => {
        if (!current) return current
        const permissions = current.permissions.filter((item) => !(item.role === role && item.route === route))
        return { ...current, permissions: [...permissions, { role, route, allowed }] }
      })
      toast({ title: "Permission updated", description: `${role} access was ${allowed ? "enabled" : "disabled"}.` })
    } catch {
      toast({ title: "Update failed", description: "The permission was not changed.", variant: "destructive" })
    } finally {
      setSaving(null)
    }
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    )
  }

  const routes = data.configurableRoutes.filter((route) => route.path !== "/permissions" && route.path !== "/dashboard")

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary p-3 text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <Badge variant="secondary" className="mb-2">Administrator only</Badge>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Roles & Permissions</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose which areas each staff role can see in the sidebar and access after their next sign-in.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Route access</CardTitle>
          <CardDescription>Admin access is always enabled and cannot be removed.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="border-b p-3 text-left text-sm font-semibold">System area</th>
                {roles.map((role) => (
                  <th key={role.value} className="border-b p-3 text-center text-sm font-semibold">{role.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <tr key={route.path} className="hover:bg-muted/40">
                  <td className="border-b p-3">
                    <p className="text-sm font-medium">{route.label}</p>
                    <p className="text-xs text-muted-foreground">{route.path}</p>
                  </td>
                  {roles.map((role) => {
                    const key = `${role.value}:${route.path}`
                    return (
                      <td key={role.value} className="border-b p-3 text-center">
                        <Switch
                          checked={permissionMap.get(key) ?? false}
                          disabled={saving === key}
                          aria-label={`${role.label} access to ${route.label}`}
                          onCheckedChange={(checked) => void updatePermission(role.value, route.path, checked)}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
