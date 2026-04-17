"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

interface FaceBox {
  x: number; // % from left
  y: number; // % from top
  w: number; // % width
  h: number; // % height
}

interface FaceBlurImageProps {
  src: string;
  alt: string;
  blurred: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  expiresAt?: string | null;
  cost?: number;
}

// Fallback box — renders instantly while ML loads
const DEFAULT_BOX: FaceBox = { x: 22, y: 4, w: 56, h: 35 };

// ── MediaPipe FaceDetector — singleton ────────────────────────────────────────
let _detectorPromise: Promise<any> | null = null;

async function getDetector(): Promise<any> {
  if (_detectorPromise) return _detectorPromise;

  _detectorPromise = (async () => {
    // Dynamic import — never runs server-side
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");

    // WASM runtime from CDN (cached after first load)
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    // BlazeFace short-range model — optimised for close-up portraits
    const detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.25, // low threshold — catches partially visible/darker faces
    });

    return detector;
  })();

  return _detectorPromise;
}

// ── Detect face, return normalised % box ──────────────────────────────────────
async function detectFace(imgEl: HTMLImageElement): Promise<FaceBox | null> {
  try {
    const detector = await getDetector();
    const result   = detector.detect(imgEl);

    if (!result?.detections?.length) return null;

    const box = result.detections[0].boundingBox;
    if (!box) return null;

    const iw = imgEl.naturalWidth  || imgEl.width  || 400;
    const ih = imgEl.naturalHeight || imgEl.height || 500;

    // Generous padding so forehead and chin are fully covered
    const padX = 0.28;
    const padY = 0.40;

    return {
      x: Math.max(0,   ((box.originX / iw) - padX / 2) * 100),
      y: Math.max(0,   ((box.originY / ih) - padY / 2) * 100),
      w: Math.min(100, ((box.width   / iw) + padX)     * 100),
      h: Math.min(100, ((box.height  / ih) + padY)     * 100),
    };
  } catch {
    return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function FaceBlurImage({
  src,
  alt,
  blurred,
  fill = false,
  width,
  height,
  className = "",
  sizes,
  priority = false,
  expiresAt,
}: FaceBlurImageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef     = useRef<HTMLImageElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [canvasReady, setReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => { setReady(false); }, [src]);

  // Expiry countdown
  useEffect(() => {
    if (!expiresAt || blurred) return;
    function calc() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft(null); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m`);
    }
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [expiresAt, blurred]);

  // ── Draw smooth Gaussian blur inside an elliptical clip ───────────────────
  const drawBlur = useCallback((img: HTMLImageElement, b: FaceBox) => {
    const canvas  = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const cw = wrapper.offsetWidth  || img.naturalWidth  || 400;
    const ch = wrapper.offsetHeight || img.naturalHeight || 500;
    canvas.width  = cw;
    canvas.height = ch;

    const ctx = canvas.getContext("2d") as any;
    if (!ctx) return;

    // Ellipse centre & radii from percentage box
    const ecx = ((b.x + b.w / 2) / 100) * cw;
    const ecy = ((b.y + b.h / 2) / 100) * ch;
    const erx = (b.w / 100) * cw / 2;
    const ery = (b.h / 100) * ch / 2;

    // Scale blur — subtle on tiny thumbnails, stronger on full view
    const blurPx = Math.max(10, Math.min(22, cw * 0.07));

    // 1. Full sharp image as background
    ctx.drawImage(img, 0, 0, cw, ch);

    // 2. Clip to ellipse → draw blurred copy inside
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ecx, ecy, erx, ery, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(img, 0, 0, cw, ch);
    ctx.filter = "none";
    ctx.restore();

    setReady(true);
  }, []);

  // ── Run detection then update blur ────────────────────────────────────────
  const run = useCallback(async (img: HTMLImageElement) => {
    if (!blurred) return;

    // Immediate render with default box — no waiting
    drawBlur(img, DEFAULT_BOX);

    // ML detection in background — replaces default if face found
    const box = await detectFace(img);
    if (box) drawBlur(img, box);
  }, [blurred, drawBlur]);

  const wrapperCls = fill
    ? `absolute inset-0 overflow-hidden ${className}`
    : `relative overflow-hidden ${className}`;

  return (
    <div ref={wrapperRef} className={wrapperCls}>
      <Image
        ref={imgRef as any}
        src={src}
        alt={alt}
        {...(fill ? { fill: true } : { width: width ?? 400, height: height ?? 500 })}
        sizes={sizes ?? "(max-width: 640px) 100vw, 400px"}
        className="object-cover object-top w-full h-full"
        priority={priority}
        crossOrigin="anonymous"
        onLoad={(e) => {
          if (blurred) run(e.currentTarget as HTMLImageElement);
        }}
      />

      {blurred && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: canvasReady ? 1 : 0, transition: "opacity 0.2s ease" }}
        />
      )}

      {!blurred && timeLeft && (
        <div
          className="absolute top-2 right-2 flex items-center gap-1 rounded-xl bg-black/70 border border-gold/30 px-2 py-1 text-[10px] text-gold font-bold backdrop-blur-sm pointer-events-none"
          style={{ zIndex: 10 }}
        >
          👁 {timeLeft}
        </div>
      )}
    </div>
  );
}