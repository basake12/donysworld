import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ModelStatus } from "@prisma/client";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "ADMIN")
      return errorResponse("Admin access required", 403);

    const { modelUserId, profileId, action } = await req.json();

    if (!modelUserId || !profileId || !action) {
      return errorResponse("modelUserId, profileId and action are required");
    }

    const validActions = ["approve", "reject", "suspend", "unsuspend"];
    if (!validActions.includes(action)) {
      return errorResponse("Invalid action");
    }

    const modelProfile = await prisma.modelProfile.findUnique({
      where: { id: profileId },
      include: { user: { select: { id: true, fullName: true } } },
    });

    if (!modelProfile) return errorResponse("Model profile not found", 404);

    const STATUS_MAP: Record<string, ModelStatus> = {
      approve: ModelStatus.ACTIVE,
      reject: ModelStatus.REJECTED,
      suspend: ModelStatus.SUSPENDED,
      unsuspend: ModelStatus.ACTIVE,
    };

    interface NotificationPayload { title: string; message: string }
    interface NotificationMap { [key: string]: NotificationPayload }

    const NOTIFICATION_MAP: NotificationMap = {
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

    await prisma.modelProfile.update({
      where: { id: profileId },
      data: { status: STATUS_MAP[action] },
    });

    await prisma.notification.create({
      data: {
        userId: modelUserId,
        title: NOTIFICATION_MAP[action].title,
        message: NOTIFICATION_MAP[action].message,
        link: "/model/dashboard",
      },
    });

    return NextResponse.json({
      message: `Model ${action}d successfully`,
    });
  } catch (err: any) {
    console.error("[ADMIN MODELS PATCH ERROR]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}