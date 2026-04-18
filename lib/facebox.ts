/**
 * lib/facebox.ts
 *
 * Server-side face detection using @vladmandic/face-api
 * This is the actively-maintained Node.js fork of face-api.js.
 * No version conflicts, no native binaries, works on Windows/Mac/Linux.
 *
 * Setup:
 *   npm uninstall face-api.js @tensorflow/tfjs @tensorflow/tfjs-backend-cpu
 *   npm install @vladmandic/face-api @tensorflow/tfjs-node-cpu canvas
 *
 * Model files must be in: models/face-api/ (project root, NOT public/)
 *   tiny_face_detector_model-weights_manifest.json
 *   tiny_face_detector_model-shard1
 */

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

let _ready = false;
let _api: any = null;

async function init() {
  if (_ready) return _api;

  const faceapi = await import("@vladmandic/face-api");
  const path    = await import("path");
  const fs      = await import("fs");

  const modelPath = path.default.join(process.cwd(), "models", "face-api");
  if (!fs.default.existsSync(modelPath)) {
    console.warn("[facebox] Model folder not found:", modelPath);
    return null;
  }

  await faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath);

  _api   = faceapi;
  _ready = true;
  return faceapi;
}

export async function detectFaceFromUrl(imageUrl: string): Promise<FaceBox | null> {
  try {
    const faceapi = await init();
    if (!faceapi) return null;

    const { loadImage, createCanvas } = await import("canvas");

    const img    = await loadImage(imageUrl);
    const canvas = createCanvas(img.width, img.height);
    const ctx    = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    // @vladmandic/face-api accepts node-canvas directly
    const opts   = new faceapi.TinyFaceDetectorOptions({
      inputSize:      224,
      scoreThreshold: 0.3,
    });

    const result = await faceapi.detectSingleFace(canvas as any, opts);
    if (!result) return null;

    const { box }  = result;
    const padX     = 0.30;
    const padY     = 0.45;

    return {
      x: Math.max(0,   ((box.x      / img.width)  - padX / 2) * 100),
      y: Math.max(0,   ((box.y      / img.height) - padY / 2) * 100),
      w: Math.min(100, ((box.width  / img.width)  + padX)     * 100),
      h: Math.min(100, ((box.height / img.height) + padY)     * 100),
    };
  } catch (err) {
    console.error("[facebox] Detection failed:", err);
    return null;
  }
}