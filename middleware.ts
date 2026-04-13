import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const publicPaths = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ];

  const isPublic = publicPaths.some((p) =>
    nextUrl.pathname.startsWith(p)
  );

  if (isPublic) return NextResponse.next();

  if (!isLoggedIn) {
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(nextUrl.pathname)}`, nextUrl)
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox).*)",
  ],
};