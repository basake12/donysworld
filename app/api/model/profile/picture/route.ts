import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin, BUCKETS } from "@/lib/supabase";

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/**
 * PATCH /api/model/profile/picture
 *
 * Accepts multipart/form-data:
 *   image    — blurred version (produced client-side by face-blur-client.ts)
 *   original — original unblurred version (for reveals — optional)
 *
 * Uploads both, updates the DB, deletes old files from Supabase.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);
    if (session.user.role !== "MODEL") return err("Models only", 403);

    const profile = await prisma.modelProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, profilePictureUrl: true, originalPictureUrl: true },
    });
    if (!profile) return err("Profile not found", 404);

    const formData     = await req.formData();
    const file         = formData.get("image")    as File | null;
    const originalFile = formData.get("original") as File | null;

    if (!file) return err("image is required");

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) return err("JPG, PNG or WebP only");
    if (file.size > 5 * 1024 * 1024) return err("Max 5MB");

    const ext  = file.name.split(".").pop() ?? "jpg";
    const path = `${profile.id}_profile_${Date.now()}.${ext}`;
    const buf  = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKETS.PROFILE_PICTURES)
      .upload(path, buf, { contentType: file.type, upsert: false });

    if (uploadErr) return err(`Upload failed: ${uploadErr.message}`);

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKETS.PROFILE_PICTURES)
      .getPublicUrl(path);

    // Upload original if provided (non-fatal)
    let originalPublicUrl: string | null = null;
    if (originalFile && allowed.includes(originalFile.type)) {
      try {
        const origExt  = originalFile.name.split(".").pop() ?? "jpg";
        const origPath = `original/${profile.id}_profile_${Date.now()}.${origExt}`;
        const origBuf  = Buffer.from(await originalFile.arrayBuffer());

        const { error: origErr } = await supabaseAdmin.storage
          .from(BUCKETS.PROFILE_PICTURES)
          .upload(origPath, origBuf, { contentType: originalFile.type, upsert: false });

        if (!origErr) {
          originalPublicUrl = supabaseAdmin.storage
            .from(BUCKETS.PROFILE_PICTURES)
            .getPublicUrl(origPath).data.publicUrl;
        }
      } catch {
        console.warn("[profile/picture] Original upload failed, continuing without it");
      }
    }

    await prisma.modelProfile.update({
      where: { id: profile.id },
      data: {
        profilePictureUrl:  urlData.publicUrl,
        originalPictureUrl: originalPublicUrl,
      },
    });

    // Best-effort cleanup of old files
    for (const oldUrl of [profile.profilePictureUrl, profile.originalPictureUrl]) {
      if (!oldUrl) continue;
      try {
        const url      = new URL(oldUrl);
        const segments = url.pathname.split(`/${BUCKETS.PROFILE_PICTURES}/`);
        const oldPath  = segments[1];
        if (oldPath) {
          await supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES).remove([oldPath]);
        }
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      profilePictureUrl: urlData.publicUrl,
      originalPictureUrl: originalPublicUrl,
      message: "Profile picture updated",
    });
  } catch (e: any) {
    console.error("[PROFILE PICTURE PATCH ERROR]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}