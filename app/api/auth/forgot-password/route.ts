import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * POST /api/auth/forgot-password
 *
 * Generates a password-reset token and emails the link.
 * Uses Resend (https://resend.com) — add RESEND_API_KEY to your .env.
 *
 * We always return 200 even when the email isn't found to prevent
 * user enumeration.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ ok: true }); // silent

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, fullName: true, email: true },
    });

    if (!user) {
      // Don't reveal whether the account exists
      return NextResponse.json({ ok: true });
    }

    // ── Generate a secure random token ─────────────
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // ── Upsert reset token record ───────────────────
    await prisma.passwordResetToken.upsert({
      where: { email: user.email },
      update: { token, expiresAt },
      create: { email: user.email, token, expiresAt },
    });

    // ── Build reset URL ─────────────────────────────
    const baseUrl =
      process.env.NEXTAUTH_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // ── Send email via Resend ───────────────────────
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "Dony's World <noreply@donysworld.com>",
          to: user.email,
          subject: "Reset your password — Dony's World",
          html: buildEmailHtml({ name: user.fullName, resetUrl }),
        }),
      });
    } else {
      // In development without Resend, log to console
      console.log(`[forgot-password] Reset link for ${user.email}:\n${resetUrl}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ── Minimal branded HTML email ──────────────────────────────────────────────
function buildEmailHtml({ name, resetUrl }: { name: string; resetUrl: string }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#0f0f0f;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid #1f1f1f;">
              <p style="margin:0;font-size:20px;font-weight:900;color:#c9a84c;letter-spacing:-0.3px;">
                Dony&rsquo;s World
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:900;color:#f0e6d0;">
                Reset your password
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#7a7060;line-height:1.6;">
                Hi ${name}, we received a request to reset your password.
                Click the button below — the link expires in <strong style="color:#c9a84c;">30 minutes</strong>.
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
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-size:11px;color:#3a3430;">
                &copy; ${new Date().getFullYear()} Dony&rsquo;s World &mdash; 18+ only
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}