import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/reset-password
 *
 * Validates the reset token and updates the user's password.
 *
 * Body: { token: string, password: string }
 *
 * Responses:
 *   200  – password updated
 *   400  – TOKEN_INVALID_OR_EXPIRED
 *   422  – password too short
 *   500  – server error
 */
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "PASSWORD_TOO_SHORT", message: "Password must be at least 8 characters." },
        { status: 422 }
      );
    }

    // ── Find the token record ────────────────────────
    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!record || record.expiresAt < new Date()) {
      // Delete expired record if it exists
      if (record) {
        await prisma.passwordResetToken.delete({ where: { token } }).catch(() => {});
      }
      return NextResponse.json(
        { error: "TOKEN_INVALID_OR_EXPIRED" },
        { status: 400 }
      );
    }

    // ── Hash the new password ────────────────────────
    const hashed = await bcrypt.hash(password, 12);

    // ── Update user + delete token in a transaction ──
    await prisma.$transaction([
      prisma.user.update({
        where: { email: record.email },
        data: { password: hashed },
      }),
      prisma.passwordResetToken.delete({
        where: { token },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}