/**
 * lib/face-blur-client.ts
 *
 * Client-side face detection + authoritative blur using MediaPipe Face Detector.
 *
 * Input:  a File or Blob (raw image from upload).
 * Output: a { blurredFile, facesDetected, usedFallback } result — the blurred
 *         file is what gets sent to the server as the public-bucket version.
 *
 * The detector is loaded from MediaPipe's CDN once per page session and
 * cached. No native deps, no tfjs-node, no server compute — runs entirely
 * in the user's browser using WASM.
 *
 * This file is browser-only. It MUST NOT be imported from a server component.
 */

"use client";

import {
  FilesetResolver,
  FaceDetector,
} from "@mediapipe/tasks-vision";

// ─── Constants ──────────────────────────────────────────────────────────────

// Default blur strength in pixels. 35-45px gives a visually opaque face patch.
const DEFAULT_BLUR_PX = 40;

// Face padding — expand the detected box by this fraction on each side so
// the blur extends past ears / chin / hairline.
const BOX_PADDING = 0.2;

// Confidence threshold. MediaPipe returns fairly clean detections, 0.5 is
// a sane default; lower finds more faces but risks false positives.
const MIN_CONFIDENCE = 0.5;

// ─── Module-level cache ─────────────────────────────────────────────────────

let detectorPromise: Promise<FaceDetector> | null = null;

async function getDetector(): Promise<FaceDetector> {
  if (detectorPromise) return detectorPromise;

  detectorPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");

    return FaceDetector.createFromModelPath(
      vision,
      "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
    );
  })();

  try {
    return await detectorPromise;
  } catch (err) {
    detectorPromise = null; // allow retry
    throw err;
  }
}

// ─── Public result type ─────────────────────────────────────────────────────

export interface BlurResult {
  /** The blurred image as a File — JPEG, ready to upload. */
  blurredFile: File;
  /** Number of faces detected in the source image. */
  facesDetected: number;
  /** True when no face was found and the entire image was blurred instead. */
  usedFallback: boolean;
}

export interface BlurOptions {
  /** Blur radius in CSS pixels. Default 40. */
  blurPx?: number;
  /** Blur whole image when no face detected. Default true. */
  fallbackFullBlur?: boolean;
  /** Filename for the resulting File. Default derives from source. */
  filename?: string;
  /** JPEG quality 0-1. Default 0.92. */
  quality?: number;
}

// ─── Internal: load a File into an HTMLImageElement ─────────────────────────

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    img.src = url;
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Detect faces in the image and produce a JPEG with each face blurred under
 * an elliptical mask. If no face is found and fallbackFullBlur is true
 * (default), the entire image is blurred.
 *
 * Throws if the image cannot be decoded or the detector cannot load. Callers
 * should handle these errors by showing a user-facing message and declining
 * to upload.
 */
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

  const detector = await getDetector();
  const img = await loadImage(file);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");

  // MediaPipe needs an HTMLImageElement-ish input. Detect on the raw image.
  const results = detector.detect(img);
  const detections = (results.detections ?? []).filter(
    (d) => (d.categories?.[0]?.score ?? 0) >= MIN_CONFIDENCE
  );

  // Always draw the source first.
  ctx.drawImage(img, 0, 0);

  if (detections.length > 0) {
    // Targeted blur per face.
    for (const det of detections) {
      const box = det.boundingBox;
      if (!box) continue;

      const padX = Math.max(0, box.originX - box.width * BOX_PADDING);
      const padY = Math.max(0, box.originY - box.height * BOX_PADDING);
      const padW = Math.min(
        canvas.width - padX,
        box.width * (1 + 2 * BOX_PADDING)
      );
      const padH = Math.min(
        canvas.height - padY,
        box.height * (1 + 2 * BOX_PADDING)
      );

      const cx = padX + padW / 2;
      const cy = padY + padH / 2;
      const rx = padW / 2;
      const ry = padH / 2;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.filter = `blur(${blurPx}px)`;
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
  } else if (fallbackFullBlur) {
    // No face found — blur the entire image as a safety default.
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(img, 0, 0);
    ctx.filter = "none";
  }
  // Else: leave the canvas with just the original (caller opted out of fallback).

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
    facesDetected: detections.length,
    usedFallback: detections.length === 0 && fallbackFullBlur,
  };
}

function deriveFilename(file: File | Blob): string {
  if (file instanceof File && file.name) {
    const base = file.name.replace(/\.[^.]+$/, "");
    return `${base}_blurred.jpg`;
  }
  return `blurred_${Date.now()}.jpg`;
}

/** Preload the detector — optional, useful to call on page mount to hide the
 *  cold-start cost during the first actual blur. */
export async function warmupFaceBlur(): Promise<void> {
  await getDetector();
}