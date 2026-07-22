"use client"

import { useMemo } from "react"
import DashboardMetrics from "@/components/dashboard/dashboard-metrics"
import StudentsList from "@/components/modules/students-list"
import TeachersList from "@/components/modules/teachers-list"
import CoursesList from "@/components/modules/courses-list"
import AttendanceView from "@/components/modules/attendance-view"
import PaymentsView from "@/components/modules/payments-view"
import ReportsView from "@/components/modules/reports-view"

interface DashboardContentProps {
  currentSection: string
}

export default function DashboardContent({ currentSection }: DashboardContentProps) {
  const renderContent = useMemo(() => {
    switch (currentSection) {
      case "dashboard":
        return <DashboardMetrics />
      case "students":
        return <StudentsList />
      case "teachers":
        return <TeachersList />
      case "courses":
        return <CoursesList />
      case "attendance":
        return <AttendanceView />
      case "payments":
        return <PaymentsView />
      case "reports":
        return <ReportsView />
      default:
        return <DashboardMetrics />
    }
  }, [currentSection])

  return renderContent
}
