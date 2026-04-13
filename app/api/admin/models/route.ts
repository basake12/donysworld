import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ModelStatus } from "@prisma/client";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ── Email helpers ─────────────────────────────────────────────────────────────

type EmailAction = "approve" | "reject" | "suspend" | "unsuspend";

const EMAIL_CONTENT: Record<
  EmailAction,
  { subject: string; headline: string; body: string; cta?: string; ctaUrl?: string }
> = {
  approve: {
    subject: "🎉 Your model account has been approved — Dony's World",
    headline: "You're approved!",
    body: "Great news — your model account has been reviewed and approved by our team. You can now log in, complete your profile, set your charges, and start receiving offers from clients.",
    cta: "Go to Dashboard",
    ctaUrl: "/model/dashboard",
  },
  reject: {
    subject: "Update on your model application — Dony's World",
    headline: "Application not approved",
    body: "After reviewing your application we were unable to approve your model account at this time. This may be due to incomplete documentation or other requirements. If you believe this is an error, please contact our support team.",
  },
  suspend: {
    subject: "Your account has been suspended — Dony's World",
    headline: "Account suspended",
    body: "Your model account has been temporarily suspended by our admin team. While suspended you will not be able to log in or receive new offers. Please contact support if you would like to appeal this decision.",
  },
  unsuspend: {
    subject: "Your account has been reinstated — Dony's World",
    headline: "Account reinstated",
    body: "Good news — your model account has been reinstated and you can now log in again. All your existing profile information and charges remain intact.",
    cta: "Sign In",
    ctaUrl: "/login",
  },
};

async function sendModelEmail({
  toEmail,
  toName,
  action,
}: {
  toEmail: string;
  toName: string;
  action: EmailAction;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    // Dev fallback — just log
    console.log(`[admin/models] Email skipped (no RESEND_API_KEY). Action="${action}" for ${toEmail}`);
    return;
  }

  const baseUrl =
    process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://donysworld.com";

  const content = EMAIL_CONTENT[action];
  const ctaBlock =
    content.cta && content.ctaUrl
      ? `<a href="${baseUrl}${content.ctaUrl}"
           style="display:inline-block;margin-top:24px;padding:14px 28px;background:linear-gradient(135deg,#c9a84c,#e8c96a);color:#0a0a0a;font-weight:900;font-size:14px;text-decoration:none;border-radius:12px;">
           ${content.cta}
         </a>`
      : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#0f0f0f;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;">

        <tr><td style="padding:32px 32px 24px;border-bottom:1px solid #1f1f1f;">
          <p style="margin:0;font-size:20px;font-weight:900;color:#c9a84c;">Dony&rsquo;s World</p>
        </td></tr>

        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:900;color:#f0e6d0;">${content.headline}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#7a7060;">Hi ${toName},</p>
          <p style="margin:8px 0 0;font-size:14px;color:#7a7060;line-height:1.7;">${content.body}</p>
          ${ctaBlock}
          <p style="margin:28px 0 0;font-size:12px;color:#4a4440;line-height:1.6;">
            If you have any questions, reply to this email or contact our support team.
          </p>
        </td></tr>

        <tr><td style="padding:20px 32px;border-top:1px solid #1f1f1f;">
          <p style="margin:0;font-size:11px;color:#3a3430;">
            &copy; ${new Date().getFullYear()} Dony&rsquo;s World &mdash; 18+ only
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Dony's World <noreply@donysworld.com>",
        to: toEmail,
        subject: content.subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[admin/models] Resend error:", err);
    }
  } catch (err) {
    // Non-fatal — never block the admin action over email
    console.error("[admin/models] Email send failed:", err);
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "ADMIN") return errorResponse("Admin access required", 403);

    const { modelUserId, profileId, action } = await req.json();

    if (!modelUserId || !profileId || !action) {
      return errorResponse("modelUserId, profileId and action are required");
    }

    const validActions: EmailAction[] = ["approve", "reject", "suspend", "unsuspend"];
    if (!validActions.includes(action)) return errorResponse("Invalid action");

    const typedAction = action as EmailAction;

    const modelProfile = await prisma.modelProfile.findUnique({
      where: { id: profileId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!modelProfile) return errorResponse("Model profile not found", 404);

    const STATUS_MAP: Record<EmailAction, ModelStatus> = {
      approve:   ModelStatus.ACTIVE,
      reject:    ModelStatus.REJECTED,
      suspend:   ModelStatus.SUSPENDED,
      unsuspend: ModelStatus.ACTIVE,
    };

    const NOTIFICATION_MAP: Record<EmailAction, { title: string; message: string }> = {
      approve: {
        title: "Account Approved! 🎉",
        message:
          "Your model account has been approved. Complete your profile and set your charges to start receiving offers.",
      },
      reject: {
        title: "Application Rejected",
        message:
          "Unfortunately your model application has been rejected. Contact support if you believe this is an error.",
      },
      suspend: {
        title: "Account Suspended",
        message:
          "Your model account has been suspended. Contact support for more information.",
      },
      unsuspend: {
        title: "Account Reinstated",
        message:
          "Your model account has been reinstated. You can now log in and receive offers.",
      },
    };

    // ── DB update + in-app notification ──────────────────────────────────────
    await prisma.modelProfile.update({
      where: { id: profileId },
      data: { status: STATUS_MAP[typedAction] },
    });

    await prisma.notification.create({
      data: {
        userId: modelUserId,
        title: NOTIFICATION_MAP[typedAction].title,
        message: NOTIFICATION_MAP[typedAction].message,
        link: "/model/dashboard",
      },
    });

    // ── Email notification (non-blocking) ────────────────────────────────────
    await sendModelEmail({
      toEmail: modelProfile.user.email,
      toName:  modelProfile.user.fullName,
      action:  typedAction,
    });

    return NextResponse.json({ message: `Model ${typedAction}d successfully` });
  } catch (err: any) {
    console.error("[ADMIN MODELS PATCH ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}