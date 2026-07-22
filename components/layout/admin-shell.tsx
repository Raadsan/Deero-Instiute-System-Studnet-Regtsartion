"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Sidebar from "@/components/layout/sidebar"
import TopBar from "@/components/layout/topbar"
import { useIsMobile } from "@/hooks/use-mobile"
import type { AppRole } from "@/lib/auth"

export default function AdminShell({
  role,
  children,
}: Readonly<{
  role: AppRole | null
  children: React.ReactNode
}>) {
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopExpanded, setDesktopExpanded] = useState(true)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  useEffect(() => {
    document.body.style.overflow = isMobile && mobileOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [isMobile, mobileOpen])

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileOpen((open) => !open)
    } else {
      setDesktopExpanded((open) => !open)
    }
  }

  const closeMobileSidebar = () => setMobileOpen(false)
  const showLabels = isMobile ? true : desktopExpanded

  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      {isMobile && mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={closeMobileSidebar}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] md:hidden"
        />
      )}

      <Sidebar
        isOpen={showLabels}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
        role={role}
        onNavigate={closeMobileSidebar}
        onClose={closeMobileSidebar}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <TopBar
          menuOpen={isMobile ? mobileOpen : desktopExpanded}
          onMenuClick={toggleSidebar}
          role={role}
        />

        <main className="flex-1 overflow-auto bg-muted/30">{children}</main>
      </div>
    </div>
  )
}
