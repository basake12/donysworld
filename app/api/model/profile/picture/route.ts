import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadWithFaceBlur } from "@/lib/upload-with-face-blur";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "MODEL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("image") as File;
  const profileId = form.get("profileId") as string;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const { blurredUrl, originalUrl } = await uploadWithFaceBlur(file, "profile", profileId);

  await prisma.modelProfile.update({
    where: { id: profileId },
    data: {
      profilePictureUrl: blurredUrl,
      originalPictureUrl: originalUrl.split("?")[0],
      isFaceBlurred: true,
    },
  });

  return NextResponse.json({ profilePictureUrl: blurredUrl });
}