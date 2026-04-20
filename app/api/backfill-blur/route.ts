import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const BLUR_STRENGTH = 2000;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_STORAGE = `${SUPABASE_URL}/storage/v1/object/public`;

// ── Resolve any stored URL/path format into a full fetchable URL ──
function resolveOriginalUrl(raw: string): string {
  const url = raw.split("?")[0].trim();

  // Already a full URL (Cloudinary or Supabase)
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  // Bare filename: "email_timestamp.jpg"
  if (!url.includes("/")) {
    return `${SUPABASE_STORAGE}/profile-pictures/original/${url}`;
  }

  // Bare gallery path: "gallery/id_timestamp.jpg"
  if (url.startsWith("gallery/")) {
    return `${SUPABASE_STORAGE}/profile-pictures/${url}`;
  }

  // Bare Cloudinary public ID: "donys-world/profile/.../file.jpg"
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${url}`;
}

// ── Download image buffer from any URL ───────────────────────────
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Upload buffer to Cloudinary and return blurred URL ───────────
async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId: string
): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;

  const result = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: "image",
          overwrite: true,
          invalidate: true,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      )
      .end(buffer);
  });

  // Proper upload URL — no fetch, no encoding needed
  return `https://res.cloudinary.com/${cloudName}/image/upload/e_blur_faces:${BLUR_STRENGTH},q_85/v${result.version}/${result.public_id}`;
}

export async function GET() {
  try {
    const errors: string[] = [];
    let profileCount = 0;
    let galleryCount = 0;

    console.log("🚀 Starting blur backfill (upload mode)...");

    // ── PROFILE PICTURES ────────────────────────────────────────────
    const profiles = await prisma.modelProfile.findMany({
      where: { originalPictureUrl: { not: null } },
      select: { id: true, originalPictureUrl: true },
    });

    for (const profile of profiles) {
      if (!profile.originalPictureUrl) continue;
      try {
        const sourceUrl = resolveOriginalUrl(profile.originalPictureUrl);

        // Skip if already a Cloudinary upload URL (already migrated)
        if (
          sourceUrl.includes("res.cloudinary.com") &&
          sourceUrl.includes("/image/upload/")
        ) {
          console.log(`⏭  Profile ${profile.id} already on Cloudinary, skipping`);
          continue;
        }

        const buffer = await fetchImageBuffer(sourceUrl);
        const blurredUrl = await uploadToCloudinary(
          buffer,
          "donys-world/profile-backfill",
          profile.id
        );

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

    // ── GALLERY IMAGES ──────────────────────────────────────────────
    const galleryItems = await prisma.modelGallery.findMany({
      where: { originalImageUrl: { not: null } },
      select: { id: true, originalImageUrl: true },
    });

    for (const item of galleryItems) {
      if (!item.originalImageUrl) continue;
      try {
        const sourceUrl = resolveOriginalUrl(item.originalImageUrl);

        if (
          sourceUrl.includes("res.cloudinary.com") &&
          sourceUrl.includes("/image/upload/")
        ) {
          console.log(`⏭  Gallery ${item.id} already on Cloudinary, skipping`);
          continue;
        }

        const buffer = await fetchImageBuffer(sourceUrl);
        const blurredUrl = await uploadToCloudinary(
          buffer,
          "donys-world/gallery-backfill",
          item.id
        );

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

    console.log(
      `🎉 Done! ${profileCount} profiles + ${galleryCount} gallery images migrated. Errors: ${errors.length}`
    );

    return NextResponse.json({
      success: true,
      message: `Done! ${profileCount} profiles + ${galleryCount} gallery images migrated to Cloudinary.`,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error: any) {
    console.error("Backfill failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}