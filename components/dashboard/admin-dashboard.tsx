"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Sidebar from "@/components/layout/sidebar"
import TopBar from "@/components/layout/topbar"
import DashboardContent from "@/components/dashboard/dashboard-content"
import { useIsMobile } from "@/hooks/use-mobile"

export default function AdminDashboard() {
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopExpanded, setDesktopExpanded] = useState(true)
  const [currentSection, setCurrentSection] = useState("dashboard")

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
    if (isMobile) setMobileOpen((open) => !open)
    else setDesktopExpanded((open) => !open)
  }

  const showLabels = isMobile ? true : desktopExpanded

  return (
    <div className="flex h-svh overflow-hidden">
      {isMobile && mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] md:hidden"
        />
      )}

      <Sidebar
        isOpen={showLabels}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
        role="ADMIN"
        onNavigate={() => setMobileOpen(false)}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <TopBar
          menuOpen={isMobile ? mobileOpen : desktopExpanded}
          onMenuClick={toggleSidebar}
          role="ADMIN"
        />

        <main className="flex-1 overflow-auto bg-muted/30">
          <DashboardContent currentSection={currentSection} />
        </main>
      </div>
    </div>
  )
}
