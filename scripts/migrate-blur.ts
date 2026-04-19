/**
 * scripts/migrate-blur.ts
 *
 * One-off migration: takes every existing model whose originalPictureUrl is null,
 * runs face detection + canvas blur on their current profilePictureUrl,
 * uploads the blurred version as the new profilePictureUrl, and stores
 * the original at originalPictureUrl.
 *
 * Run with:
 *   npx tsx scripts/migrate-blur.ts
 *
 * Dependencies:
 *   @vladmandic/face-api, @tensorflow/tfjs, canvas, @prisma/client, @supabase/supabase-js
 */

import '@tensorflow/tfjs'; // Pure JS CPU backend — no native binary needed

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as fs from "fs";

const prisma = new PrismaClient();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "profile-pictures"; // adjust if different
const MODEL_PATH = path.join(process.cwd(), "models", "face-api");

// ── Detection + blur (server-side) ───────────────────────────────────────────

let faceapi: any = null;

async function initFaceApi() {
  if (faceapi) return faceapi;

  const fa = await import("@vladmandic/face-api");
  const { Canvas, Image, ImageData } = await import("canvas");

  // Tell face-api to use node-canvas types instead of browser DOM types
  fa.env.monkeyPatch({ Canvas, Image, ImageData } as any);

  await Promise.all([
    fa.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH),
    fa.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH),
  ]);

  faceapi = fa;
  return fa;
}

function isDuplicate(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  const ix = Math.max(a.x, b.x);
  const iy = Math.max(a.y, b.y);
  const iw = Math.min(a.x + a.width,  b.x + b.width)  - ix;
  const ih = Math.min(a.y + a.height, b.y + b.height) - iy;
  if (iw <= 0 || ih <= 0) return false;
  const intersection = iw * ih;
  return intersection / Math.min(a.width * a.height, b.width * b.height) > 0.5;
}

