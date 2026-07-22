import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

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

const ADMIN_ONLY = [
  "/dashboard",
  "/teachers",
  "/registrars",
  "/courses",
  "/classes",
  "/partners",
  "/contracts",
  "/attendance-management",
  "/payments",
  "/audit",
  "/reports",
  "/messages",
  "/certificates",
  "/finance-users",
];

const FINANCE_ROUTES = ["/finance", "/staff"];

const STUDENT_ROUTES = ["/students"];

const TEACHER_ONLY = ["/attendance"];

function matchesPathPrefix(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`)
}

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
    const { payload } = await jwtVerify(token, secret);
    const role = normalizeRole(payload.role);

    if (!role) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (FINANCE_ROUTES.some((path) => matchesPathPrefix(pathname, path))) {
      if (role !== "ADMIN" && role !== "FINANCE") {
        return NextResponse.redirect(new URL("/unauthorized", req.url));
      }
      return NextResponse.next();
    }

    if (STUDENT_ROUTES.some((path) => matchesPathPrefix(pathname, path))) {
      if (role !== "ADMIN" && role !== "REGISTRAR") {
        return NextResponse.redirect(new URL("/unauthorized", req.url));
      }
      return NextResponse.next();
    }

    if (ADMIN_ONLY.some((path) => matchesPathPrefix(pathname, path))) {
      if (role !== "ADMIN") {
        if (role === "REGISTRAR") {
          return NextResponse.redirect(new URL("/students", req.url));
        }
        if (role === "FINANCE") {
          return NextResponse.redirect(new URL("/finance", req.url));
        }
        return NextResponse.redirect(new URL("/unauthorized", req.url));
      }
    }

    if (TEACHER_ONLY.some((path) => matchesPathPrefix(pathname, path)) && role !== "TEACHER") {
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
    "/staff",
    "/staff/:path*",
    "/finance-users",
    "/finance-users/:path*",
  ],
};
