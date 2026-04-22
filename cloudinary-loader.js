/**
 * cloudinary-loader.js
 * Custom Next.js image loader that delegates resizing/format-conversion
 * to Cloudinary, so Vercel's image-optimization quota is never touched.
 *
 * Non-Cloudinary URLs (e.g. Supabase) are returned as-is.
 */
export default function cloudinaryLoader({ src, width, quality }) {
  // Pass non-Cloudinary URLs through untouched
  if (!src.includes("res.cloudinary.com")) return src;

  const uploadIndex = src.indexOf("/upload/");
  if (uploadIndex === -1) return src;

  const base   = src.substring(0, uploadIndex + 8); // …/upload/
  const path   = src.substring(uploadIndex + 8);    // v123456/folder/image.jpg

  const params = [
    `w_${width}`,
    `q_${quality ?? "auto"}`,
    "f_auto",   // serve webp/avif automatically based on browser support
    "c_limit",  // never upscale
  ].join(",");

  return `${base}${params}/${path}`;
}