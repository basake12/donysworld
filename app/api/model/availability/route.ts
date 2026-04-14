import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/model/availability
 *
 * Toggles the model's isAvailable flag.
 * Only callable by ACTIVE models — suspended/pending/rejected models
 * cannot change their availability.
 */
export async function PATCH() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "MODEL") {
      return NextResponse.json({ error: "Models only" }, { status: 403 });
    }

    const profile = await prisma.modelProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, isAvailable: true, status: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Only ACTIVE models can toggle availability
    if (profile.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Only active models can change availability" },
        { status: 403 }
      );
    }

    const updated = await prisma.modelProfile.update({
      where: { id: profile.id },
      data: { isAvailable: !profile.isAvailable },
      select: { isAvailable: true },
    });

    return NextResponse.json({ isAvailable: updated.isAvailable });
  } catch (err) {
    console.error("[MODEL AVAILABILITY PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}