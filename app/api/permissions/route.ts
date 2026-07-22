import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { CONFIGURABLE_ROUTES, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await getSessionFromRequestCookies();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const permissions = await prisma.rolePermission.findMany();
    return NextResponse.json({
      configurableRoutes: CONFIGURABLE_ROUTES,
      defaultPermissions: DEFAULT_ROLE_PERMISSIONS,
      permissions,
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequestCookies();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { role, route, allowed } = body;

    if (!role || !route || typeof allowed !== "boolean") {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const managedRoles = ["TEACHER", "REGISTRAR", "FINANCE"];
    const configurableRoute = CONFIGURABLE_ROUTES.some((item) => item.path === route && item.path !== "/permissions");
    if (!managedRoles.includes(role) || !configurableRoute) {
      return NextResponse.json({ message: "Invalid role or route" }, { status: 400 });
    }

    const permission = await prisma.rolePermission.upsert({
      where: {
        role_route: {
          role,
          route,
        },
      },
      update: { allowed },
      create: { role, route, allowed },
    });

    return NextResponse.json(permission);
  } catch (error) {
    console.error("Error updating permission:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
