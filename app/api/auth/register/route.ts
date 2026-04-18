import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin, BUCKETS } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { Role, Gender, DocumentType } from "@prisma/client";
import { detectFaceFromUrl } from "@/lib/facebox";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function uploadFile(bucket: string, path: string, file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const isFormData = contentType.includes("multipart/form-data");

    let body: Record<string, string> = {};
    let profilePictureFile: File | null = null;
    let documentFile: File | null = null;

    if (isFormData) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        if (typeof value === "string") body[key] = value;
      });
      profilePictureFile = formData.get("profilePicture") as File | null;
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

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return errorResponse("An account with this email already exists");

    const hashedPassword = await bcrypt.hash(password, 12);

    // ── CLIENT ────────────────────────────────
    if (role === "CLIENT") {
      if (!genderInterestedIn) return errorResponse("Select the gender you are interested in");
      if (!["MALE", "FEMALE", "OTHER"].includes(genderInterestedIn))
        return errorResponse("Invalid gender interest value");

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName, email, password: hashedPassword,
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

    // ── MODEL ─────────────────────────────────
    if (role === "MODEL") {
      if (!profilePictureFile) return errorResponse("Profile picture is required");
      if (!documentFile) return errorResponse("Legal document is required");
      if (!documentType) return errorResponse("Document type is required");

      const validDocTypes = ["NIN", "DRIVERS_LICENSE", "VOTERS_CARD", "INTERNATIONAL_PASSPORT"];
      if (!validDocTypes.includes(documentType)) return errorResponse("Invalid document type");

      const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedImageTypes.includes(profilePictureFile.type))
        return errorResponse("Profile picture must be JPG, PNG or WebP");

      const allowedDocTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedDocTypes.includes(documentFile.type))
        return errorResponse("Document must be an image or PDF");

      if (profilePictureFile.size > 5 * 1024 * 1024)
        return errorResponse("Profile picture must be under 5MB");
      if (documentFile.size > 10 * 1024 * 1024)
        return errorResponse("Document must be under 10MB");

      const timestamp = Date.now();
      const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, "_");
      const profilePicExtension = profilePictureFile.name.split(".").pop();
      const profilePicPath = `${sanitizedEmail}_${timestamp}.${profilePicExtension}`;
      const docExtension = documentFile.name.split(".").pop();
      const docPath = `${sanitizedEmail}_${documentType}_${timestamp}.${docExtension}`;

      let uploadedProfilePath: string;
      let uploadedDocPath: string;

      try {
        uploadedProfilePath = await uploadFile(BUCKETS.PROFILE_PICTURES, profilePicPath, profilePictureFile);
      } catch (err: any) {
        return errorResponse(`Profile picture upload failed: ${err.message}`);
      }

      try {
        uploadedDocPath = await uploadFile(BUCKETS.LEGAL_DOCUMENTS, docPath, documentFile);
      } catch (err: any) {
        await supabaseAdmin.storage.from(BUCKETS.PROFILE_PICTURES).remove([uploadedProfilePath]);
        return errorResponse(`Document upload failed: ${err.message}`);
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from(BUCKETS.PROFILE_PICTURES)
        .getPublicUrl(uploadedProfilePath);

      // Detect face bounding box — runs after upload, non-fatal if it fails
      const faceBox = await detectFaceFromUrl(publicUrlData.publicUrl);

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName,
            nickname: nickname?.trim() || null,
            email,
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
            profilePictureUrl: publicUrlData.publicUrl,
            allowFaceReveal: false, isFaceBlurred: true,
            ...(faceBox && { faceBox }),
          },
        });

        await tx.modelDocument.create({
          data: {
            modelProfileId: modelProfile.id,
            documentType: documentType as DocumentType,
            documentUrl: uploadedDocPath,
          },
        });

        await tx.wallet.create({ data: { userId: user.id, balance: 0, pendingCoins: 0 } });
      });

      return NextResponse.json(
        { message: "Model application submitted. Awaiting admin approval." },
        { status: 201 }
      );
    }

    return errorResponse("Invalid role");
  } catch (err: any) {
    console.error("[REGISTER ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}