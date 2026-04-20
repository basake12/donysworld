import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadWithFaceBlur } from "@/lib/upload-with-face-blur";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.modelProfile.findUnique({
    where: { userId: session.user.id },
    include: { gallery: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ gallery: profile?.gallery ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "MODEL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.modelProfile.findUnique({
    where: { userId: session.user.id },
    include: { gallery: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.gallery.length >= 6) return NextResponse.json({ error: "Max 6 images" }, { status: 400 });

  const form = await req.formData();
  const file = form.get("image") as File;
  const order = parseInt(form.get("order") as string) || profile.gallery.length;

  if (!file || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Invalid file or too large" }, { status: 400 });
  }

  const { blurredUrl, originalUrl } = await uploadWithFaceBlur(file, "gallery", profile.id);

  const item = await prisma.modelGallery.create({
    data: {
      modelProfileId: profile.id,
      imageUrl: blurredUrl,
      originalImageUrl: originalUrl.split("?")[0],
      order,
    },
  });

  return NextResponse.json({ id: item.id, blurredUrl, item }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "MODEL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const item = await prisma.modelGallery.findUnique({
    where: { id },
    include: { modelProfile: { select: { userId: true } } },
  });

  if (!item || item.modelProfile.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found or not yours" }, { status: 404 });
  }

  await prisma.modelGallery.delete({ where: { id } });

  // Reorder remaining images
  const remaining = await prisma.modelGallery.findMany({
    where: { modelProfileId: item.modelProfileId },
    orderBy: { order: "asc" },
  });
  await Promise.all(
    remaining.map((g, idx) =>
      prisma.modelGallery.update({ where: { id: g.id }, data: { order: idx } })
    )
  );

  return NextResponse.json({ message: "Deleted" });
}