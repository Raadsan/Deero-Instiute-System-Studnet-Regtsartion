"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Pencil, Trash2, Search, UserPlus, Mail } from "lucide-react"

import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type RegistrarRow = {
  id: string
  name: string
  email: string
  isActive: boolean
  studentsRegistered: number
}

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

function formatPersonName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function RegistrarsList() {
  const [registrars, setRegistrars] = useState<RegistrarRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RegistrarRow | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isActive, setIsActive] = useState(true)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({})

  const resetForm = () => {
    setEditing(null)
    setName("")
    setEmail("")
    setPassword("")
    setIsActive(true)
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (registrar: RegistrarRow) => {
    setEditing(registrar)
    setName(registrar.name ?? "")
    setEmail(registrar.email ?? "")
    setPassword("")
    setIsActive(Boolean(registrar.isActive))
    setFormOpen(true)
  }

  const fetchRegistrars = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<RegistrarRow[]>("/api/registrars?includeInactive=true")
      setRegistrars(res.data)
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchRegistrars()
  }, [])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return registrars
    return registrars.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
  }, [registrars, searchTerm])

  const activeCount = useMemo(() => registrars.filter((r) => r.isActive).length, [registrars])

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" })
      return
    }

    if (!editing && password.trim().length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        isActive,
      }
      if (password.trim()) payload.password = password.trim()

      if (editing) {
        await api.patch(`/api/registrars/${editing.id}`, payload)
        toast({ title: "Registration user updated successfully" })
      } else {
        await api.post("/api/registrars", payload)
        toast({ title: "Registration user created successfully" })
      }

      setFormOpen(false)
      resetForm()
      await fetchRegistrars()
    } catch (e: any) {
      toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/api/registrars/${deleteId}`)
      toast({ title: "Registration user deleted successfully" })
      await fetchRegistrars()
    } catch (e: any) {
      toast({ title: "Delete failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const toggleStatus = async (registrar: RegistrarRow) => {
    if (statusUpdating[registrar.id]) return
    const nextIsActive = !registrar.isActive
    const prevIsActive = registrar.isActive

    setStatusUpdating((cur) => ({ ...cur, [registrar.id]: true }))
    setRegistrars((cur) => cur.map((r) => (r.id === registrar.id ? { ...r, isActive: nextIsActive } : r)))

    try {
      await api.patch(`/api/registrars/${registrar.id}`, {
        name: registrar.name,
        email: registrar.email,
        isActive: nextIsActive,
      })
      toast({ title: nextIsActive ? "User is now ACTIVE" : "User is now INACTIVE" })
    } catch (e: any) {
      setRegistrars((cur) => cur.map((r) => (r.id === registrar.id ? { ...r, isActive: prevIsActive } : r)))
      toast({ title: "Update failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setStatusUpdating((cur) => {
        const next = { ...cur }
        delete next[registrar.id]
        return next
      })
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#003D9E]/10 via-background to-[#EC4724]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#003D9E]/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-background/80 border border-primary/15 px-3 py-1 text-xs font-medium text-primary">
                <UserPlus className="w-3.5 h-3.5" />
                {filtered.length} user{filtered.length === 1 ? "" : "s"}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
                {activeCount} active
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Registration Users</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              Manage admission staff who register students and assign classes.
            </p>
          </div>
          <Button onClick={openCreate} size="lg" className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-6 shrink-0">
            <Plus className="w-5 h-5" /> Add User
          </Button>
        </div>
      </div>

      <Card className="p-4 sm:p-5 border-muted/50 shadow-sm">
        <div className="max-w-xl space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Search Users</Label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-10 h-11 rounded-lg bg-background border-muted shadow-sm focus-visible:ring-primary/20"
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <Spinner className="w-8 h-8 text-primary" />
          <p>Loading registration users...</p>
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm bg-destructive/5 text-destructive border-destructive/20 shadow-sm">{error}</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <div className="p-4 rounded-full bg-muted">
            <Search className="w-8 h-8 opacity-50" />
          </div>
          <p className="text-lg font-medium">No registration users found</p>
          <p className="text-sm">Add admission staff to help register students.</p>
        </Card>
      ) : (
        <div className="rounded-xl border border-muted/50 bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-4 pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground min-w-[220px]">Name</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell min-w-[200px]">Email</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center min-w-[120px]">Students</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center w-[120px]">Status</TableHead>
                  <TableHead className="text-right pr-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((registrar) => (
                  <TableRow key={registrar.id} className="group hover:bg-muted/40 transition-colors border-b-muted/40 last:border-0">
                    <TableCell className="py-4 pl-6 align-middle">
                      <div className="space-y-1">
                        <div className="text-base text-foreground font-semibold tracking-tight">
                          {formatPersonName(registrar.name)}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground md:hidden">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[200px]">{registrar.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-4 align-middle">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-3.5 h-3.5 shrink-0 text-primary/70" />
                        <span>{registrar.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 align-middle text-center">
                      <Badge variant="outline" className="rounded-full font-medium border-primary/20 text-primary bg-primary/5">
                        {registrar.studentsRegistered}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 align-middle text-center">
                      <Badge
                        asChild
                        variant="secondary"
                        className={`inline-flex min-w-[88px] justify-center rounded-full shadow-none px-3 py-1 text-xs font-semibold transition ${
                          registrar.isActive
                            ? "bg-[#003D9E]/10 text-[#003D9E] hover:bg-[#003D9E]/15 border border-[#003D9E]/20"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                        } ${statusUpdating[registrar.id] ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleStatus(registrar)}
                          disabled={statusUpdating[registrar.id]}
                          title="Click to toggle status"
                        >
                          {registrar.isActive ? "Active" : "Inactive"}
                        </button>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-4 pr-6 align-middle">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(registrar)}
                          aria-label="Edit registration user"
                          className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(registrar.id)}
                          aria-label="Delete registration user"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Registration User" : "Add Registration User"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update profile, password, or access for this admission user."
                : "Create an admission account that can register students and assign classes."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="registrarName">Name</Label>
              <Input id="registrarName" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrarEmail">Email</Label>
              <Input id="registrarEmail" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrarPassword">{editing ? "New Password (optional)" : "Password"}</Label>
              <Input
                id="registrarPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editing ? "Leave blank to keep current" : ""}
              />
            </div>

            {editing && (
              <div className="flex items-center justify-between rounded-lg border border-muted/60 bg-muted/10 p-4">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Deactivate to prevent login.</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? (
                <>
                  <Spinner className="mr-2" />
                  Saving...
                </>
              ) : editing ? (
                "Save Changes"
              ) : (
                "Create User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete registration user?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this admission account.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Spinner className="mr-2" />
                  Working...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
