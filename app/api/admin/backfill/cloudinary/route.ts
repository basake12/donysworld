import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadWithFaceBlur } from "@/lib/upload-with-face-blur";
import cloudinary from "@/lib/cloudinary";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await prisma.modelProfile.findMany({
    where: { originalPictureUrl: null }, // not yet migrated
    include: { gallery: true, user: true },
  });

  return NextResponse.json({
    pending: pending.map((p) => ({
      profileId: p.id,
      fullName: p.user.fullName,
      items: [
        { kind: "profile" as const, sourceUrl: p.profilePictureUrl, profileId: p.id },
        ...p.gallery.map((g) => ({
          kind: "gallery" as const,
          sourceUrl: g.imageUrl,
          profileId: p.id,
          galleryId: g.id,
        })),
      ].filter((i) => i.sourceUrl),
    })),
    alreadyMigrated: await prisma.modelProfile.count({ where: { originalPictureUrl: { not: null } } }),
    total: await prisma.modelProfile.count(),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const kind = form.get("kind") as "profile" | "gallery";
  const profileId = form.get("profileId") as string;
  const galleryId = form.get("galleryId") as string | null;
  const sourceUrl = form.get("sourceUrl") as string; // optional fallback

  let file: Buffer;
  if (sourceUrl) {
    const res = await fetch(sourceUrl);
    file = Buffer.from(await res.arrayBuffer());
  } else {
    const f = form.get("file") as File;
    file = Buffer.from(await f.arrayBuffer());
  }

  const { publicId, blurredUrl } = await uploadWithFaceBlur(file, kind, profileId);

  if (kind === "profile") {
    await prisma.modelProfile.update({
      where: { id: profileId },
      data: {
        profilePictureUrl: blurredUrl,
        originalPictureUrl: publicId,
        isFaceBlurred: true,
      },
    });
  } else if (galleryId) {
    await prisma.modelGallery.update({
      where: { id: galleryId },
      data: {
        imageUrl: blurredUrl,
        originalImageUrl: publicId,
      },
    });
  }

  return NextResponse.json({ success: true, blurredUrl });
}