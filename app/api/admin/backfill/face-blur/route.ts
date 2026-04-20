/**
 * app/api/admin/backfill/face-blur/route.ts
 *
 * Admin-only. Migrates pre-Phase-B model photos from the old architecture
 * (raw originals in the public bucket) to the new one (private bucket).
 *
 * Architecture: client-driven. The admin backfill page downloads each
 * pending original in the browser, runs MediaPipe blur, and POSTs the
 * resulting pair back to this endpoint, which does the storage surgery.
 *
 *   GET  → snapshot of pending / migrated counts + per-profile pending list
 *          (each item includes the current imageUrl so the browser can fetch it)
 *   POST → body { kind, profileId, galleryId?, blurredImage, originalImage }
 *          (multipart) — migrates ONE image.
 *
 * Idempotent: items whose originalImageUrl/originalPictureUrl is already
 * a private-bucket path (not a URL) are skipped by the GET pending list
 * and rejected by POST with a clear message.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin, BUCKETS } from "@/lib/supabase";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function needsBackfill(stored: string | null | undefined): boolean {
  if (!stored) return true;
  return stored.startsWith("http://") || stored.startsWith("https://");
}

// ─── GET ──────────────────────────────────────────────────────────────────

interface PendingItem {
  kind: "profile" | "gallery";
  profileId: string;
  galleryId?: string;
  sourceUrl: string; // the current blurred URL (browser fetches from this)
}

interface PendingProfile {
  profileId: string;
  fullName: string;
  email: string;
  items: PendingItem[];
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);
    if (session.user.role !== "ADMIN") return err("Admins only", 403);

    const profiles = await prisma.modelProfile.findMany({
      select: {
        id: true,
        profilePictureUrl: true,
        originalPictureUrl: true,
        user: { select: { fullName: true, email: true } },
        gallery: {
          select: { id: true, imageUrl: true, originalImageUrl: true },
        },
      },
      orderBy: { id: "asc" },
    });

    let alreadyMigrated = 0;
    const pending: PendingProfile[] = [];

    for (const p of profiles) {
      const items: PendingItem[] = [];

      if (needsBackfill(p.originalPictureUrl) && p.profilePictureUrl) {
        items.push({
          kind: "profile",
          profileId: p.id,
          // Use the existing blurred public URL as source — the browser
          // downloads it, runs MediaPipe on it, re-blurs properly, and
          // also keeps the raw as the "original." Since the old system
          // stored the raw as the public "blurred" image, this is
          // effectively promoting the raw to be properly blurred.
          sourceUrl: p.originalPictureUrl?.startsWith("http")
            ? p.originalPictureUrl
            : p.profilePictureUrl,
        });
      }

      for (const g of p.gallery) {
        if (needsBackfill(g.originalImageUrl) && g.imageUrl) {
          items.push({
            kind: "gallery",
            profileId: p.id,
            galleryId: g.id,
            sourceUrl: g.originalImageUrl?.startsWith("http")
              ? g.originalImageUrl
              : g.imageUrl,
          });
        }
      }

      if (items.length === 0) {
        alreadyMigrated++;
      } else {
        pending.push({
          profileId: p.id,
          fullName: p.user.fullName,
          email: p.user.email,
          items,
        });
      }
    }

    return NextResponse.json({
      pending,
      alreadyMigrated,
      total: profiles.length,
    });
  } catch (e) {
    console.error("[backfill] GET error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);
    if (session.user.role !== "ADMIN") return err("Admins only", 403);

    const formData = await req.formData();
    const kind = formData.get("kind") as string | null;
    const profileId = formData.get("profileId") as string | null;
    const galleryId = formData.get("galleryId") as string | null;
    const blurredFile = formData.get("blurredImage") as File | null;
    const originalFile = formData.get("originalImage") as File | null;

    if (!kind || !profileId) return err("kind and profileId required");
    if (!["profile", "gallery"].includes(kind)) return err("Invalid kind");
    if (kind === "gallery" && !galleryId) return err("galleryId required for gallery kind");
    if (!blurredFile || !originalFile) return err("Both blurredImage and originalImage required");

    for (const f of [blurredFile, originalFile]) {
      if (f.size === 0) return err("Empty file");
      if (f.size > MAX_UPLOAD_BYTES) return err(`File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB`);
      if (!ALLOWED_MIME.includes(f.type as (typeof ALLOWED_MIME)[number])) {
        return err(`Unsupported file type: ${f.type}`);
      }
    }

    const blurredBuffer = Buffer.from(await blurredFile.arrayBuffer());
    const originalBuffer = Buffer.from(await originalFile.arrayBuffer());

    if (kind === "profile") {
      const profile = await prisma.modelProfile.findUnique({
        where: { id: profileId },
        select: { id: true, profilePictureUrl: true, originalPictureUrl: true },
      });
      if (!profile) return err("Profile not found", 404);
      if (!needsBackfill(profile.originalPictureUrl)) {
        return err("Already migrated", 409);
      }

      const stamp = Date.now();
      const blurredPath = `${profile.id}_profile_${stamp}.jpg`;
      const originalPath = `${profile.id}_profile_${stamp}.jpg`;

      await migrate({
        blurredBuffer,
        originalBuffer,
        blurredPath,
        originalPath,
        oldBlurredUrl: profile.profilePictureUrl,
        oldOriginalRef: profile.originalPictureUrl,
      });

      const { data: pub } = supabaseAdmin.storage
        .from(BUCKETS.PROFILE_PICTURES)
        .getPublicUrl(blurredPath);

      await prisma.modelProfile.update({
        where: { id: profile.id },
        data: {
          profilePictureUrl: pub.publicUrl,
          originalPictureUrl: originalPath,
          isFaceBlurred: true,
        },
      });

      console.log(`[backfill] profile ${profile.id} migrated ms=${Date.now() - startedAt}`);
      return NextResponse.json({ success: true });
    }

    // kind === "gallery"
    const gallery = await prisma.modelGallery.findUnique({
      where: { id: galleryId! },
      select: { id: true, imageUrl: true, originalImageUrl: true, modelProfileId: true },
    });
    if (!gallery) return err("Gallery item not found", 404);
    if (gallery.modelProfileId !== profileId) return err("Gallery item does not belong to profile", 403);
    if (!needsBackfill(gallery.originalImageUrl)) {
      return err("Already migrated", 409);
    }

    const stamp = Date.now();
    const blurredPath = `gallery/${profileId}_${gallery.id}_${stamp}.jpg`;
    const originalPath = `gallery/${profileId}_${gallery.id}_${stamp}.jpg`;

    await migrate({
      blurredBuffer,
      originalBuffer,
      blurredPath,
      originalPath,
      oldBlurredUrl: gallery.imageUrl,
      oldOriginalRef: gallery.originalImageUrl,
    });

    const { data: pub } = supabaseAdmin.storage
      .from(BUCKETS.PROFILE_PICTURES)
      .getPublicUrl(blurredPath);

    await prisma.modelGallery.update({
      where: { id: gallery.id },
      data: {
        imageUrl: pub.publicUrl,
        originalImageUrl: originalPath,
      },
    });

    console.log(`[backfill] gallery ${gallery.id} migrated ms=${Date.now() - startedAt}`);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[backfill] POST error", e);
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Shared upload + cleanup helpers ──────────────────────────────────────

interface MigrateArgs {
  blurredBuffer: Buffer;
  originalBuffer: Buffer;
  blurredPath: string;
  originalPath: string;
  oldBlurredUrl: string | null;
  oldOriginalRef: string | null;
}

async function migrate(a: MigrateArgs): Promise<void> {
  // Upload blurred → public
  {
    const { error } = await supabaseAdmin.storage
      .from(BUCKETS.PROFILE_PICTURES)
      .upload(a.blurredPath, a.blurredBuffer, {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "3600",
      });
    if (error) throw new Error(`blurred upload: ${error.message}`);
  }

  // Upload original → private
  {
    const { error } = await supabaseAdmin.storage
      .from(BUCKETS.PROFILE_PICTURES_ORIGINAL)
      .upload(a.originalPath, a.originalBuffer, {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "3600",
      });
    if (error) {
      await supabaseAdmin.storage
        .from(BUCKETS.PROFILE_PICTURES)
        .remove([a.blurredPath])
        .catch(() => {});
      throw new Error(`original upload: ${error.message}`);
    }
  }

  // Clean up old files (best-effort)
  await Promise.allSettled([
    removePublicFromUrl(a.oldBlurredUrl),
    removePublicFromUrl(a.oldOriginalRef),
  ]);
}

async function removePublicFromUrl(stored: string | null | undefined): Promise<void> {
  if (!stored) return;
  if (!stored.startsWith("http://") && !stored.startsWith("https://")) return;
  try {
    const marker = `/${BUCKETS.PROFILE_PICTURES}/`;
    const idx = stored.indexOf(marker);
    if (idx === -1) return;
    const path = stored.slice(idx + marker.length);
    if (path) {
      await supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES).remove([path]);
    }
  } catch (e) {
    console.warn("[backfill] cleanup failed", e);
  }
}