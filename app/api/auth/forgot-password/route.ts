/**
 * app/api/auth/forgot-password/route.ts
 *
 * Unchanged behaviour — refactored to use the shared lib/email.ts sender
 * so password-reset and email-change share one transport, one template frame,
 * and one env-var contract.
 *
 * Still returns 200 regardless of whether the email exists (enumeration
 * defense).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, wrapBrandedEmail } from "@/lib/email";
import crypto from "crypto";

const RESET_TOKEN_TTL_MINUTES = 30;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ ok: true });

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, fullName: true, email: true },
    });

    if (!user) return NextResponse.json({ ok: true });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.upsert({
      where: { email: user.email },
      update: { token, expiresAt },
      create: { email: user.email, token, expiresAt },
    });

    const baseUrl =
      process.env.NEXTAUTH_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your password — Dony's World",
      html: wrapBrandedEmail(`
        <p style="margin:0 0 8px;font-size:22px;font-weight:900;color:#f0e6d0;">
          Reset your password
        </p>
        <p style="margin:0 0 24px;font-size:14px;color:#7a7060;line-height:1.6;">
          Hi ${user.fullName}, we received a request to reset your password.
          Click the button below — the link expires in <strong style="color:#c9a84c;">${RESET_TOKEN_TTL_MINUTES} minutes</strong>.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#c9a84c,#e8c96a);color:#0a0a0a;font-weight:900;font-size:14px;text-decoration:none;border-radius:12px;">
          Reset Password
        </a>
        <p style="margin:24px 0 0;font-size:12px;color:#4a4440;line-height:1.6;">
          If you didn&rsquo;t request this, you can safely ignore this email.
          Your password won&rsquo;t change.
        </p>
        <p style="margin:8px 0 0;font-size:11px;color:#3a3430;word-break:break-all;">
          Or copy this link: ${resetUrl}
        </p>
      `),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}