// lib/face-blur-client.ts
"use client";

import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

// ─── Constants ──────────────────────────────────────────────────────────────
const DEFAULT_BLUR_PX = 40;

// ─── Module-level cache ─────────────────────────────────────────────────────
let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function getLandmarker(): Promise<FaceLandmarker> {
  if (landmarkerPromise) return landmarkerPromise;

  landmarkerPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      },
      runningMode: "IMAGE",
      numFaces: 5,
    });
  })();

  try {
    return await landmarkerPromise;
  } catch (err) {
    landmarkerPromise = null;
    throw err;
  }
}

// ─── Types & Helpers (unchanged) ───────────────────────────────────────────
export interface BlurResult {
  blurredFile: File;
  facesDetected: number;
  usedFallback: boolean;
}

export interface BlurOptions {
  blurPx?: number;
  fallbackFullBlur?: boolean;
  filename?: string;
  quality?: number;
}

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not decode image")); };
    img.src = url;
  });
}

function deriveFilename(file: File | Blob): string {
  if (file instanceof File && file.name) {
    const base = file.name.replace(/\.[^.]+$/, "");
    return `${base}_blurred.jpg`;
  }
  return `blurred_${Date.now()}.jpg`;
}

// ─── Main Function ──────────────────────────────────────────────────────────
export async function blurFace(
  file: File | Blob,
  options: BlurOptions = {}
): Promise<BlurResult> {
  const {
    blurPx = DEFAULT_BLUR_PX,
    fallbackFullBlur = true,
    filename,
    quality = 0.92,
  } = options;

  const landmarker = await getLandmarker();
  const img = await loadImage(file);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");

  ctx.drawImage(img, 0, 0);

  const results = landmarker.detect(img);
  const faceLandmarks = results.faceLandmarks ?? [];

  if (faceLandmarks.length > 0) {
    const w = canvas.width;
    const h = canvas.height;
    const oval = FaceLandmarker.FACE_LANDMARKS_FACE_OVAL;

    for (const landmarks of faceLandmarks) {
      ctx.save();
      ctx.beginPath();
      const first = landmarks[oval[0].start];
      ctx.moveTo(first.x * w, first.y * h);
      for (let i = 0; i < oval.length; i++) {
        const pt = landmarks[oval[i].end];
        ctx.lineTo(pt.x * w, pt.y * h);
      }
      ctx.closePath();

      ctx.clip();
      ctx.filter = `blur(${blurPx}px)`;
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    }
  } else if (fallbackFullBlur) {
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(img, 0, 0);
    ctx.filter = "none";
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      quality
    );
  });

  const safeName = filename ?? deriveFilename(file);
  const blurredFile = new File([blob], safeName, { type: "image/jpeg" });

  return {
    blurredFile,
    facesDetected: faceLandmarks.length,
    usedFallback: faceLandmarks.length === 0 && fallbackFullBlur,
  };
}

export async function warmupFaceBlur(): Promise<void> {
  await getLandmarker();
}