import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getSessionFromRequestCookies } from "@/lib/auth"

export default async function UnauthorizedPage() {
  const session = await getSessionFromRequestCookies()
  const backHref = session?.role === "TEACHER" ? "/attendance" : "/dashboard"

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold">Unauthorized</h1>
        <p className="text-muted-foreground">You don’t have permission to view this page.</p>
        <div className="flex items-center justify-center gap-2">
          <Button asChild variant="secondary">
            <Link href="/login">Go to login</Link>
          </Button>
          <Button asChild>
            <Link href={backHref}>Back</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
