import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";

// ─────────────────────────────────────────────
// ROUTE MAPS
// ─────────────────────────────────────────────

const PUBLIC_ROUTES = ["/", "/login", "/register", "/age-gate"];

const ROLE_ROUTES: Record<Role, string> = {
  CLIENT: "/client/dashboard",
  MODEL: "/model/dashboard",
  ADMIN: "/admin/dashboard",
};

const PROTECTED_PREFIXES: Record<string, Role> = {
  "/client": Role.CLIENT,
  "/model": Role.MODEL,
  "/admin": Role.ADMIN,
};

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────

export default auth(function middleware(req: NextRequest & { auth: any }) {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Allow public routes always
  if (PUBLIC_ROUTES.some((route) => pathname === route)) {
    return NextResponse.next();
  }

  // Allow Next.js internals and API auth routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Not logged in — redirect to login
  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = session.user.role as Role;

  // Check if user is trying to access a protected prefix
  for (const [prefix, requiredRole] of Object.entries(PROTECTED_PREFIXES)) {
    if (pathname.startsWith(prefix)) {
      if (userRole !== requiredRole) {
        // Redirect to their own dashboard
        const correctDashboard = ROLE_ROUTES[userRole];
        return NextResponse.redirect(new URL(correctDashboard, req.url));
      }
      return NextResponse.next();
    }
  }

  // Logged-in user hitting root — redirect to their dashboard
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(ROLE_ROUTES[userRole], req.url)
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|icons|manifest.json).*)",
  ],
};