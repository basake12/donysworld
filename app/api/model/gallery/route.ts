import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin, BUCKETS } from "@/lib/supabase";
import { detectFaceFromUrl } from "@/lib/facebox";

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

// POST — upload a gallery image
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
    if (profile.gallery.length >= 6) {
      return err("Maximum 6 gallery images allowed");
    }

    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) return err("Image is required");

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) return err("JPG, PNG or WebP only");
    if (file.size > 8 * 1024 * 1024) return err("Max 8MB per image");

    const ext  = file.name.split(".").pop();
    const path = `gallery/${profile.id}_${Date.now()}.${ext}`;

    const buf = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKETS.PROFILE_PICTURES)
      .upload(path, buf, { contentType: file.type, upsert: false });

    if (uploadErr) return err(`Upload failed: ${uploadErr.message}`);

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKETS.PROFILE_PICTURES)
      .getPublicUrl(path);

    const imageUrl = urlData.publicUrl;

    // ── Detect face in uploaded gallery image ─────────────────────────────
    const faceBox = await detectFaceFromUrl(imageUrl);

    const item = await prisma.modelGallery.create({
      data: {
        modelProfileId: profile.id,
        imageUrl,
        faceBox:        faceBox ?? undefined,
        order:          profile.gallery.length,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (e: any) {
    console.error("[GALLERY UPLOAD ERROR]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — remove a gallery image
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
      include: { modelProfile: { select: { userId: true } } },
    });

    if (!item) return err("Not found", 404);
    if (item.modelProfile.userId !== session.user.id)
      return err("Not your image", 403);

    await prisma.modelGallery.delete({ where: { id } });

    return NextResponse.json({ message: "Deleted" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}