/**
 * app/api/auth/verify-email-change/route.ts
 *
 * POST — consume an email-change token and swap the user's email.
 *   Body: { token: string }
 *
 * Auth: NOT required. The token itself proves ownership of the new address
 * (it was only delivered there). Tokens are single-use and expire in 30 min.
 *
 * If the new email has been claimed by someone else in the meantime
 * (unlikely race), we reject with 409.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") return err("Token required");

    const record = await prisma.emailChangeToken.findUnique({
      where: { token },
      select: {
        id: true, userId: true, newEmail: true, expiresAt: true,
        user: { select: { email: true } },
      },
    });

    if (!record) return err("Invalid or already-used link", 404);

    if (record.expiresAt < new Date()) {
      // Clean up the stale token so reusing UI state doesn't lie.
      await prisma.emailChangeToken.delete({ where: { id: record.id } });
      return err("This link has expired. Request a new one.", 410);
    }

    // Race check — someone else might have claimed newEmail between request and verify.
    const conflict = await prisma.user.findUnique({
      where:  { email: record.newEmail },
      select: { id: true },
    });
    if (conflict && conflict.id !== record.userId) {
      await prisma.emailChangeToken.delete({ where: { id: record.id } });
      return err("That email is no longer available", 409);
    }

    // Swap email + consume token in a single transaction.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data:  { email: record.newEmail },
      }),
      prisma.emailChangeToken.delete({ where: { id: record.id } }),
      // Best-effort: drop any dangling password-reset tokens for the OLD email
      // so a stale reset link doesn't get a free ride to the new email's account.
      prisma.passwordResetToken.deleteMany({ where: { email: record.user.email } }),
    ]);

    return NextResponse.json({
      message: "Email changed successfully",
      newEmail: record.newEmail,
    });
  } catch (e) {
    console.error("[verify-email-change]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}