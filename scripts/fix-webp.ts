/**
 * scripts/fix-webp.ts
 *
 * Retries the remaining failed profiles/gallery items.
 * Uses sharp to convert any image format (WebP, HEIC, AVIF, etc.)
 * to JPEG before passing to canvas — sharp is already in the project.
 *
 * Run with:
 *   npx tsx scripts/fix-webp.ts
 */

import "@tensorflow/tfjs";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import sharp from "sharp";

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "profile-pictures";
const MODEL_PATH = path.join(process.cwd(), "models", "face-api");

let faceapi: any = null;

async function initFaceApi() {
  if (faceapi) return faceapi;
  const fa = await import("@vladmandic/face-api");
  const { Canvas, Image, ImageData } = await import("canvas");
  fa.env.monkeyPatch({ Canvas, Image, ImageData } as any);
  await Promise.all([
    fa.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH),
    fa.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH),
  ]);
  faceapi = fa;
  return fa;
}

function isDuplicate(a: any, b: any): boolean {
  const ix = Math.max(a.x, b.x), iy = Math.max(a.y, b.y);
  const iw = Math.min(a.x + a.width, b.x + b.width) - ix;
  const ih = Math.min(a.y + a.height, b.y + b.height) - iy;
  if (iw <= 0 || ih <= 0) return false;
  return (iw * ih) / Math.min(a.width * a.height, b.width * b.height) > 0.5;
}

async function detectAndBlur(imageUrl: string): Promise<Buffer> {
  const fa = await initFaceApi();
  const { loadImage, createCanvas } = await import("canvas");

  // 1. Fetch raw bytes
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching image`);
  const rawBuffer = Buffer.from(await res.arrayBuffer());

  // 2. Convert to JPEG via sharp — handles WebP, HEIC, AVIF, PNG, etc.
  const jpegBuffer = await sharp(rawBuffer)
    .rotate()           // auto-rotate based on EXIF orientation
    .jpeg({ quality: 95 })
    .toBuffer();

  // 3. Load the JPEG buffer into canvas
  const img = await loadImage(jpegBuffer);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img as any, 0, 0);

  // 4. Three-pass face detection
  const accepted: Array<{ box: any; score: number }> = [];

  for (const inputSize of [608, 416]) {
    const opts = new fa.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.3 });
    const dets = await fa.detectAllFaces(canvas as any, opts).withFaceLandmarks();
    for (const det of dets) {
      const box = det.detection.box, score = det.detection.score;
      if (score < 0.4) continue;
      const aspect = box.width / box.height;
      if (aspect < 0.6 || aspect > 1.5) continue;
      const centerY = (box.y + box.height / 2) / img.height;
      if (centerY > 0.65 || (box.width * box.height) / (img.width * img.height) < 0.005) continue;
      if (accepted.some((a) => isDuplicate(a.box, box))) continue;
      accepted.push({ box, score });
    }
    if (accepted.length > 0) break;
  }

  if (accepted.length === 0) {
    const opts = new fa.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 });
    const dets = await fa.detectAllFaces(canvas as any, opts).withFaceLandmarks();
    for (const det of dets) {
      const box = det.detection.box, score = det.detection.score;
      if (score < 0.35) continue;
      const aspect = box.width / box.height;
      if (aspect < 0.45 || aspect > 1.8) continue;
      const centerY = (box.y + box.height / 2) / img.height;
      if (centerY > 0.85 || (box.width * box.height) / (img.width * img.height) < 0.002) continue;
      if (accepted.some((a) => isDuplicate(a.box, box))) continue;
      accepted.push({ box, score });
    }
  }

  if (accepted.length === 0) {
    const opts = new fa.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.5 });
    const dets = await fa.detectAllFaces(canvas as any, opts);
    for (const det of dets) {
      const box = det.box ?? det.detection?.box;
      if (!box) continue;
      const centerY = (box.y + box.height / 2) / img.height;
      if (centerY > 0.5) continue;
      const aspect = box.width / box.height;
      if (aspect < 0.7 || aspect > 1.3) continue;
      accepted.push({ box, score: det.score ?? 0 });
    }
  }

  console.log(`  → ${accepted.length} face(s) detected`);

  // 5. Redraw clean then apply blur
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img as any, 0, 0);

  const blurRadius = 14, passes = 25;

  if (accepted.length > 0) {
    for (const det of accepted) {
      const f = 0.2;
      const px = Math.max(0, det.box.x - det.box.width * f);
      const py = Math.max(0, det.box.y - det.box.height * f);
      const pw = Math.min(canvas.width  - px, det.box.width  * (1 + 2 * f));
      const ph = Math.min(canvas.height - py, det.box.height * (1 + 2 * f));
      const cx = px + pw / 2, cy = py + ph / 2;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, pw / 2, ph / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 1 / passes;
      for (let i = 0; i < passes; i++) {
        ctx.drawImage(img as any, (Math.random() - 0.5) * blurRadius * 2, (Math.random() - 0.5) * blurRadius * 2);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  } else {
    // Full image blur fallback — no face detected
    ctx.globalAlpha = 1 / passes;
    for (let i = 0; i < passes; i++) {
      ctx.drawImage(img as any, (Math.random() - 0.5) * blurRadius * 2, (Math.random() - 0.5) * blurRadius * 2);
    }
    ctx.globalAlpha = 1;
  }

  return canvas.toBuffer("image/jpeg", { quality: 0.95 });
}

async function uploadBuffer(buffer: Buffer, storagePath: string): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function main() {
  console.log("Fixing remaining failures with sharp conversion...\n");

  // ── Profiles ─────────────────────────────────────────────────────────────
  const profiles = await prisma.modelProfile.findMany({
    where:  { originalPictureUrl: null },
    select: { id: true, profilePictureUrl: true },
  });
  console.log(`${profiles.length} profile(s) to process\n`);

  let pOk = 0, pFail = 0;
  for (const p of profiles) {
    process.stdout.write(`Profile ${p.id}: `);
    try {
      const buf     = await detectAndBlur(p.profilePictureUrl);
      const blurred = await uploadBuffer(buf, `blurred/${p.id}_profile_${Date.now()}.jpg`);
      await prisma.modelProfile.update({
        where: { id: p.id },
        data:  { profilePictureUrl: blurred, originalPictureUrl: p.profilePictureUrl },
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
    where:  { originalImageUrl: null },
    select: { id: true, imageUrl: true, modelProfileId: true },
  });
  console.log(`\n${gallery.length} gallery item(s) to process\n`);

  let gOk = 0, gFail = 0;
  for (const g of gallery) {
    process.stdout.write(`Gallery ${g.id}: `);
    try {
      const buf     = await detectAndBlur(g.imageUrl);
      const blurred = await uploadBuffer(buf, `gallery/blurred/${g.modelProfileId}_${Date.now()}.jpg`);
      await prisma.modelGallery.update({
        where: { id: g.id },
        data:  { imageUrl: blurred, originalImageUrl: g.imageUrl },
      });
      console.log("✓");
      gOk++;
    } catch (e: any) {
      console.log(`✗ ${e.message}`);
      gFail++;
    }
  }

  console.log(`\n─────────────────────────────
Done.
Profiles: ${pOk} ok, ${pFail} failed
Gallery:  ${gOk} ok, ${gFail} failed
─────────────────────────────`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });