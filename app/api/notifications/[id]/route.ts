import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    await prisma.notification.updateMany({
      where: {
        id,
        userId: session.user.id,
      },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[NOTIFICATION PATCH ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}