async function detectAndBlur(imageUrl: string): Promise<Buffer | null> {
  const fa = await initFaceApi();
  const { loadImage, createCanvas } = await import("canvas");

  const img    = await loadImage(imageUrl);
  const canvas = createCanvas(img.width, img.height);
  const ctx    = canvas.getContext("2d");
  ctx.drawImage(img as any, 0, 0);

  // Three-pass detection (exact match to reference)
  const accepted: Array<{ box: any; score: number }> = [];

  for (const inputSize of [608, 416]) {
    const opts = new fa.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.3 });
    const dets = await fa.detectAllFaces(canvas as any, opts).withFaceLandmarks();
    for (const det of dets) {
      const box = det.detection.box;
      const score = det.detection.score;
      if (score < 0.4) continue;
      const aspect = box.width / box.height;
      if (aspect < 0.6 || aspect > 1.5) continue;
      const centerY = (box.y + box.height / 2) / img.height;
      if (centerY > 0.65) continue;
      if ((box.width * box.height) / (img.width * img.height) < 0.005) continue;
      if (accepted.some((a) => isDuplicate(a.box, box))) continue;
      accepted.push({ box, score });
    }
    if (accepted.length > 0) break;
  }

  if (accepted.length === 0) {
    const opts = new fa.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 });
    const dets = await fa.detectAllFaces(canvas as any, opts).withFaceLandmarks();
    for (const det of dets) {
      const box = det.detection.box;
      const score = det.detection.score;
      if (score < 0.35) continue;
      const aspect = box.width / box.height;
      if (aspect < 0.45 || aspect > 1.8) continue;
      const centerY = (box.y + box.height / 2) / img.height;
      if (centerY > 0.85) continue;
      if ((box.width * box.height) / (img.width * img.height) < 0.002) continue;
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

  // Redraw canvas fresh then apply blur
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img as any, 0, 0);

  if (accepted.length > 0) {
    for (const det of accepted) {
      const h = det.box;
      const f = 0.2;
      const px = Math.max(0, h.x - h.width  * f);
      const py = Math.max(0, h.y - h.height * f);
      const pw = Math.min(canvas.width  - px, h.width  * (1 + 2 * f));
      const ph = Math.min(canvas.height - py, h.height * (1 + 2 * f));

      const cx = px + pw / 2;
      const cy = py + ph / 2;
      const rx = pw / 2;
      const ry = ph / 2;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.clip();

      // Simulate blur by compositing with shifted copies (node-canvas limitation)
      const blurRadius = 12;
      const passes = 20;
      ctx.globalAlpha = 1 / passes;
      for (let i = 0; i < passes; i++) {
        const dx = (Math.random() - 0.5) * blurRadius * 2;
        const dy = (Math.random() - 0.5) * blurRadius * 2;
        ctx.drawImage(img as any, dx, dy);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  } else {
    // Full image blur fallback
    const blurRadius = 12;
    const passes = 20;
    ctx.globalAlpha = 1 / passes;
    for (let i = 0; i < passes; i++) {
      const dx = (Math.random() - 0.5) * blurRadius * 2;
      const dy = (Math.random() - 0.5) * blurRadius * 2;
      ctx.drawImage(img as any, dx, dy);
    }
    ctx.globalAlpha = 1;
  }

  return canvas.toBuffer("image/jpeg", { quality: 0.95 });
}

// ── Upload helper ─────────────────────────────────────────────────────────────

async function uploadBuffer(buffer: Buffer, storagePath: string): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

function extractStoragePath(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const segments = url.pathname.split(`/${BUCKET}/`);
    return segments[1] ?? null;
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Starting blur migration...\n");

  const profiles = await prisma.modelProfile.findMany({
    where:  { originalPictureUrl: null },
    select: { id: true, profilePictureUrl: true },
  });

  console.log(`Found ${profiles.length} profile(s) without originalPictureUrl\n`);

  let profilesOk = 0, profilesFailed = 0;

  for (const profile of profiles) {
    try {
      process.stdout.write(`Profile ${profile.id}: detecting + blurring... `);
      const blurredBuffer = await detectAndBlur(profile.profilePictureUrl);
      if (!blurredBuffer) throw new Error("detectAndBlur returned null");

      const blurredPath = `blurred/${profile.id}_profile_${Date.now()}.jpg`;
      const blurredUrl  = await uploadBuffer(blurredBuffer, blurredPath);

      await prisma.modelProfile.update({
        where: { id: profile.id },
        data: {
          profilePictureUrl:  blurredUrl,
          originalPictureUrl: profile.profilePictureUrl,
        },
      });

      console.log("✓");
      profilesOk++;
    } catch (e: any) {
      console.log(`✗ ${e.message}`);
      profilesFailed++;
    }
  }

  // Gallery items
  const galleryItems = await prisma.modelGallery.findMany({
    where:  { originalImageUrl: null },
    select: { id: true, imageUrl: true, modelProfileId: true },
  });

  console.log(`\nFound ${galleryItems.length} gallery item(s) without originalImageUrl\n`);

  let galleryOk = 0, galleryFailed = 0;

  for (const item of galleryItems) {
    try {
      process.stdout.write(`Gallery ${item.id}: detecting + blurring... `);
      const blurredBuffer = await detectAndBlur(item.imageUrl);
      if (!blurredBuffer) throw new Error("detectAndBlur returned null");

      const blurredPath = `gallery/blurred/${item.modelProfileId}_${Date.now()}.jpg`;
      const blurredUrl  = await uploadBuffer(blurredBuffer, blurredPath);

      await prisma.modelGallery.update({
        where: { id: item.id },
        data: {
          imageUrl:         blurredUrl,
          originalImageUrl: item.imageUrl,
        },
      });

      console.log("✓");
      galleryOk++;
    } catch (e: any) {
      console.log(`✗ ${e.message}`);
      galleryFailed++;
    }
  }

  console.log(`
─────────────────────────────
Migration complete

Profiles:  ${profilesOk} updated, ${profilesFailed} failed
Gallery:   ${galleryOk} updated, ${galleryFailed} failed
─────────────────────────────
`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});