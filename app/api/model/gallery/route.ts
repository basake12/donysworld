/**
 * app/api/model/gallery/route.ts
 *
 * Model gallery CRUD. Up to 6 images per model.
 *
 * POST  — upload one gallery image. Accepts { image, original }: client-blurred
 *         file + raw original. Blurred → public bucket, original → private.
 * GET   — list the authenticated model's own gallery.
 * DELETE?id=... — remove an item + reorder + clean up both buckets.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin, BUCKETS } from "@/lib/supabase";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// ─── GET ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);

    const profile = await prisma.modelProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        gallery: {
          orderBy: { order: "asc" },
          select: { id: true, imageUrl: true, order: true, createdAt: true },
        },
      },
    });

    return NextResponse.json({ gallery: profile?.gallery ?? [] });
  } catch (e) {
    console.error("[gallery] GET error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);
    if (session.user.role !== "MODEL") return err("Models only", 403);

    const profile = await prisma.modelProfile.findUnique({
      where: { userId: session.user.id },
      include: { gallery: { select: { id: true } } },
    });

    if (!profile) return err("Profile not found", 404);
    if (profile.gallery.length >= 6) return err("Maximum 6 gallery images allowed");

    const formData = await req.formData();
    const blurredFile = formData.get("image") as File | null;
    const originalFile = formData.get("original") as File | null;

    if (!blurredFile) return err("image (blurred) is required");
    if (!originalFile) return err("original is required");
    if (blurredFile.size === 0 || originalFile.size === 0) return err("File is empty");
    if (blurredFile.size > MAX_UPLOAD_BYTES) return err("Blurred image must be under 10MB");
    if (originalFile.size > MAX_UPLOAD_BYTES) return err("Original image must be under 10MB");

    if (!ALLOWED_MIME.includes(blurredFile.type as (typeof ALLOWED_MIME)[number])) {
      return err("Blurred image must be JPG, PNG or WebP");
    }
    if (!ALLOWED_MIME.includes(originalFile.type as (typeof ALLOWED_MIME)[number])) {
      return err("Original image must be JPG, PNG or WebP");
    }

    const blurredBuffer = Buffer.from(await blurredFile.arrayBuffer());
    const originalBuffer = Buffer.from(await originalFile.arrayBuffer());

    const stamp = Date.now();
    const blurredPath = `gallery/${profile.id}_${stamp}.jpg`;
    const origExt = originalFile.type === "image/png"
      ? "png"
      : originalFile.type === "image/webp"
      ? "webp"
      : "jpg";
    const originalPath = `gallery/${profile.id}_${stamp}.${origExt}`;

    // Upload blurred → public
    {
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(BUCKETS.PROFILE_PICTURES)
        .upload(blurredPath, blurredBuffer, {
          contentType: "image/jpeg",
          upsert: false,
          cacheControl: "3600",
        });
      if (uploadErr) {
        console.error("[gallery] blurred upload failed", uploadErr);
        return err(`Upload failed: ${uploadErr.message}`, 502);
      }
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKETS.PROFILE_PICTURES)
      .getPublicUrl(blurredPath);

    // Upload original → private
    {
      const { error: origErr } = await supabaseAdmin.storage
        .from(BUCKETS.PROFILE_PICTURES_ORIGINAL)
        .upload(originalPath, originalBuffer, {
          contentType: originalFile.type,
          upsert: false,
          cacheControl: "3600",
        });
      if (origErr) {
        await supabaseAdmin.storage
          .from(BUCKETS.PROFILE_PICTURES)
          .remove([blurredPath])
          .catch(() => {});
        console.error("[gallery] original upload failed", origErr);
        return err(`Upload failed: ${origErr.message}`, 502);
      }
    }

    const item = await prisma.modelGallery.create({
      data: {
        modelProfileId: profile.id,
        imageUrl: publicUrlData.publicUrl,
        originalImageUrl: originalPath,
        order: profile.gallery.length,
      },
    });

    console.log(`[gallery] modelProfile=${profile.id} ms=${Date.now() - startedAt}`);

    return NextResponse.json(
      {
        item: {
          id: item.id,
          imageUrl: item.imageUrl,
          order: item.order,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[gallery] POST error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);
    if (session.user.role !== "MODEL") return err("Models only", 403);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return err("id is required");

    const item = await prisma.modelGallery.findUnique({
      where: { id },
      include: { modelProfile: { select: { id: true, userId: true } } },
    });

    if (!item) return err("Not found", 404);
    if (item.modelProfile.userId !== session.user.id) return err("Not your image", 403);

    const profileId = item.modelProfile.id;

    await prisma.$transaction(async (tx) => {
      await tx.modelGallery.delete({ where: { id } });

      const remaining = await tx.modelGallery.findMany({
        where: { modelProfileId: profileId },
        orderBy: { order: "asc" },
        select: { id: true },
      });

      await Promise.all(
        remaining.map((g, idx) =>
          tx.modelGallery.update({ where: { id: g.id }, data: { order: idx } })
        )
      );
    });

    await Promise.allSettled([
      deleteBlurred(item.imageUrl),
      deleteOriginal(item.originalImageUrl),
    ]);

    return NextResponse.json({ message: "Deleted" });
  } catch (e) {
    console.error("[gallery] DELETE error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function deleteBlurred(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    const marker = `/${BUCKETS.PROFILE_PICTURES}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const path = url.slice(idx + marker.length);
    if (path) await supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES).remove([path]);
  } catch (e) {
    console.warn("[gallery] blurred cleanup failed", e);
  }
}

async function deleteOriginal(stored: string | null | undefined): Promise<void> {
  if (!stored) return;
  try {
    if (stored.startsWith("http://") || stored.startsWith("https://")) {
      const marker = `/${BUCKETS.PROFILE_PICTURES}/`;
      const idx = stored.indexOf(marker);
      if (idx === -1) return;
      const path = stored.slice(idx + marker.length);
      if (path) await supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES).remove([path]);
    } else {
      await supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES_ORIGINAL).remove([stored]);
    }
  } catch (e) {
    console.warn("[gallery] original cleanup failed", e);
  }
}