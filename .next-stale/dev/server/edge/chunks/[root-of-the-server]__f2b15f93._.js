(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["chunks/[root-of-the-server]__f2b15f93._.js",
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[project]/middleware.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "middleware",
    ()=>middleware
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$api$2f$server$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/esm/api/server.js [middleware-edge] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/esm/server/web/exports/index.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$verify$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/webapi/jwt/verify.js [middleware-edge] (ecmascript)");
;
;
function getJwtSecret() {
    const value = process.env.JWT_SECRET;
    if (!value) return null;
    return new TextEncoder().encode(value);
}
function normalizeRole(role) {
    if (role === "Register") return "REGISTRAR";
    if (role === "ADMIN" || role === "TEACHER" || role === "REGISTRAR" || role === "FINANCE") return role;
    return null;
}
function matchesPathPrefix(pathname, base) {
    return pathname === base || pathname.startsWith(`${base}/`);
}
const protectedRouteBases = [
    "/finance/student-fees",
    "/finance/teacher-payroll",
    "/finance/partners",
    "/finance/expenses",
    "/finance/audit",
    "/finance/reports",
    "/attendance-management",
    "/finance-users",
    "/dashboard",
    "/students",
    "/teachers",
    "/registrars",
    "/courses",
    "/classes",
    "/partners",
    "/contracts",
    "/attendance",
    "/payments",
    "/audit",
    "/reports",
    "/messages",
    "/certificates",
    "/permissions",
    "/finance"
];
async function middleware(req) {
    const token = req.cookies.get("token")?.value;
    const pathname = req.nextUrl.pathname;
    if (pathname.startsWith("/login") || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password")) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    if (!token) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/login", req.url));
    }
    const secret = getJwtSecret();
    if (!secret) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/login?error=server_config", req.url));
    }
    try {
        const { payload } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$verify$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["jwtVerify"])(token, secret);
        const role = normalizeRole(payload.role);
        if (!role) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/login", req.url));
        }
        const allowedRoutes = payload.allowedRoutes || [];
        const matchedRoute = protectedRouteBases.find((route)=>matchesPathPrefix(pathname, route));
        const isAllowed = matchedRoute ? allowedRoutes.includes(matchedRoute) : false;
        if (!isAllowed) {
            // Redirect based on role defaults if they try to access an unauthorized route
            if (role === "REGISTRAR") {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/students", req.url));
            }
            if (role === "FINANCE") {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/finance", req.url));
            }
            if (role === "TEACHER") {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/attendance", req.url));
            }
            if (role === "ADMIN") {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/dashboard", req.url));
            }
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/unauthorized", req.url));
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    } catch  {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/login", req.url));
    }
}
const config = {
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
        "/finance-users",
        "/finance-users/:path*",
        "/permissions",
        "/permissions/:path*"
    ]
};
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__f2b15f93._.js.map