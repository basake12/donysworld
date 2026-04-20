import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin, BUCKETS } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { BodyType, Complexion, ModelStatus } from "@prisma/client";

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

interface RouteContext {
  params: Promise<{ profileId: string }>;
}

// ── PATCH — edit any model field ─────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);
    if (session.user.role !== "ADMIN") return err("Admins only", 403);

    const { profileId } = await params;
    const body = await req.json();

    const profile = await prisma.modelProfile.findUnique({
      where:  { id: profileId },
      select: { id: true, userId: true },
    });
    if (!profile) return err("Profile not found", 404);

    const {
      // Account fields
      fullName, nickname, whatsappNumber,
      // Password reset
      newPassword,
      // Profile fields
      age, height, city, state, bodyType, complexion, about,
      allowFaceReveal, isFaceBlurred, isAvailable,
      // Status
      status,
    } = body;

    // ── Update user account fields ─────────────────────────────────────────
    const userUpdate: Record<string, unknown> = {};
    if (fullName !== undefined)       userUpdate.fullName       = fullName.trim();
    if (nickname !== undefined)       userUpdate.nickname       = nickname?.trim() || null;
    if (whatsappNumber !== undefined) userUpdate.whatsappNumber = whatsappNumber.trim();
    if (newPassword !== undefined && newPassword.length >= 8) {
      userUpdate.password = await bcrypt.hash(newPassword, 12);
    }
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id: profile.userId }, data: userUpdate });
    }

    // ── Update profile fields ──────────────────────────────────────────────
    const profileUpdate: Record<string, unknown> = {};
    if (age !== undefined)             profileUpdate.age             = parseInt(age);
    if (height !== undefined)          profileUpdate.height          = height;
    if (city !== undefined)            profileUpdate.city            = city;
    if (state !== undefined)           profileUpdate.state           = state;
    if (bodyType !== undefined)        profileUpdate.bodyType        = bodyType as BodyType;
    if (complexion !== undefined)      profileUpdate.complexion      = complexion as Complexion;
    if (about !== undefined)           profileUpdate.about           = about;
    if (allowFaceReveal !== undefined) profileUpdate.allowFaceReveal = Boolean(allowFaceReveal);
    if (isFaceBlurred !== undefined)   profileUpdate.isFaceBlurred   = Boolean(isFaceBlurred);
    if (isAvailable !== undefined)     profileUpdate.isAvailable     = Boolean(isAvailable);
    if (status !== undefined)          profileUpdate.status          = status as ModelStatus;

    if (Object.keys(profileUpdate).length > 0) {
      await prisma.modelProfile.update({ where: { id: profileId }, data: profileUpdate });
    }

    return NextResponse.json({ message: "Model updated successfully" });
  } catch (e) {
    console.error("[ADMIN MODEL EDIT ERROR]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE — remove a gallery item with dual-mode cleanup ────────────────────
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);
    if (session.user.role !== "ADMIN") return err("Admins only", 403);

    const { profileId } = await params;
    const { searchParams } = new URL(req.url);
    const galleryId = searchParams.get("galleryId");
    if (!galleryId) return err("galleryId is required");

    const item = await prisma.modelGallery.findUnique({
      where: { id: galleryId },
      select: { id: true, imageUrl: true, originalImageUrl: true, modelProfileId: true },
    });
    if (!item) return err("Gallery item not found", 404);
    if (item.modelProfileId !== profileId) return err("Item does not belong to this profile", 403);

    await prisma.$transaction(async (tx) => {
      await tx.modelGallery.delete({ where: { id: galleryId } });
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

    // ── Dual-mode cleanup ────────────────────────────────────────────────
    // imageUrl is always a public URL (blurred).
    // originalImageUrl can be either:
    //   • legacy public URL (pre-backfill)   → delete from PROFILE_PICTURES
    //   • post-migration private path        → delete from PROFILE_PICTURES_ORIGINAL
    await Promise.allSettled([
      deleteBlurred(item.imageUrl),
      deleteOriginal(item.originalImageUrl),
    ]);

    return NextResponse.json({ message: "Gallery item deleted" });
  } catch (e) {
    console.error("[ADMIN GALLERY DELETE ERROR]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Cleanup helpers ────────────────────────────────────────────────────────

async function deleteBlurred(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    const marker = `/${BUCKETS.PROFILE_PICTURES}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const path = url.slice(idx + marker.length);
    if (path) {
      await supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES).remove([path]);
    }
  } catch (e) {
    console.warn("[admin edit] blurred cleanup failed", e);
  }
}

async function deleteOriginal(stored: string | null | undefined): Promise<void> {
  if (!stored) return;
  try {
    if (stored.startsWith("http://") || stored.startsWith("https://")) {
      // Legacy — original was in the PUBLIC bucket.
      const marker = `/${BUCKETS.PROFILE_PICTURES}/`;
      const idx = stored.indexOf(marker);
      if (idx === -1) return;
      const path = stored.slice(idx + marker.length);
      if (path) {
        await supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES).remove([path]);
      }
    } else {
      // Post-migration — path in the PRIVATE bucket.
      await supabaseAdmin.storage
        .from(BUCKETS.PROFILE_PICTURES_ORIGINAL)
        .remove([stored]);
    }
  } catch (e) {
    console.warn("[admin edit] original cleanup failed", e);
  }
}