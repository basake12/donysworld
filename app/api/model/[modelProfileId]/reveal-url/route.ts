import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ modelProfileId: string }> }
) {
  const session = await auth();

  // Must be logged in
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only clients can fetch revealed images
  if (session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { modelProfileId } = await params;

  // Validate modelProfileId is a non-empty string (basic guard)
  if (!modelProfileId || typeof modelProfileId !== "string") {
    return NextResponse.json({ error: "Invalid model profile ID" }, { status: 400 });
  }

  const clientProfile = await prisma.clientProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!clientProfile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  // Use findFirst with active expiry check — more robust than findUnique
  // in case DB schema doesn't enforce the composite unique constraint.
  const reveal = await prisma.faceReveal.findFirst({
    where: {
      clientId: clientProfile.id,
      modelProfileId,
      expiresAt: { gt: new Date() },
    },
    select: { expiresAt: true },
  });

  if (!reveal) {
    return NextResponse.json({ error: "No active reveal" }, { status: 403 });
  }

  // Fetch profile original + all gallery originals in one query
  const model = await prisma.modelProfile.findUnique({
    where: { id: modelProfileId },
    select: {
      originalPictureUrl: true,
      gallery: {
        select: { id: true, originalImageUrl: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  // Tie all signed URLs to the actual reveal expiry, not a hardcoded 1hr.
  // This means the signed URLs die exactly when the client's access does.
  const expiresAtUnix = Math.floor(reveal.expiresAt.getTime() / 1000);

  // Sign profile picture
  let profilePicture: string | null = null;
  if (model.originalPictureUrl) {
    profilePicture = cloudinary.url(model.originalPictureUrl, {
      secure: true,
      sign_url: true,
      expires_at: expiresAtUnix,
    });
  }

  // Sign every gallery item that has an original stored
  const gallery: Record<string, string> = {};
  for (const item of model.gallery) {
    if (item.originalImageUrl) {
      gallery[item.id] = cloudinary.url(item.originalImageUrl, {
        secure: true,
        sign_url: true,
        expires_at: expiresAtUnix,
      });
    }
  }

  return NextResponse.json({
    profilePicture,
    gallery,
    urlExpiresAt: reveal.expiresAt.toISOString(),
  });
}