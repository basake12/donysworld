import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ modelProfileId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { modelProfileId } = await params;

  // clientId in faceReveal = clientProfile.id, NOT session.user.id
  const clientProfile = await prisma.clientProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!clientProfile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  const reveal = await prisma.faceReveal.findUnique({
    where: {
      clientId_modelProfileId: {
        clientId: clientProfile.id,
        modelProfileId,
      },
    },
  });

  if (!reveal || new Date(reveal.expiresAt) < new Date()) {
    return NextResponse.json({ error: "No active reveal" }, { status: 403 });
  }

  const model = await prisma.modelProfile.findUnique({
    where: { id: modelProfileId },
    select: { originalPictureUrl: true },
  });

  if (!model?.originalPictureUrl) {
    return NextResponse.json({ error: "No original" }, { status: 404 });
  }

  const signedUrl = cloudinary.url(model.originalPictureUrl, {
    secure: true,
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });

  return NextResponse.json({
    profilePicture: signedUrl,
    gallery: {},
    urlExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  });
}