import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// ── POST /api/push/subscribe — register a push subscription ─────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);

    const body = await req.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return err("Invalid subscription object");
    }

    if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
      return err("Invalid endpoint");
    }

    // Upsert — if this device is already registered (same endpoint) just
    // refresh it rather than creating a duplicate.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      update: {
        userId: session.user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return NextResponse.json({ message: "Subscribed" }, { status: 201 });
  } catch (e) {
    console.error("[PUSH SUBSCRIBE ERROR]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE /api/push/subscribe — unregister a push subscription ─────────────
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);

    const { endpoint } = await req.json();
    if (!endpoint) return err("endpoint required");

    // Only delete if it belongs to this user
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.user.id },
    });

    return NextResponse.json({ message: "Unsubscribed" });
  } catch (e) {
    console.error("[PUSH UNSUBSCRIBE ERROR]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}