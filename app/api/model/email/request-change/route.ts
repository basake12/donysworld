/**
 * app/api/model/email/request-change/route.ts
 *
 * Rate limited: a given user cannot request more than MAX_REQUESTS_PER_WINDOW
 * email changes per WINDOW_MINUTES. The counter looks at EmailChangeToken
 * rows keyed by userId — no separate rate-limit table needed.
 *
 * Flow (unchanged from v1):
 *   1. Validate password against current user.
 *   2. Reject if newEmail identical to current, or already taken.
 *   3. Enforce rate limit.
 *   4. Delete any prior pending tokens for this user.
 *   5. Create a fresh token (30 min TTL).
 *   6. Send verification link to NEW email.
 *   7. Send security notification to OLD email.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, wrapBrandedEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const EMAIL_CHANGE_TOKEN_TTL_MINUTES = 30;

// Rate limit: at most N completed requests (whether they were verified or
// abandoned) within the rolling window.
const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_REQUESTS   = 5;

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);

    const { newEmail, currentPassword } = await req.json();

    if (!currentPassword) return err("Current password is required");
    if (!newEmail?.trim()) return err("New email is required");

    const normalizedNew = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedNew)) {
      return err("Invalid email address");
    }

    const user = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { id: true, email: true, fullName: true, password: true },
    });
    if (!user) return err("User not found", 404);

    if (normalizedNew === user.email.toLowerCase()) {
      return err("That's already your email");
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return err("Current password is incorrect");

    // ── Rate limit ──────────────────────────────────────────────────────
    const windowStart = new Date(
      Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
    );
    const recentRequestCount = await prisma.emailChangeToken.count({
      where: {
        userId: user.id,
        createdAt: { gte: windowStart },
      },
    });

    if (recentRequestCount >= RATE_LIMIT_MAX_REQUESTS) {
      console.warn(
        `[email/request-change] rate limit hit userId=${user.id} count=${recentRequestCount}`
      );
      return err(
        `Too many email change requests. Please wait an hour and try again.`,
        429
      );
    }

    // ── Uniqueness check ────────────────────────────────────────────────
    const existing = await prisma.user.findUnique({
      where:  { email: normalizedNew },
      select: { id: true },
    });
    if (existing) return err("An account with this email already exists");

    // Invalidate prior pending tokens by expiring them (NOT deleting),
    // so rate-limit history via createdAt remains intact. A later attempt
    // within the window still counts against the limit.
    //
    // Only unexpired prior tokens need touching; expired ones are already
    // dead to the verify route.
    await prisma.emailChangeToken.updateMany({
      where: {
        userId: user.id,
        expiresAt: { gt: new Date() },
      },
      data: { expiresAt: new Date(0) }, // epoch — instantly "expired"
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + EMAIL_CHANGE_TOKEN_TTL_MINUTES * 60 * 1000
    );

    await prisma.emailChangeToken.create({
      data: { userId: user.id, newEmail: normalizedNew, token, expiresAt },
    });

    const baseUrl =
      process.env.NEXTAUTH_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-email-change?token=${token}`;

    // ── Email 1: verification link to the NEW address ──────────────────
    await sendEmail({
      to: normalizedNew,
      subject: "Confirm your new email — Dony's World",
      html: wrapBrandedEmail(`
        <p style="margin:0 0 8px;font-size:22px;font-weight:900;color:#f0e6d0;">
          Confirm your new email
        </p>
        <p style="margin:0 0 24px;font-size:14px;color:#7a7060;line-height:1.6;">
          Hi ${user.fullName}, you requested to change the email on your account to this address.
          Click the button below to confirm &mdash; the link expires in
          <strong style="color:#c9a84c;">${EMAIL_CHANGE_TOKEN_TTL_MINUTES} minutes</strong>.
        </p>
        <a href="${verifyUrl}"
           style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#c9a84c,#e8c96a);color:#0a0a0a;font-weight:900;font-size:14px;text-decoration:none;border-radius:12px;">
          Confirm New Email
        </a>
        <p style="margin:24px 0 0;font-size:12px;color:#4a4440;line-height:1.6;">
          If you didn&rsquo;t request this, you can safely ignore this email.
          Your account email will not change.
        </p>
        <p style="margin:8px 0 0;font-size:11px;color:#3a3430;word-break:break-all;">
          Or copy this link: ${verifyUrl}
        </p>
      `),
    });

    // ── Email 2: heads-up to the OLD address ───────────────────────────
    await sendEmail({
      to: user.email,
      subject: "Email change requested — Dony's World",
      html: wrapBrandedEmail(`
        <p style="margin:0 0 8px;font-size:22px;font-weight:900;color:#f0e6d0;">
          Someone asked to change your email
        </p>
        <p style="margin:0 0 24px;font-size:14px;color:#7a7060;line-height:1.6;">
          Hi ${user.fullName}, a request was made to change your account email to
          <strong style="color:#c9a84c;">${normalizedNew}</strong>.
        </p>
        <p style="margin:0 0 24px;font-size:14px;color:#7a7060;line-height:1.6;">
          If <strong style="color:#f0e6d0;">you</strong> requested this, no action needed &mdash; just click
          the confirmation link we sent to the new address.
        </p>
        <p style="margin:0 0 24px;font-size:14px;color:#ef4444;line-height:1.6;">
          If this <strong>wasn&rsquo;t you</strong>, change your password immediately.
        </p>
        <a href="${baseUrl}/forgot-password"
           style="display:inline-block;padding:12px 24px;background:#1f1f1f;border:1px solid #3a3430;color:#f0e6d0;font-weight:700;font-size:13px;text-decoration:none;border-radius:12px;">
          Change Password
        </a>
      `),
    });

    return NextResponse.json({
      message: `A confirmation link was sent to ${normalizedNew}. It expires in ${EMAIL_CHANGE_TOKEN_TTL_MINUTES} minutes.`,
    });
  } catch (e) {
    console.error("[email/request-change]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}