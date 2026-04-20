/**
 * lib/email.ts
 *
 * Minimal shared email sender. Uses Resend (https://resend.com) via the
 * REST API — no SDK dependency. In dev without RESEND_API_KEY, logs to
 * console instead of sending.
 *
 * Callers import { sendEmail }. Templates live alongside the caller (the
 * HTML for a password-reset email is not the same shape as an email-change
 * email, so each caller owns its own `html`).
 */

import "server-only";

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  /** Overrides EMAIL_FROM env. Rarely needed. */
  from?: string;
}

const DEFAULT_FROM = "Dony's World <noreply@donysworld.com>";

/**
 * Sends an email. Resolves on success. Logs and resolves on failure — we
 * never want a mail hiccup to 500 a user-facing request, because the calling
 * code almost always has cleanup work to do.
 *
 * In dev without RESEND_API_KEY, logs the email to stdout and resolves.
 */
export async function sendEmail({ to, subject, html, from }: SendEmailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const sender = from ?? process.env.EMAIL_FROM ?? DEFAULT_FROM;

  if (!apiKey) {
    console.log(`[email:dev] to=${to} subject=${subject}`);
    console.log(html);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: sender, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      console.error(`[email] send failed status=${res.status} body=${body}`);
    }
  } catch (e) {
    console.error("[email] network error", e);
  }
}

/**
 * Brand-consistent email chrome — header + footer wrapping arbitrary body
 * HTML. Matches the reset-password template so everything feels cohesive.
 */
export function wrapBrandedEmail(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#0f0f0f;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid #1f1f1f;">
              <p style="margin:0;font-size:20px;font-weight:900;color:#c9a84c;letter-spacing:-0.3px;">
                Dony&rsquo;s World
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
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