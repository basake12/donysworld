/**
 * lib/facebox.ts
 *
 * Server-side face detection using Google Cloud Vision API.
 * Free tier: 1,000 face detections/month at no cost.
 *
 * Setup:
 *   1. Go to https://console.cloud.google.com
 *   2. Enable "Cloud Vision API" on your project
 *   3. Create an API key (APIs & Services → Credentials → Create credentials → API key)
 *   4. Add to .env:  GOOGLE_VISION_API_KEY=your_key_here
 *
 * Returns a normalised FaceBox { x, y, w, h } in percentages,
 * or null if no face is detected or Vision API is not configured.
 */

export interface FaceBox {
  x: number; // % from left
  y: number; // % from top
  w: number; // % width
  h: number; // % height
}

/**
 * Fetch an image from a public URL and detect the primary face.
 * Returns percentage-based bounding box with padding, or null.
 */
export async function detectFaceFromUrl(imageUrl: string): Promise<FaceBox | null> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    console.warn("[facebox] GOOGLE_VISION_API_KEY not set — skipping face detection");
    return null;
  }

  try {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { source: { imageUri: imageUrl } },
              features: [{ type: "FACE_DETECTION", maxResults: 1 }],
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      console.error("[facebox] Vision API error", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const annotations = data.responses?.[0]?.faceAnnotations;
    if (!annotations?.length) return null;

    // fdBoundingPoly = tight face bounding polygon
    const poly = annotations[0].fdBoundingPoly?.vertices;
    if (!poly?.length) return null;

    // Get image dimensions from Vision response
    const imgProps = data.responses?.[0]?.imagePropertiesAnnotation;
    // Vision doesn't return dimensions directly — fetch image to get them
    const dims = await getImageDimensions(imageUrl);
    if (!dims) return null;

    const xs = poly.map((v: any) => v.x ?? 0);
    const ys = poly.map((v: any) => v.y ?? 0);

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    const faceW = maxX - minX;
    const faceH = maxY - minY;

    // Generous padding — covers forehead, ears, chin
    const padX = 0.30;
    const padY = 0.45;

    return {
      x: Math.max(0,   ((minX / dims.w) - padX / 2) * 100),
      y: Math.max(0,   ((minY / dims.h) - padY / 2) * 100),
      w: Math.min(100, ((faceW / dims.w) + padX)     * 100),
      h: Math.min(100, ((faceH / dims.h) + padY)     * 100),
    };
  } catch (err) {
    console.error("[facebox] Detection failed:", err);
    return null;
  }
}

/**
 * Fetch image and return its pixel dimensions.
 * Uses a HEAD request first to avoid downloading the full body if possible.
 */
async function getImageDimensions(url: string): Promise<{ w: number; h: number } | null> {
  try {
    // Download the image and use createImageBitmap to get real dimensions
    const res  = await fetch(url);
    if (!res.ok) return null;
    const buf  = await res.arrayBuffer();
    const blob = new Blob([buf]);
    const bmp  = await createImageBitmap(blob);
    const dims = { w: bmp.width, h: bmp.height };
    bmp.close();
    return dims;
  } catch {
    // createImageBitmap not available in all Node environments — parse JPEG/PNG headers
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return parseDimensions(buf);
    } catch {
      return null;
    }
  }
}

/** Parse image dimensions from raw bytes (JPEG / PNG / WebP) */
function parseDimensions(buf: Buffer): { w: number; h: number } | null {
  try {
    // PNG: 8-byte sig + 4-byte length + "IHDR" + 4-byte w + 4-byte h
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    // JPEG: scan for SOF marker
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] === 0xff && (buf[i + 1] & 0xf0) === 0xc0 && buf[i + 1] !== 0xff) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    // WebP: RIFF header
    if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") {
      return { w: buf.readUInt16LE(26) + 1, h: buf.readUInt16LE(28) + 1 };
    }
  } catch { /* ignore */ }
  return null;
}