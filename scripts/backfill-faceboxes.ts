/**
 * scripts/backfill-faceboxes.ts
 *
 * Runs face detection on all existing ModelProfile records that have no faceBox,
 * and all ModelGallery records with no faceBox.
 *
 * Run once from your project root:
 *   npx tsx scripts/backfill-faceboxes.ts
 *
 * Uses Google Vision free tier (1,000/month).
 * Processes in batches of 10 with a 200ms delay to avoid rate limits.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { detectFaceFromUrl } from "../lib/facebox";

const prisma = new PrismaClient();

const BATCH   = 10;
const DELAY   = 200; // ms between batches

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("Starting face box backfill...\n");

  // ── 1. Profile pictures ──────────────────────────────────────────────────
  const profiles = await prisma.modelProfile.findMany({
    where: { faceBox: null },
    select: { id: true, profilePictureUrl: true },
  });

  console.log(`Found ${profiles.length} profile picture(s) without faceBox`);

  let profileOk = 0, profileFail = 0;

  for (let i = 0; i < profiles.length; i += BATCH) {
    const batch = profiles.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (p) => {
        const box = await detectFaceFromUrl(p.profilePictureUrl);
        if (box) {
          await prisma.modelProfile.update({
            where: { id: p.id },
            data:  { faceBox: box },
          });
          profileOk++;
          console.log(`  ✓ Profile ${p.id} — face at x:${box.x.toFixed(1)}% y:${box.y.toFixed(1)}%`);
        } else {
          profileFail++;
          console.log(`  ✗ Profile ${p.id} — no face detected (default box will be used)`);
        }
      })
    );
    if (i + BATCH < profiles.length) await sleep(DELAY);
  }

  // ── 2. Gallery images ────────────────────────────────────────────────────
  const gallery = await prisma.modelGallery.findMany({
    where: { faceBox: null },
    select: { id: true, imageUrl: true },
  });

  console.log(`\nFound ${gallery.length} gallery image(s) without faceBox`);

  let galleryOk = 0, galleryFail = 0;

  for (let i = 0; i < gallery.length; i += BATCH) {
    const batch = gallery.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (g) => {
        const box = await detectFaceFromUrl(g.imageUrl);
        if (box) {
          await prisma.modelGallery.update({
            where: { id: g.id },
            data:  { faceBox: box },
          });
          galleryOk++;
          console.log(`  ✓ Gallery ${g.id}`);
        } else {
          galleryFail++;
          console.log(`  ✗ Gallery ${g.id} — no face detected`);
        }
      })
    );
    if (i + BATCH < gallery.length) await sleep(DELAY);
  }

  console.log(`
Done.
  Profiles:  ${profileOk} updated, ${profileFail} skipped (no face found)
  Gallery:   ${galleryOk} updated, ${galleryFail} skipped
`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());