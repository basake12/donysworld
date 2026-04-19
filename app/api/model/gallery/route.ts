import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin, BUCKETS } from "@/lib/supabase";

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// GET — fetch model's gallery
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);

    const profile = await prisma.modelProfile.findUnique({
      where: { userId: session.user.id },
      include: { gallery: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({ gallery: profile?.gallery ?? [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — upload a gallery image (blurred + optional original)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);
    if (session.user.role !== "MODEL") return err("Models only", 403);

    const profile = await prisma.modelProfile.findUnique({
      where: { userId: session.user.id },
      include: { gallery: true },
    });

    if (!profile) return err("Profile not found", 404);
    if (profile.gallery.length >= 6) return err("Maximum 6 gallery images allowed");

    const formData = await req.formData();
    const file         = formData.get("image")    as File | null; // blurred version
    const originalFile = formData.get("original") as File | null; // original (for reveals)

    if (!file) return err("image is required");

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) return err("JPG, PNG or WebP only");
    if (file.size > 8 * 1024 * 1024) return err("Max 8MB per image");

    const ext  = file.name.split(".").pop() ?? "jpg";
    const path = `gallery/${profile.id}_${Date.now()}.${ext}`;
    const buf  = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKETS.PROFILE_PICTURES)
      .upload(path, buf, { contentType: file.type, upsert: false });

    if (uploadErr) return err(`Upload failed: ${uploadErr.message}`);

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKETS.PROFILE_PICTURES)
      .getPublicUrl(path);

    // Upload original if provided (non-fatal)
    let originalImageUrl: string | null = null;
    if (originalFile && allowed.includes(originalFile.type)) {
      try {
        const origExt  = originalFile.name.split(".").pop() ?? "jpg";
        const origPath = `gallery/original/${profile.id}_${Date.now()}.${origExt}`;
        const origBuf  = Buffer.from(await originalFile.arrayBuffer());

        const { error: origErr } = await supabaseAdmin.storage
          .from(BUCKETS.PROFILE_PICTURES)
          .upload(origPath, origBuf, { contentType: originalFile.type, upsert: false });

        if (!origErr) {
          originalImageUrl = supabaseAdmin.storage
            .from(BUCKETS.PROFILE_PICTURES)
            .getPublicUrl(origPath).data.publicUrl;
        }
      } catch {
        console.warn("[GALLERY POST] Original upload failed, continuing without it");
      }
    }

    const item = await prisma.modelGallery.create({
      data: {
        modelProfileId:  profile.id,
        imageUrl:        urlData.publicUrl,
        originalImageUrl,
        order:           profile.gallery.length,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (e: any) {
    console.error("[GALLERY UPLOAD ERROR]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — remove a gallery image and reorder remaining items
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
        where:   { modelProfileId: profileId },
        orderBy: { order: "asc" },
        select:  { id: true },
      });

      await Promise.all(
        remaining.map((g, idx) =>
          tx.modelGallery.update({ where: { id: g.id }, data: { order: idx } })
        )
      );
    });

    // Best-effort storage cleanup for both blurred and original
    for (const imageUrl of [item.imageUrl, item.originalImageUrl]) {
      if (!imageUrl) continue;
      try {
        const url      = new URL(imageUrl);
        const segments = url.pathname.split(`/${BUCKETS.PROFILE_PICTURES}/`);
        const oldPath  = segments[1];
        if (oldPath) {
          await supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES).remove([oldPath]);
        }
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ message: "Deleted" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}