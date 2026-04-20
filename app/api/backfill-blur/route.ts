import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const TRANSFORM = "e_blur_faces:2000,q_85";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_STORAGE = `${SUPABASE_URL}/storage/v1/object/public`;

function buildBlurredUrl(originalUrl: string, cloudName: string): string {
  const url = originalUrl.split("?")[0].trim();

  if (url.includes("res.cloudinary.com")) {
    const afterUpload = url.split("/image/upload/")[1];
    if (!afterUpload) {
      return `https://res.cloudinary.com/${cloudName}/image/fetch/${TRANSFORM}/${encodeURIComponent(url)}`;
    }
    return `https://res.cloudinary.com/${cloudName}/image/upload/${TRANSFORM}/${afterUpload}`;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `https://res.cloudinary.com/${cloudName}/image/fetch/${TRANSFORM}/${encodeURIComponent(url)}`;
  }

  if (!url.includes("/")) {
    const supabaseUrl = `${SUPABASE_STORAGE}/profile-pictures/original/${url}`;
    return `https://res.cloudinary.com/${cloudName}/image/fetch/${TRANSFORM}/${encodeURIComponent(supabaseUrl)}`;
  }

  if (url.startsWith("gallery/")) {
    const supabaseUrl = `${SUPABASE_STORAGE}/profile-pictures/${url}`;
    return `https://res.cloudinary.com/${cloudName}/image/fetch/${TRANSFORM}/${encodeURIComponent(supabaseUrl)}`;
  }

  return `https://res.cloudinary.com/${cloudName}/image/upload/${TRANSFORM}/${url}`;
}

export async function GET() {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
    console.log("🚀 Starting blur backfill...");

    let profileCount = 0;
    let galleryCount = 0;
    const errors: string[] = [];

    const profiles = await prisma.modelProfile.findMany({
      where: { originalPictureUrl: { not: null } },
      select: { id: true, originalPictureUrl: true },
    });

    for (const profile of profiles) {
      if (!profile.originalPictureUrl) continue;
      try {
        const blurredUrl = buildBlurredUrl(profile.originalPictureUrl, cloudName);
        await prisma.modelProfile.update({
          where: { id: profile.id },
          data: { profilePictureUrl: blurredUrl },
        });
        profileCount++;
        console.log(`✅ Profile ${profile.id}  →  ${blurredUrl}`);
      } catch (err: any) {
        const msg = `❌ Profile ${profile.id}: ${err.message}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    const galleryItems = await prisma.modelGallery.findMany({
      where: { originalImageUrl: { not: null } },
      select: { id: true, originalImageUrl: true },
    });

    for (const item of galleryItems) {
      if (!item.originalImageUrl) continue;
      try {
        const blurredUrl = buildBlurredUrl(item.originalImageUrl, cloudName);
        await prisma.modelGallery.update({
          where: { id: item.id },
          data: { imageUrl: blurredUrl },
        });
        galleryCount++;
        console.log(`✅ Gallery ${item.id}  →  ${blurredUrl}`);
      } catch (err: any) {
        const msg = `❌ Gallery ${item.id}: ${err.message}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    console.log(`🎉 Backfill finished! ${profileCount} profiles + ${galleryCount} gallery images. Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      message: `Done! ${profileCount} profiles + ${galleryCount} gallery images updated.`,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error: any) {
    console.error("Backfill failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}