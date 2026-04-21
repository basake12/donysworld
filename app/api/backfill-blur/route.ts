import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v2 as cloudinary } from "cloudinary";

// ── Config ────────────────────────────────────────────────────────
const BLUR = "e_blur_faces:2000,q_85";
const SUPABASE_STORAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`;

function configure() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
    secure: true,
  });
}

// ── Resolve any stored format into a full fetchable URL ───────────
function resolveUrl(raw: string): string {
  const url = raw.split("?")[0].trim();
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (!url.includes("/")) return `${SUPABASE_STORAGE}/profile-pictures/original/${url}`;
  if (url.startsWith("gallery/")) return `${SUPABASE_STORAGE}/profile-pictures/${url}`;
  // bare Cloudinary public_id
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${url}`;
}

// ── Download → Cloudinary upload → return blurred URL ────────────
async function migrate(sourceUrl: string, folder: string, publicId: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${sourceUrl}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const result = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder, public_id: publicId, resource_type: "image", overwrite: true, invalidate: true },
        (err, result) => (err ? reject(err) : resolve(result))
      )
      .end(buffer);
  });

  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${BLUR}/v${result.version}/${result.public_id}`;
}

// ── GET /api/admin/blur-backfill ──────────────────────────────────
export async function GET() {
  configure();

  const results = { profiles: 0, gallery: 0, skipped: 0, errors: [] as string[] };

  // ── Profiles ──────────────────────────────────────────────────
  const profiles = await prisma.modelProfile.findMany({
    where: { originalPictureUrl: { not: null } },
    select: { id: true, originalPictureUrl: true },
  });

  for (const p of profiles) {
    if (!p.originalPictureUrl) continue;

    const source = resolveUrl(p.originalPictureUrl);

    // Already a proper Cloudinary upload URL — skip
    if (source.includes("res.cloudinary.com") && source.includes("/image/upload/")) {
      results.skipped++;
      continue;
    }

    try {
      const blurredUrl = await migrate(source, "donys-world/profiles", p.id);
      await prisma.modelProfile.update({ where: { id: p.id }, data: { profilePictureUrl: blurredUrl } });
      results.profiles++;
      console.log(`✅ profile ${p.id}`);
    } catch (e: any) {
      const msg = `profile ${p.id}: ${e.message}`;
      results.errors.push(msg);
      console.error(`❌ ${msg}`);
    }
  }

  // ── Gallery ───────────────────────────────────────────────────
  const gallery = await prisma.modelGallery.findMany({
    where: { originalImageUrl: { not: null } },
    select: { id: true, originalImageUrl: true },
  });

  for (const g of gallery) {
    if (!g.originalImageUrl) continue;

    const source = resolveUrl(g.originalImageUrl);

    if (source.includes("res.cloudinary.com") && source.includes("/image/upload/")) {
      results.skipped++;
      continue;
    }

    try {
      const blurredUrl = await migrate(source, "donys-world/gallery", g.id);
      await prisma.modelGallery.update({ where: { id: g.id }, data: { imageUrl: blurredUrl } });
      results.gallery++;
      console.log(`✅ gallery ${g.id}`);
    } catch (e: any) {
      const msg = `gallery ${g.id}: ${e.message}`;
      results.errors.push(msg);
      console.error(`❌ ${msg}`);
    }
  }

  console.log(`🎉 Done — profiles: ${results.profiles}, gallery: ${results.gallery}, skipped: ${results.skipped}, errors: ${results.errors.length}`);

  return NextResponse.json({
    success: true,
    ...results,
    message: `Migrated ${results.profiles} profiles + ${results.gallery} gallery images. ${results.skipped} already on Cloudinary. ${results.errors.length} errors.`,
  });
}