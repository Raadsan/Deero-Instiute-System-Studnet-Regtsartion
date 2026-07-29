"use client"

import { useEffect, useState } from "react"

import { api } from "@/lib/api"
import type { AppRole } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"

export type ProfileUser = {
  name: string
  email: string
  role: AppRole
}

type ProfileDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: ProfileUser | null
  onUpdated: (user: ProfileUser) => void
}

export default function ProfileDialog({
  open,
  onOpenChange,
  user,
  onUpdated,
}: ProfileDialogProps) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setName(user?.name ?? "")
  }, [open, user])

  const save = async () => {
    const normalizedName = name.trim().replace(/\s+/g, " ")
    if (normalizedName.length < 2) {
      toast({ title: "Enter your full name", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const response = await api.patch<ProfileUser>("/api/auth/me", { name: normalizedName })
      onUpdated(response.data)
      onOpenChange(false)
      toast({ title: "Profile updated", description: "Your name was saved successfully." })
    } catch (error: any) {
      toast({
        title: "Profile update failed",
        description: error?.response?.data?.message ?? "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>My Profile</DialogTitle>
          <DialogDescription>View your account and update the name shown in the system.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="profileName">Full Name</Label>
            <Input
              id="profileName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profileEmail">Email</Label>
            <Input id="profileEmail" value={user?.email ?? ""} readOnly className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profileRole">Role</Label>
            <Input id="profileRole" value={user?.role ?? ""} readOnly className="bg-muted capitalize" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving && <Spinner className="mr-2" />}
            Save Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
