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

// Fallback box — used when ML detection hasn't loaded yet or finds no face
const DEFAULT_BOX: FaceBox = { x: 20, y: 5, w: 60, h: 38 };

// ── face-api.js loader — singleton so models load only once ─────────────────
let _faceApi: any = null;
let _faceApiPromise: Promise<any> | null = null;

async function getFaceApi(): Promise<any> {
  if (_faceApi) return _faceApi;
  if (_faceApiPromise) return _faceApiPromise;

  _faceApiPromise = (async () => {
    // Dynamic import — never runs server-side
    const faceapi = await import("face-api.js");
    // Load ONLY the tiny model (~190KB) from /public/models/
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
    _faceApi = faceapi;
    return faceapi;
  })();

  return _faceApiPromise;
}

// ── Detect face box on an img element ───────────────────────────────────────
async function detectFaceBox(imgEl: HTMLImageElement): Promise<FaceBox | null> {
  try {
    const faceapi = await getFaceApi();
    const opts = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.25,   // low threshold — better recall on profile pics
    });
    const result = await faceapi.detectSingleFace(imgEl, opts);
    if (!result) return null;

    const { box } = result;
    const iw = imgEl.naturalWidth  || imgEl.width  || 400;
    const ih = imgEl.naturalHeight || imgEl.height || 500;

    // Add padding around the detected box so forehead and chin are covered
    const padX = 0.28;
    const padY = 0.40;

    return {
      x: Math.max(0,        ((box.x / iw) - padX / 2) * 100),
      y: Math.max(0,        ((box.y / ih) - padY / 2) * 100),
      w: Math.min(100,      ((box.width  / iw) + padX) * 100),
      h: Math.min(100,      ((box.height / ih) + padY) * 100),
    };
  } catch {
    return null;
  }
}

// ── Main component ───────────────────────────────────────────────────────────

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
  const [box, setBox]           = useState<FaceBox>(DEFAULT_BOX);
  const [canvasReady, setReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  // Reset when src changes
  useEffect(() => {
    setReady(false);
    setBox(DEFAULT_BOX);
  }, [src]);

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

  // ── Draw smooth Gaussian blur inside an elliptical clip ─────────────────
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

    const ecx = ((b.x + b.w / 2) / 100) * cw;
    const ecy = ((b.y + b.h / 2) / 100) * ch;
    const erx = (b.w / 100) * cw / 2;
    const ery = (b.h / 100) * ch / 2;

    // Blur radius scales with canvas size — subtle on thumbnails, stronger on detail view
    const blurPx = Math.max(10, Math.min(22, cw * 0.07));

    // 1. Draw full sharp image
    ctx.drawImage(img, 0, 0, cw, ch);

    // 2. Clip to ellipse, draw blurred copy on top
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

  // ── Run ML detection then draw ───────────────────────────────────────────
  const detect = useCallback(async (img: HTMLImageElement) => {
    if (!blurred) return;

    // Draw with default box immediately so there's always SOMETHING blurred
    drawBlur(img, DEFAULT_BOX);

    // Run ML detection in background — updates blur if face is found
    const detectedBox = await detectFaceBox(img);
    if (detectedBox) {
      setBox(detectedBox);
      drawBlur(img, detectedBox);
    }
  }, [blurred, drawBlur]);

  // Re-draw when box changes (e.g. after async detection)
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !blurred) return;
    if (img.complete && img.naturalWidth > 0) drawBlur(img, box);
  }, [box, blurred, drawBlur]);

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
          if (blurred) detect(e.currentTarget as HTMLImageElement);
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