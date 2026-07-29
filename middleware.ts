import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_TTL_SECONDS } from "@/lib/session-config";

function getJwtSecret() {
  const value = process.env.JWT_SECRET
  if (!value) return null
  return new TextEncoder().encode(value)
}

function normalizeRole(role: unknown): "ADMIN" | "TEACHER" | "REGISTRAR" | "FINANCE" | null {
  if (role === "Register") return "REGISTRAR"
  if (role === "ADMIN" || role === "TEACHER" || role === "REGISTRAR" || role === "FINANCE") return role
  return null
}

function matchesPathPrefix(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`)
}

const protectedRouteBases = [
  "/finance/student-fees", "/finance/teacher-payroll", "/finance/partners", "/finance/expenses",
  "/finance/audit", "/finance/reports", "/attendance-management", "/finance-users", "/dashboard",
  "/students", "/teachers", "/registrars", "/courses", "/classes", "/partners", "/contracts",
  "/attendance", "/teacher-classes", "/attendance-report", "/payments", "/audit", "/reports", "/messages", "/certificates", "/permissions", "/finance",
]

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith("/login") || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password")) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const secret = getJwtSecret()
  if (!secret) {
    return NextResponse.redirect(new URL("/login?error=server_config", req.url))
  }

  try {
    const { payload } = await jwtVerify(token, secret, {
      maxTokenAge: SESSION_TTL_SECONDS,
    });
    const role = normalizeRole(payload.role);

    if (!role) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const allowedRoutes = (payload.allowedRoutes as string[]) || [];
    const matchedRoute = protectedRouteBases.find((route) => matchesPathPrefix(pathname, route));
    const permissionRoute =
      matchedRoute === "/teacher-classes" || matchedRoute === "/attendance-report"
        ? "/attendance"
        : matchedRoute;
    const isAllowed = permissionRoute ? allowedRoutes.includes(permissionRoute) : false;

    if (!isAllowed) {
      // Redirect based on role defaults if they try to access an unauthorized route
      if (role === "REGISTRAR") {
        return NextResponse.redirect(new URL("/students", req.url));
      }
      if (role === "FINANCE") {
        return NextResponse.redirect(new URL("/finance", req.url));
      }
      if (role === "TEACHER") {
        return NextResponse.redirect(new URL("/attendance", req.url));
      }
      if (role === "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/students",
    "/students/:path*",
    "/teachers",
    "/teachers/:path*",
    "/registrars",
    "/registrars/:path*",
    "/courses",
    "/courses/:path*",
    "/classes",
    "/classes/:path*",
    "/partners",
    "/partners/:path*",
    "/contracts",
    "/contracts/:path*",
    "/attendance",
    "/attendance/:path*",
    "/teacher-classes",
    "/teacher-classes/:path*",
    "/attendance-report",
    "/attendance-report/:path*",
    "/attendance-management",
    "/attendance-management/:path*",
    "/payments",
    "/payments/:path*",
    "/audit",
    "/audit/:path*",
    "/reports",
    "/reports/:path*",
    "/messages",
    "/messages/:path*",
    "/certificates",
    "/certificates/:path*",
    "/finance",
    "/finance/:path*",
    "/finance-users",
    "/finance-users/:path*",
    "/permissions",
    "/permissions/:path*",
  ],
};
