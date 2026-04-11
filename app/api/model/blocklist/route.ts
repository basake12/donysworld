import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addSchema = z.object({
  identifierType: z.enum(["EMAIL", "PHONE", "NAME"]),
  identifier: z.string().min(2, "Value must be at least 2 characters").max(200),
  note: z.string().max(300).optional(),
});

// ── GET — fetch model's blocklist ──────────────

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "MODEL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.modelProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const entries = await prisma.modelBlocklist.findMany({
    where: { modelProfileId: profile.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ entries });
}

// ── POST — add entry to blocklist ─────────────

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "MODEL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { identifierType, identifier, note } = parsed.data;

  const profile = await prisma.modelProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Normalize: lowercase email/phone for consistent matching
  const normalizedIdentifier =
    identifierType === "NAME"
      ? identifier.trim()
      : identifier.trim().toLowerCase();

  try {
    const entry = await prisma.modelBlocklist.create({
      data: {
        modelProfileId: profile.id,
        identifierType,
        identifier: normalizedIdentifier,
        note: note?.trim() || null,
      },
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err: any) {
    // Unique constraint — already blocked
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "This entry is already on your blocklist" },
        { status: 409 }
      );
    }
    console.error("Blocklist add error:", err);
    return NextResponse.json({ error: "Failed to add entry" }, { status: 500 });
  }
}

// ── DELETE — remove entry ─────────────────────

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "MODEL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Entry ID required" }, { status: 400 });
  }

  const profile = await prisma.modelProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Ensure the entry belongs to this model
  const entry = await prisma.modelBlocklist.findFirst({
    where: { id, modelProfileId: profile.id },
  });

  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  await prisma.modelBlocklist.delete({ where: { id } });

  return NextResponse.json({ success: true });
}