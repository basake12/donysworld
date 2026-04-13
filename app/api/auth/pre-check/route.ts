import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

/**
 * POST /api/auth/pre-check
 *
 * Checks whether an email is eligible to attempt sign-in before
 * NextAuth is called, so we can surface specific error codes to the UI.
 * Password validation stays inside NextAuth — we never touch it here.
 *
 * Response codes:
 *   OK               – go ahead and call signIn()
 *   NO_ACCOUNT       – no user found for this email
 *   PENDING_APPROVAL – model not yet approved by admin
 *   REJECTED         – model application was rejected
 *   SUSPENDED        – model account suspended
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ code: "MISSING_EMAIL" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        role: true,
        modelProfile: { select: { status: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ code: "NO_ACCOUNT" });
    }

    if (user.role === Role.MODEL) {
      const status = user.modelProfile?.status;
      if (status === "PENDING_APPROVAL") return NextResponse.json({ code: "PENDING_APPROVAL" });
      if (status === "REJECTED")         return NextResponse.json({ code: "REJECTED" });
      if (status === "SUSPENDED")        return NextResponse.json({ code: "SUSPENDED" });
    }

    return NextResponse.json({ code: "OK" });
  } catch {
    return NextResponse.json({ code: "GENERIC" }, { status: 500 });
  }
}