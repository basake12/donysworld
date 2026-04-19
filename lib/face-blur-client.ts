/**
 * lib/face-blur-client.ts
 *
 * Browser-side face detection + canvas blur.
 * Exact port of the reference implementation (zCt, QY, vV, BCt, yV).
 *
 * Models are loaded from /public/models/ (served as static assets).
 * Call blurFace(imageUrl) to get a pre-blurred JPEG dataUrl.
 *
 * Only import this file in "use client" components — it uses
 * browser APIs (Image, canvas, navigator) and must never run server-side.
 */

// ─── Globals ─────────────────────────────────────────────────────────────────

let modelsLoaded = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceapi: any = null;

// ─── Backend init (BCt) ──────────────────────────────────────────────────────

async function initBackend() {
  const tf = faceapi?.tf ?? (await import("face-api.js")).tf;

  if (tf.getBackend()) return; // already set

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  try {
    if (isIOS) {
      console.log("[FaceBlur] iOS detected: Forcing CPU backend for stability");
      await tf.setBackend("cpu");
    } else {
      try {
        await tf.setBackend("webgl");
      } catch {
        console.warn("[FaceBlur] WebGL failed, falling back to CPU");
        await tf.setBackend("cpu");
      }
    }
    await tf.ready();
    console.log(`[FaceBlur] Backend set to: ${tf.getBackend()}`);
  } catch (e) {
    console.error("[FaceBlur] Backend configuration failed:", e);
  }
}

// ─── Model loader (yV) ───────────────────────────────────────────────────────

export async function loadModels() {
  if (modelsLoaded) return;

  const fa = await import("face-api.js");
  faceapi = fa;

  await initBackend();

  await Promise.all([
    fa.nets.tinyFaceDetector.loadFromUri("/models"),
    fa.nets.faceLandmark68Net.loadFromUri("/models"),
  ]);

  modelsLoaded = true;
  console.log("[FaceBlur] Models loaded successfully");
}

// ─── IoU — min-overlap variant (QY) ──────────────────────────────────────────
// Reference: intersection / Math.min(areaA, areaB) > 0.5

function isDuplicate(
  e: { x: number; y: number; width: number; height: number },
  t: { x: number; y: number; width: number; height: number }
): boolean {
  const r = Math.max(e.x, t.x);
  const n = Math.max(e.y, t.y);
  const a = Math.min(e.x + e.width,  t.x + t.width)  - r;
  const s = Math.min(e.y + e.height, t.y + t.height) - n;
  if (a <= 0 || s <= 0) return false;
  const i = a * s;
  const o = e.width * e.height;
  const c = t.width * t.height;
  const u = Math.min(o, c);
  return i / u > 0.5;
}

// ─── Detection — three passes (zCt) ──────────────────────────────────────────

type Box = { x: number; y: number; width: number; height: number };
type Detection = { box: Box; score: number };

async function detectFaces(img: HTMLImageElement): Promise<Detection[]> {
  const accepted: Detection[] = [];

  // ── Pass 1: Strict landmark-confirmed, inputSizes [608, 416] ─────────────
  const inputSizes = [608, 416];
  const n = 0.3; // detector scoreThreshold (wide net)

  for (const a of inputSizes) {
    const s = new faceapi.TinyFaceDetectorOptions({ inputSize: a, scoreThreshold: n });
    const i = await faceapi.detectAllFaces(img, s).withFaceLandmarks();

    if (i.length > 0) {
      for (const o of i) {
        const c = o.detection.box as Box;
        const u = o.detection.score as number;
        if (u < 0.4) continue;
        const d = c.width / c.height;
        if (d < 0.6 || d > 1.5) continue;
        const h = (c.y + c.height / 2) / img.height;
        if (h > 0.65 || (c.width * c.height) / (img.width * img.height) < 0.005) continue;
        if (accepted.some((m) => isDuplicate(m.box, c))) continue;
        console.log(`[FaceBlur] Accepted face: score=${u.toFixed(2)}, centerY=${h.toFixed(2)}, aspect=${d.toFixed(2)}`);
        accepted.push({ box: c, score: u });
      }
    }

    if (accepted.length > 0) {
      console.log(`[FaceBlur] Found ${accepted.length} landmark-confirmed face(s) at inputSize ${a}`);
      break;
    }
  }

  // ── Pass 2: Relaxed landmark-confirmed ───────────────────────────────────
  if (accepted.length === 0) {
    console.log("[FaceBlur] No faces found in strict pass, trying relaxed landmark pass");

    const a = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 });
    const s = await faceapi.detectAllFaces(img, a).withFaceLandmarks();

    for (const i of s) {
      const o = i.detection.box as Box;
      const c = i.detection.score as number;
      if (c < 0.35) continue;
      const u = o.width / o.height;
      if (u < 0.45 || u > 1.8) continue;
      const d = (o.y + o.height / 2) / img.height;
      if (d > 0.85 || (o.width * o.height) / (img.width * img.height) < 0.002) continue;
      if (accepted.some((p) => isDuplicate(p.box, o))) continue;
      console.log(`[FaceBlur] Relaxed pass accepted face: score=${c.toFixed(2)}, centerY=${d.toFixed(2)}, aspect=${u.toFixed(2)}`);
      accepted.push({ box: o, score: c });
    }
  }

  // ── Pass 3: Fallback — no landmark confirmation ───────────────────────────
  if (accepted.length === 0) {
    const a = new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.5 });
    const s = await faceapi.detectAllFaces(img, a);

    for (const i of s) {
      const o = i.box as Box;
      const c = (o.y + o.height / 2) / img.height;
      if (c > 0.5) continue;
      const u = o.width / o.height;
      if (u < 0.7 || u > 1.3) continue;
      accepted.push({ box: o, score: i.score });
      console.log(`[FaceBlur] Fallback detection: score=${i.score.toFixed(2)}, centerY=${c.toFixed(2)}`);
    }
  }

  console.log(`[FaceBlur] Total faces detected: ${accepted.length}`);
  return accepted;
}

