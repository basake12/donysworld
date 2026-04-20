/**
 * app/api/auth/register/route.ts
 *
 * POST — JSON for CLIENT, multipart/form-data for MODEL.
 *
 * Model pipeline (client-side blur):
 *   Client uses MediaPipe to blur the face before upload. Server receives
 *   both the pre-blurred file AND the raw original, uploads each to the
 *   appropriate bucket, and persists the model record.
 *
 *   Form fields:
 *     profilePicture   — PRE-BLURRED JPEG (public bucket)
 *     originalPicture  — RAW original (private bucket — gated by reveal-url)
 *     document         — legal doc (admin bucket, unchanged)
 *     role, fullName, email, password, gender, whatsappNumber, ...
 *
 * Defense against "attacker bypasses client blur" is NOT done here — the
 * model is admin-reviewed before activation, and face-reveal is gated by
 * the private-bucket signed-URL flow which this route sets up correctly.
 * If you later want extra server-side verification, run a detection check
 * against `profilePicture` and reject if a face is still clearly present.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin, BUCKETS } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { Role, Gender, DocumentType } from "@prisma/client";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"] as const;
const ALLOWED_DOC = [...ALLOWED_IMAGE, "application/pdf"] as const;

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function uploadToBucket(
  bucket: string,
  path: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, data, { contentType, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const isFormData = contentType.includes("multipart/form-data");

    let body: Record<string, string> = {};
    let blurredPictureFile: File | null = null;
    let originalPictureFile: File | null = null;
    let documentFile: File | null = null;

    if (isFormData) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        if (typeof value === "string") body[key] = value;
      });
      blurredPictureFile = formData.get("profilePicture") as File | null;
      originalPictureFile = formData.get("originalPicture") as File | null;
      documentFile = formData.get("document") as File | null;
    } else {
      body = await req.json();
    }

    const {
      role, fullName, email, password, gender, whatsappNumber,
      genderInterestedIn, documentType, nickname,
    } = body;

    if (!role || !fullName || !email || !password || !gender || !whatsappNumber) {
      return errorResponse("All required fields must be filled");
    }
    if (!["CLIENT", "MODEL"].includes(role)) return errorResponse("Invalid role");
    if (!["MALE", "FEMALE", "OTHER"].includes(gender)) return errorResponse("Invalid gender");
    if (password.length < 8) return errorResponse("Password must be at least 8 characters");

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return errorResponse("An account with this email already exists");

    const hashedPassword = await bcrypt.hash(password, 12);

    // ── CLIENT ───────────────────────────────────────────────────────────
    if (role === "CLIENT") {
      if (!genderInterestedIn) return errorResponse("Select the gender you are interested in");
      if (!["MALE", "FEMALE", "OTHER"].includes(genderInterestedIn))
        return errorResponse("Invalid gender interest value");

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName, email: normalizedEmail, password: hashedPassword,
            role: Role.CLIENT, gender: gender as Gender, whatsappNumber,
          },
        });
        await tx.clientProfile.create({
          data: { userId: user.id, genderInterestedIn: genderInterestedIn as Gender },
        });
        await tx.wallet.create({ data: { userId: user.id, balance: 0, pendingCoins: 0 } });
      });

      return NextResponse.json({ message: "Client account created successfully" }, { status: 201 });
    }

    // ── MODEL ────────────────────────────────────────────────────────────
    if (role === "MODEL") {
      if (!blurredPictureFile) return errorResponse("Profile picture is required");
      if (!originalPictureFile) return errorResponse("Original picture is required");
      if (!documentFile) return errorResponse("Legal document is required");
      if (!documentType) return errorResponse("Document type is required");

      const validDocTypes = ["NIN", "DRIVERS_LICENSE", "VOTERS_CARD", "INTERNATIONAL_PASSPORT"];
      if (!validDocTypes.includes(documentType)) return errorResponse("Invalid document type");

      if (!ALLOWED_IMAGE.includes(blurredPictureFile.type as (typeof ALLOWED_IMAGE)[number])) {
        return errorResponse("Profile picture must be JPG, PNG or WebP");
      }
      if (!ALLOWED_IMAGE.includes(originalPictureFile.type as (typeof ALLOWED_IMAGE)[number])) {
        return errorResponse("Original picture must be JPG, PNG or WebP");
      }
      if (!ALLOWED_DOC.includes(documentFile.type as (typeof ALLOWED_DOC)[number])) {
        return errorResponse("Document must be an image or PDF");
      }

      if (blurredPictureFile.size > MAX_IMAGE_BYTES) return errorResponse("Profile picture must be under 10MB");
      if (originalPictureFile.size > MAX_IMAGE_BYTES) return errorResponse("Original picture must be under 10MB");
      if (documentFile.size > MAX_DOC_BYTES) return errorResponse("Document must be under 10MB");

      const timestamp = Date.now();
      const sanitizedEmail = normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_");

      // Blurred is always JPEG from client.
      const blurredPath = `${sanitizedEmail}_${timestamp}.jpg`;

      // Original keeps its source format.
      const origExt = originalPictureFile.type === "image/png"
        ? "png"
        : originalPictureFile.type === "image/webp"
        ? "webp"
        : "jpg";
      const originalPath = `${sanitizedEmail}_${timestamp}.${origExt}`;

      const docExtension = documentFile.name.split(".").pop() ?? "bin";
      const docPath = `${sanitizedEmail}_${documentType}_${timestamp}.${docExtension}`;

      const blurredBuffer = Buffer.from(await blurredPictureFile.arrayBuffer());
      const originalBuffer = Buffer.from(await originalPictureFile.arrayBuffer());
      const docBuffer = Buffer.from(await documentFile.arrayBuffer());

      // Upload blurred → public
      try {
        await uploadToBucket(BUCKETS.PROFILE_PICTURES, blurredPath, blurredBuffer, "image/jpeg");
      } catch (e) {
        return errorResponse(`Profile picture upload failed: ${e instanceof Error ? e.message : "unknown"}`);
      }

      // Upload original → private
      try {
        await uploadToBucket(
          BUCKETS.PROFILE_PICTURES_ORIGINAL,
          originalPath,
          originalBuffer,
          originalPictureFile.type
        );
      } catch (e) {
        await supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES).remove([blurredPath]).catch(() => {});
        return errorResponse(`Profile picture upload failed: ${e instanceof Error ? e.message : "unknown"}`);
      }

      // Upload document → private legal
      try {
        await uploadToBucket(BUCKETS.LEGAL_DOCUMENTS, docPath, docBuffer, documentFile.type);
      } catch (e) {
        await Promise.allSettled([
          supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES).remove([blurredPath]),
          supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES_ORIGINAL).remove([originalPath]),
        ]);
        return errorResponse(`Document upload failed: ${e instanceof Error ? e.message : "unknown"}`);
      }

      const { data: blurredUrlData } = supabaseAdmin.storage
        .from(BUCKETS.PROFILE_PICTURES)
        .getPublicUrl(blurredPath);

      // Persist in DB.
      try {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              fullName,
              nickname: nickname?.trim() || null,
              email: normalizedEmail,
              password: hashedPassword,
              role: Role.MODEL,
              gender: gender as Gender,
              whatsappNumber,
            },
          });

          const modelProfile = await tx.modelProfile.create({
            data: {
              userId: user.id,
              age: 0, height: "", city: "", state: "",
              bodyType: "AVERAGE", complexion: "MEDIUM", about: "",
              profilePictureUrl:  blurredUrlData.publicUrl,
              originalPictureUrl: originalPath, // PRIVATE bucket path
              allowFaceReveal: false,
              isFaceBlurred: true,
            },
          });

          await tx.modelDocument.create({
            data: {
              modelProfileId: modelProfile.id,
              documentType: documentType as DocumentType,
              documentUrl: docPath,
            },
          });

          await tx.wallet.create({ data: { userId: user.id, balance: 0, pendingCoins: 0 } });
        });
      } catch (e) {
        await Promise.allSettled([
          supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES).remove([blurredPath]),
          supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES_ORIGINAL).remove([originalPath]),
          supabaseAdmin.storage.from(BUCKETS.LEGAL_DOCUMENTS).remove([docPath]),
        ]);
        throw e;
      }

      return NextResponse.json(
        { message: "Model application submitted. Awaiting admin approval." },
        { status: 201 }
      );
    }

    return errorResponse("Invalid role");
  } catch (err) {
    console.error("[REGISTER ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}