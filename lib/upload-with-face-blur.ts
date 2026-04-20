import { v2 as cloudinary } from "cloudinary";

const BLUR_STRENGTH = 2000;

function getCloudName(): string {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) throw new Error("Missing CLOUDINARY_CLOUD_NAME");
  return cloudName;
}

function configureCloudinary() {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error("Missing Cloudinary environment variables.");
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// ── Fetch-based blur URL for existing Supabase originals ─────────
export function getBlurredFetchUrl(originalUrl: string): string {
  const encoded = encodeURIComponent(originalUrl);
  return `https://res.cloudinary.com/${getCloudName()}/image/fetch/e_blur_faces:${BLUR_STRENGTH},q_85/${encoded}`;
}

// ── Upload with Face Blur ────────────────────────────────────────
export async function uploadWithFaceBlur(
  file: File,
  type: "profile" | "gallery",
  id: string
) {
  configureCloudinary(); // validate + configure at call time, not module load

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const folder = `donys-world/${type}/${id}`;

  const result = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder, resource_type: "image", invalidate: true },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      )
      .end(buffer);
  });

  const blurredUrl = `https://res.cloudinary.com/${getCloudName()}/image/upload/e_blur_faces:${BLUR_STRENGTH},q_85/v${result.version}/${result.public_id}`;
  const originalUrl = result.secure_url;

  return { blurredUrl, originalUrl };
}