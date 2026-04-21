/**
 * app/api/auth/register/route.ts
 *
 * POST — JSON for CLIENT, multipart/form-data for MODEL.
 *
 * Model pipeline:
 *   Frontend sends one file (profilePicture). Server uploads it to
 *   Cloudinary via uploadWithFaceBlur, which returns:
 *     blurredUrl   — face-blurred version stored in profilePictureUrl
 *     originalUrl  — raw original stored in originalPictureUrl
 *   Legal document uploads to Supabase as before.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin, BUCKETS } from "@/lib/supabase";
import { uploadWithFaceBlur } from "@/lib/upload-with-face-blur";
import bcrypt from "bcryptjs";
import { Role, Gender, DocumentType } from "@prisma/client";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DOC_BYTES   = 10 * 1024 * 1024;
const ALLOWED_IMAGE   = ["image/jpeg", "image/png", "image/webp"] as const;
const ALLOWED_DOC     = [...ALLOWED_IMAGE, "application/pdf"] as const;

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function uploadToBucket(
  bucket: string, path: string, data: Buffer, contentType: string
): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, data, { contentType, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const isFormData  = contentType.includes("multipart/form-data");

    let body: Record<string, string> = {};
    let profilePictureFile: File | null = null;
    let documentFile:       File | null = null;

    if (isFormData) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        if (typeof value === "string") body[key] = value;
      });
      profilePictureFile = formData.get("profilePicture") as File | null;
      documentFile       = formData.get("document")       as File | null;
    } else {
      body = await req.json();
    }

    const {
      role, fullName, email, password, gender, whatsappNumber,
      genderInterestedIn, documentType, nickname,
    } = body;

    if (!role || !fullName || !email || !password || !gender || !whatsappNumber)
      return errorResponse("All required fields must be filled");
    if (!["CLIENT", "MODEL"].includes(role)) return errorResponse("Invalid role");
    if (!["MALE", "FEMALE", "OTHER"].includes(gender)) return errorResponse("Invalid gender");
    if (password.length < 8) return errorResponse("Password must be at least 8 characters");

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return errorResponse("An account with this email already exists");

    const hashedPassword = await bcrypt.hash(password, 12);

    // ── CLIENT ────────────────────────────────────────────────────────────
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

    // ── MODEL ─────────────────────────────────────────────────────────────
    if (role === "MODEL") {
      if (!profilePictureFile) return errorResponse("Profile picture is required");
      if (!documentFile)       return errorResponse("Legal document is required");
      if (!documentType)       return errorResponse("Document type is required");

      const validDocTypes = ["NIN", "DRIVERS_LICENSE", "VOTERS_CARD", "INTERNATIONAL_PASSPORT"];
      if (!validDocTypes.includes(documentType)) return errorResponse("Invalid document type");

      if (!ALLOWED_IMAGE.includes(profilePictureFile.type as (typeof ALLOWED_IMAGE)[number]))
        return errorResponse("Profile picture must be JPG, PNG or WebP");
      if (!ALLOWED_DOC.includes(documentFile.type as (typeof ALLOWED_DOC)[number]))
        return errorResponse("Document must be an image or PDF");

      if (profilePictureFile.size > MAX_IMAGE_BYTES) return errorResponse("Profile picture must be under 10MB");
      if (documentFile.size > MAX_DOC_BYTES)         return errorResponse("Document must be under 10MB");

      // ── Upload profile picture to Cloudinary (blur + original) ──────────
      let blurredUrl:  string;
      let originalUrl: string;
      try {
        // We need a temp userId placeholder — use sanitized email as folder id
        const sanitizedEmail = normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_");
        ({ blurredUrl, originalUrl } = await uploadWithFaceBlur(
          profilePictureFile, "profile", sanitizedEmail
        ));
      } catch (e) {
        return errorResponse(`Profile picture upload failed: ${e instanceof Error ? e.message : "unknown"}`);
      }

      // ── Upload document to Supabase ──────────────────────────────────────
      const timestamp    = Date.now();
      const sanitizedEmail = normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_");
      const docExtension = documentFile.name.split(".").pop() ?? "bin";
      const docPath      = `${sanitizedEmail}_${documentType}_${timestamp}.${docExtension}`;
      const docBuffer    = Buffer.from(await documentFile.arrayBuffer());

      try {
        await uploadToBucket(BUCKETS.LEGAL_DOCUMENTS, docPath, docBuffer, documentFile.type);
      } catch (e) {
        return errorResponse(`Document upload failed: ${e instanceof Error ? e.message : "unknown"}`);
      }

      // ── Persist in DB ────────────────────────────────────────────────────
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
              profilePictureUrl:  blurredUrl,
              originalPictureUrl: originalUrl,
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
        // Doc cleanup — Cloudinary images stay (harmless orphans vs broken UX)
        await supabaseAdmin.storage.from(BUCKETS.LEGAL_DOCUMENTS).remove([docPath]).catch(() => {});
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