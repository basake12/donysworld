/**
 * scripts/fix-blur-strength.ts
 *
 * Re-processes all migrated profiles/gallery items with:
 *   - Full image quality preserved (sharp compositing, no canvas output)
 *   - Strong Gaussian blur (sigma 30) on the face region only
 *   - SVG ellipse mask for precise face targeting
 *
 * Canvas is used ONLY for face detection (read-only). All image
 * manipulation and output goes through sharp — no quality degradation.
 *
 * Run with:
 *   npx tsx scripts/fix-blur-strength.ts
 */

import "@tensorflow/tfjs";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import sharp from "sharp";

const prisma   = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET     = "profile-pictures";
const MODEL_PATH = path.join(process.cwd(), "models", "face-api");
const BLUR_SIGMA = 30; // strong — fully obscures faces

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
  const iw = Math.min(a.x + a.width,  b.x + b.width)  - ix;
  const ih = Math.min(a.y + a.height, b.y + b.height) - iy;
  if (iw <= 0 || ih <= 0) return false;
  return (iw * ih) / Math.min(a.width * a.height, b.width * b.height) > 0.5;
}

interface FaceBox { cx: number; cy: number; rx: number; ry: number }

async function detectFaces(jpegBuffer: Buffer, W: number, H: number): Promise<FaceBox[]> {
  const fa = await initFaceApi();
  const { loadImage, createCanvas } = await import("canvas");

  const img    = await loadImage(jpegBuffer);
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");
  ctx.drawImage(img as any, 0, 0);

  const accepted: Array<{ box: any; score: number }> = [];

  for (const inputSize of [608, 416]) {
    const opts = new fa.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.3 });
    const dets = await fa.detectAllFaces(canvas as any, opts).withFaceLandmarks();
    for (const det of dets) {
      const box = det.detection.box, score = det.detection.score;
      if (score < 0.4) continue;
      const aspect = box.width / box.height;
      if (aspect < 0.6 || aspect > 1.5) continue;
      const centerY = (box.y + box.height / 2) / H;
      if (centerY > 0.65 || (box.width * box.height) / (W * H) < 0.005) continue;
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
      const centerY = (box.y + box.height / 2) / H;
      if (centerY > 0.85 || (box.width * box.height) / (W * H) < 0.002) continue;
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
      const centerY = (box.y + box.height / 2) / H;
      if (centerY > 0.5) continue;
      const aspect = box.width / box.height;
      if (aspect < 0.7 || aspect > 1.3) continue;
      accepted.push({ box, score: det.score ?? 0 });
    }
  }

  return accepted.map((d) => {
    const f  = 0.2;
    const px = Math.max(0, d.box.x - d.box.width  * f);
    const py = Math.max(0, d.box.y - d.box.height * f);
    const pw = Math.min(W - px, d.box.width  * (1 + 2 * f));
    const ph = Math.min(H - py, d.box.height * (1 + 2 * f));
    return { cx: px + pw / 2, cy: py + ph / 2, rx: pw / 2, ry: ph / 2 };
  });
}

async function processImage(imageUrl: string): Promise<{ buffer: Buffer; facesDetected: number }> {
  // 1. Fetch + normalise to PNG (lossless, preserves full quality for processing)
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = Buffer.from(await res.arrayBuffer());

  const sharpInstance = sharp(raw).rotate(); // auto-correct EXIF
  const { width: W, height: H } = await sharpInstance.metadata();
  if (!W || !H) throw new Error("Could not read image dimensions");

  // Work in PNG for lossless intermediate steps
  const pngBuffer = await sharpInstance.png().toBuffer();

  // 2. Detect faces using canvas (read-only — no output from canvas)
  // Pass a JPEG copy to canvas (it doesn't need to be lossless for detection)
  const jpegForDetection = await sharp(pngBuffer).jpeg({ quality: 90 }).toBuffer();
  const faces = await detectFaces(jpegForDetection, W, H);

  // 3. Create strongly blurred version of the original using sharp
  const blurredPng = await sharp(pngBuffer).blur(BLUR_SIGMA).resize(W, H, { fit: "fill" }).png().toBuffer();

  let outputBuffer: Buffer;

  if (faces.length > 0) {
    // 4a. Face(s) detected — composite: original base + blurred region inside each ellipse

    // Build an SVG with white ellipses on black background — this is our alpha mask
    const ellipses = faces
      .map(({ cx, cy, rx, ry }) =>
        `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="white"/>`
      )
      .join("\n");

    const svgMask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <rect width="${W}" height="${H}" fill="black"/>
        ${ellipses}
      </svg>`
    );

    // Extract just the blurred pixels where the mask is white
    const blurredFaceOnly = await sharp(blurredPng)
      .composite([{ input: svgMask, blend: "dest-in" }])
      .png()
      .toBuffer();

    // Composite blurred face region over the sharp original
    outputBuffer = await sharp(pngBuffer)
      .composite([{ input: blurredFaceOnly, blend: "over" }])
      .jpeg({ quality: 97, mozjpeg: true })
      .toBuffer();

  } else {
    // 4b. No face detected — blur the whole image
    outputBuffer = await sharp(blurredPng)
      .jpeg({ quality: 97, mozjpeg: true })
      .toBuffer();
  }

  return { buffer: outputBuffer, facesDetected: faces.length };
}

async function upload(buffer: Buffer, storagePath: string): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Upload: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function main() {
  console.log(`Re-blurring all images (sharp sigma=${BLUR_SIGMA}, full quality output)...\n`);

  // ── Profiles ──────────────────────────────────────────────────────────────
  const profiles = await prisma.modelProfile.findMany({
    where:  { id: "skip-profiles-this-run" },
    select: { id: true, originalPictureUrl: true },
  });
  console.log(`${profiles.length} profile(s) to re-process\n`);

  let pOk = 0, pFail = 0;
  for (const p of profiles) {
    process.stdout.write(`Profile ${p.id}: `);
    try {
      const { buffer, facesDetected } = await processImage(p.originalPictureUrl!);
      const url = await upload(buffer, `blurred/${p.id}_v2_${Date.now()}.jpg`);
      await prisma.modelProfile.update({
        where: { id: p.id },
        data:  { profilePictureUrl: url },
      });
      console.log(`✓  (${facesDetected} face(s))`);
      pOk++;
    } catch (e: any) {
      console.log(`✗  ${e.message}`);
      pFail++;
    }
  }

  // ── Gallery ───────────────────────────────────────────────────────────────
  const gallery = await prisma.modelGallery.findMany({
    where:  { id: "cmo2tpheo0008jo04kw52ivbx" },
    select: { id: true, originalImageUrl: true, modelProfileId: true },
  });
  console.log(`\n${gallery.length} gallery item(s) to re-process\n`);

  let gOk = 0, gFail = 0;
  for (const g of gallery) {
    process.stdout.write(`Gallery ${g.id}: `);
    try {
      const { buffer, facesDetected } = await processImage(g.originalImageUrl!);
      const url = await upload(buffer, `gallery/blurred/${g.modelProfileId}_v2_${Date.now()}.jpg`);
      await prisma.modelGallery.update({
        where: { id: g.id },
        data:  { imageUrl: url },
      });
      console.log(`✓  (${facesDetected} face(s))`);
      gOk++;
    } catch (e: any) {
      console.log(`✗  ${e.message}`);
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