// ─── Public API (vV) ─────────────────────────────────────────────────────────

export interface BlurResult {
  /** Pre-blurred JPEG as a base64 data URL — store this as the public image. */
  dataUrl: string;
  facesDetected: number;
  /** True when no face was found and the entire image was blurred instead. */
  usedFallback: boolean;
}

/**
 * Runs client-side face detection on `imageUrl`, blurs detected faces on a
 * canvas with an elliptical clip + blur(40px), and returns the result as a
 * JPEG data URL.
 *
 * If no faces are found and `fallbackFullBlur` is true (default), the entire
 * image is blurred and `usedFallback` is set to true.
 *
 * @param imageUrl      Public URL or object URL of the source image.
 * @param blurPx        Blur radius in pixels (default 40, matches reference).
 * @param fallbackFullBlur  Blur entire image when no face found (default true).
 */
export async function blurFace(
  imageUrl: string,
  blurPx = 40,
  fallbackFullBlur = true
): Promise<BlurResult> {
  if (!modelsLoaded) await loadModels();

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = async () => {
      try {
        console.log("[FaceBlur] Detecting faces...");
        const faces = await detectFaces(img);
        console.log(`[FaceBlur] Found ${faces.length} face(s)`);

        const canvas = document.createElement("canvas");
        canvas.width  = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        if (faces.length > 0) {
          // Blur each detected face region with an elliptical clip
          for (const det of faces) {
            const h = det.box;
            const f = 0.2; // padding factor — matches reference exactly
            const p = Math.max(0, h.x - h.width  * f);
            const m = Math.max(0, h.y - h.height * f);
            const g = Math.min(canvas.width  - p, h.width  * (1 + 2 * f));
            const x = Math.min(canvas.height - m, h.height * (1 + 2 * f));

            console.log("[FaceBlur] Blurring face at:", { x: p, y: m, width: g, height: x });

            const cx = p + g / 2;
            const cy = m + x / 2;
            const rx = g / 2;
            const ry = x / 2;

            ctx.save();
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.clip();
            ctx.filter = `blur(${blurPx}px)`;
            ctx.drawImage(img, 0, 0);
            ctx.filter = "none";
            ctx.restore();
          }

          const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
          resolve({ dataUrl, facesDetected: faces.length, usedFallback: false });

        } else if (fallbackFullBlur) {
          // No face found — blur the entire image
          console.log("[FaceBlur] No faces detected, applying full image blur");
          ctx.filter = `blur(${blurPx}px)`;
          ctx.drawImage(img, 0, 0);
          ctx.filter = "none";
          const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
          resolve({ dataUrl, facesDetected: 0, usedFallback: true });

        } else {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
          resolve({ dataUrl, facesDetected: 0, usedFallback: false });
        }

      } catch (e) {
        console.error("[FaceBlur] Error processing image:", e);
        reject(e);
      }
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
}

/**
 * Converts a base64 data URL back into a File object.
 * Used to turn the blurred dataUrl into an uploadable file (xA in reference).
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)![1];
  const binary = atob(base64);
  let len = binary.length;
  const bytes = new Uint8Array(len);
  while (len--) bytes[len] = binary.charCodeAt(len);
  return new File([bytes], filename, { type: mime });
}