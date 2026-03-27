import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ── GET: fetch all notifications for logged in user ──
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);

    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ notifications });
  } catch (err: any) {
    console.error("[NOTIFICATIONS GET ERROR]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── PATCH: mark all as read ──
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);

    await prisma.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ message: "All notifications marked as read" });
  } catch (err: any) {
    console.error("[NOTIFICATIONS PATCH ERROR]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}