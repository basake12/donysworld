import { v2 as cloudinary } from "cloudinary";

// ── Cloudinary Configuration ─────────────────────────────────────
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

// ── Upload with Face Blur (now with proper cache busting) ────────
export async function uploadWithFaceBlur(
  file: File,
  type: "profile" | "gallery",
  id: string
) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const folder = `donys-world/${type}/${id}`;

  const result = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        invalidate: true,           // force cache clear
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(buffer);
  });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const version   = result.version;

  // 🔥 Proper blurred URL with version + quality for sharp, fresh blur
  const blurredUrl = `https://res.cloudinary.com/${cloudName}/image/upload/e_blur_faces:2000,q_85/v${version}/${result.public_id}`;

  const originalUrl = result.secure_url;

  return { blurredUrl, originalUrl };
}