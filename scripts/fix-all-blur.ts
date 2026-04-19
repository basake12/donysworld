/**
 * scripts/fix-all-blur.ts
 *
 * Replaces ALL blurred profile/gallery images using a fixed ellipse region
 * at the top-center of each image — no TensorFlow, no face detection, no
 * failures. Portrait photos always have the face in roughly the same position.
 *
 * Ellipse parameters (tuned for portrait/selfie photos):
 *   center X:  50% of width
 *   center Y:  22% of height  (upper third)
 *   radius X:  38% of width
 *   radius Y:  25% of height
 *
 * Run with:
 *   npx tsx scripts/fix-all-blur.ts
 */

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const prisma   = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET     = "profile-pictures";
const BLUR_SIGMA = 28; // strong enough to obscure face, not destroy image

async function blurPortrait(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = Buffer.from(await res.arrayBuffer());

  // Convert to PNG (lossless) — handles WebP, HEIC, JPEG, etc.
  const png = await sharp(raw).rotate().png().toBuffer();
  const { width: W, height: H } = await sharp(png).metadata();
  if (!W || !H) throw new Error("Could not read dimensions");

  // Fixed ellipse — tuned for portrait selfies
  const cx = W * 0.50;  // horizontally centered
  const cy = H * 0.22;  // 22% from top
  const rx = W * 0.38;  // 38% of width
  const ry = H * 0.25;  // 25% of height

  const svgMask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="black"/>
      <ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="white"/>
    </svg>`
  );

  // Blurred version — same exact dimensions
  const blurredPng = await sharp(png)
    .blur(BLUR_SIGMA)
    .resize(W, H, { fit: "fill" })
    .png()
    .toBuffer();

  // Masked blurred region
  const maskedBlur = await sharp(blurredPng)
    .composite([{ input: svgMask, blend: "dest-in" }])
    .png()
    .toBuffer();

  // Composite: sharp original + blurred ellipse on top
  return sharp(png)
    .composite([{ input: maskedBlur, blend: "over" }])
    .jpeg({ quality: 97, mozjpeg: true })
    .toBuffer();
}

async function upload(buffer: Buffer, storagePath: string): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Upload: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function main() {
  console.log(`Blurring all portraits with fixed ellipse (sigma=${BLUR_SIGMA})...\n`);

  // ── Profiles ──────────────────────────────────────────────────────────────
  const profiles = await prisma.modelProfile.findMany({
    where:  { originalPictureUrl: { not: null } },
    select: { id: true, originalPictureUrl: true },
  });
  console.log(`${profiles.length} profile(s) to process\n`);

  let pOk = 0, pFail = 0;
  for (const p of profiles) {
    process.stdout.write(`Profile ${p.id}: `);
    try {
      const buf = await blurPortrait(p.originalPictureUrl!);
      const url = await upload(buf, `blurred/${p.id}_v3_${Date.now()}.jpg`);
      await prisma.modelProfile.update({
        where: { id: p.id },
        data:  { profilePictureUrl: url },
      });
      console.log("✓");
      pOk++;
    } catch (e: any) {
      console.log(`✗ ${e.message}`);
      pFail++;
    }
  }

  // ── Gallery ───────────────────────────────────────────────────────────────
  const gallery = await prisma.modelGallery.findMany({
    where:  { originalImageUrl: { not: null } },
    select: { id: true, originalImageUrl: true, modelProfileId: true },
  });
  console.log(`\n${gallery.length} gallery item(s) to process\n`);

  let gOk = 0, gFail = 0;
  for (const g of gallery) {
    process.stdout.write(`Gallery ${g.id}: `);
    try {
      const buf = await blurPortrait(g.originalImageUrl!);
      const url = await upload(buf, `gallery/blurred/${g.modelProfileId}_v3_${Date.now()}.jpg`);
      await prisma.modelGallery.update({
        where: { id: g.id },
        data:  { imageUrl: url },
      });
      console.log("✓");
      gOk++;
    } catch (e: any) {
      console.log(`✗ ${e.message}`);
      gFail++;
    }
  }

  console.log(`
─────────────────────────────
Done.
Profiles: ${pOk} ok, ${pFail} failed
Gallery:  ${gOk} ok, ${gFail} failed
─────────────────────────────`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });