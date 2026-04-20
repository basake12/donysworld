/**
 * app/api/model/profile/picture/route.ts
 *
 * PATCH /api/model/profile/picture
 *
 * Accepts multipart/form-data with two fields:
 *   image     — PRE-BLURRED image produced by client-side MediaPipe
 *   original  — RAW original (for reveals — goes to private bucket)
 *
 * Pipeline:
 *   1. Validate auth + both files.
 *   2. Upload blurred → public bucket (profile-pictures)
 *      Upload original → private bucket (profile-pictures-original)
 *   3. Update DB:
 *        profilePictureUrl  = public URL of blurred
 *        originalPictureUrl = STORAGE PATH of private original
 *        isFaceBlurred      = true
 *   4. Best-effort delete of previously-stored files.
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

export async function PATCH(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);
    if (session.user.role !== "MODEL") return err("Models only", 403);

    const profile = await prisma.modelProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, profilePictureUrl: true, originalPictureUrl: true },
    });
    if (!profile) return err("Profile not found", 404);

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
    const blurredPath = `${profile.id}_profile_${stamp}.jpg`;
    const origExt = originalFile.type === "image/png"
      ? "png"
      : originalFile.type === "image/webp"
      ? "webp"
      : "jpg";
    const originalPath = `${profile.id}_profile_${stamp}.${origExt}`;

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
        console.error("[profile/picture] blurred upload failed", uploadErr);
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
        console.error("[profile/picture] original upload failed", origErr);
        return err(`Upload failed: ${origErr.message}`, 502);
      }
    }

    await prisma.modelProfile.update({
      where: { id: profile.id },
      data: {
        profilePictureUrl: publicUrlData.publicUrl,
        originalPictureUrl: originalPath,
        isFaceBlurred: true,
      },
    });

    await Promise.allSettled([
      deleteOldBlurred(profile.profilePictureUrl),
      deleteOldOriginal(profile.originalPictureUrl),
    ]);

    console.log(
      `[profile/picture] modelProfile=${profile.id} ms=${Date.now() - startedAt}`
    );

    return NextResponse.json({
      profilePictureUrl: publicUrlData.publicUrl,
      message: "Profile picture updated",
    });
  } catch (e) {
    console.error("[profile/picture] PATCH error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function deleteOldBlurred(prevUrl: string | null | undefined): Promise<void> {
  if (!prevUrl) return;
  try {
    const marker = `/${BUCKETS.PROFILE_PICTURES}/`;
    const idx = prevUrl.indexOf(marker);
    if (idx === -1) return;
    const oldPath = prevUrl.slice(idx + marker.length);
    if (!oldPath) return;
    await supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES).remove([oldPath]);
  } catch (e) {
    console.warn("[profile/picture] old blurred cleanup failed", e);
  }
}

async function deleteOldOriginal(prev: string | null | undefined): Promise<void> {
  if (!prev) return;
  try {
    if (prev.startsWith("http://") || prev.startsWith("https://")) {
      const marker = `/${BUCKETS.PROFILE_PICTURES}/`;
      const idx = prev.indexOf(marker);
      if (idx === -1) return;
      const oldPath = prev.slice(idx + marker.length);
      if (!oldPath) return;
      await supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES).remove([oldPath]);
    } else {
      await supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES_ORIGINAL).remove([prev]);
    }
  } catch (e) {
    console.warn("[profile/picture] old original cleanup failed", e);
  }
}