/**
 * app/api/model/[modelProfileId]/reveal-url/route.ts
 *
 * GET /api/model/{modelProfileId}/reveal-url
 *
 * The ONLY code path in the app that can produce URLs to a model's original
 * (unblurred) images. Returns ALL originals (profile + gallery) in a single
 * response, so a caller doing a reveal only needs one fetch per refresh
 * cycle regardless of how many images the model has.
 *
 * Contract:
 *   401 — not signed in
 *   403 — signed in but role != CLIENT, or model.allowFaceReveal is false
 *   404 — model not found
 *   410 — no active reveal (client hasn't paid yet, or the 24h window expired)
 *   200 — {
 *           profilePicture?: string,            // signed URL; omitted if no original on file
 *           gallery: Record<galleryId, string>, // only entries with an original
 *           urlExpiresAt: ISO string,           // when these URLs die — re-fetch before
 *           revealExpiresAt: ISO string         // when the 24h reveal window closes
 *         }
 *
 * Backward-compat: any legacy originals still stored as full public URLs
 * (pre-Phase-D backfill) are returned verbatim. New uploads go into the
 * private bucket and get signed.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin, BUCKETS } from "@/lib/supabase";

export const runtime = "nodejs";

// Short TTL — the whole point is that a captured URL dies quickly.
const SIGNED_URL_TTL_SECONDS = 60;

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/**
 * Resolves a stored original-reference into a live URL.
 *   • `http(s)://…` → legacy public URL, return verbatim
 *   • anything else → path inside the private bucket, return a signed URL
 * Returns null when signing fails so the caller can omit the entry.
 */
async function resolveToUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;

  if (stored.startsWith("http://") || stored.startsWith("https://")) {
    return stored;
  }

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKETS.PROFILE_PICTURES_ORIGINAL)
    .createSignedUrl(stored, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("[reveal-url] sign failed", { path: stored, error });
    return null;
  }

  return data.signedUrl;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ modelProfileId: string }> }
) {
  try {
    const { modelProfileId } = await params;
    if (!modelProfileId) return err("modelProfileId required");

    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);
    if (session.user.role !== "CLIENT") return err("Clients only", 403);

    // Scope to ClientProfile.id — FaceReveal.clientId references that, not User.id.
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!clientProfile) return err("Client profile not found", 404);

    // Single query: model + its non-expired reveal for this client + gallery.
    const model = await prisma.modelProfile.findUnique({
      where: { id: modelProfileId },
      select: {
        originalPictureUrl: true,
        allowFaceReveal: true,
        faceReveals: {
          where: {
            clientId: clientProfile.id,
            expiresAt: { gt: new Date() },
          },
          select: { expiresAt: true },
          take: 1,
        },
        gallery: {
          select: { id: true, originalImageUrl: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!model) return err("Model not found", 404);
    if (!model.allowFaceReveal) return err("Reveals not allowed for this model", 403);

    const reveal = model.faceReveals[0];
    if (!reveal) return err("No active reveal — purchase required", 410);

    // Resolve profile + every gallery entry in parallel.
    const [profileUrl, galleryEntries] = await Promise.all([
      resolveToUrl(model.originalPictureUrl),
      Promise.all(
        model.gallery.map(async (g) => ({
          id: g.id,
          url: await resolveToUrl(g.originalImageUrl),
        }))
      ),
    ]);

    const galleryMap: Record<string, string> = {};
    for (const entry of galleryEntries) {
      if (entry.url) galleryMap[entry.id] = entry.url;
    }

    const urlExpiresAt = new Date(
      Date.now() + SIGNED_URL_TTL_SECONDS * 1000
    ).toISOString();

    return NextResponse.json(
      {
        profilePicture: profileUrl ?? undefined,
        gallery: galleryMap,
        urlExpiresAt,
        revealExpiresAt: reveal.expiresAt.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (e) {
    console.error("[reveal-url] GET error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}