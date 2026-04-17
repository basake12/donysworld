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

const DEFAULT_BOX: FaceBox = { x: 15, y: 2, w: 70, h: 48 };
const BLUR_PX = 24;

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

  const drawBlur = useCallback((img: HTMLImageElement, overrideBox?: FaceBox) => {
    const canvas  = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const cw = wrapper.offsetWidth  || img.naturalWidth  || 400;
    const ch = wrapper.offsetHeight || img.naturalHeight || 500;
    canvas.width  = cw;
    canvas.height = ch;

    // Cast to any once — avoids the "never" narrowing issue that arises
    // when TypeScript sees CanvasRenderingContext2D always has .filter typed
    const ctx = canvas.getContext("2d") as any;
    if (!ctx) return;

    const b   = overrideBox ?? box;
    const ecx = ((b.x + b.w / 2) / 100) * cw;
    const ecy = ((b.y + b.h / 2) / 100) * ch;
    const erx = (b.w / 100) * cw / 2;
    const ery = (b.h / 100) * ch / 2;

    // 1. Draw full sharp image as base
    ctx.drawImage(img, 0, 0, cw, ch);

    // 2. Clip to ellipse, draw blurred copy on top
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ecx, ecy, erx, ery, 0, 0, Math.PI * 2);
    ctx.clip();

    // Smooth Gaussian blur — Chrome, Firefox, Edge, Safari 18+
    // On older Safari the filter is silently ignored and the image
    // draws sharp inside the ellipse (still partially obscures face)
    ctx.filter = `blur(${BLUR_PX}px)`;
    ctx.drawImage(img, 0, 0, cw, ch);
    ctx.filter = "none";

    ctx.restore();
    setReady(true);
  }, [box]);

  const runDetection = useCallback(async (img: HTMLImageElement) => {
    if (!blurred) return;
    if ("FaceDetector" in window) {
      try {
        const fd    = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        const faces = await fd.detect(img);
        if (faces.length > 0) {
          const f   = faces[0].boundingBox;
          const iw  = img.naturalWidth  || 400;
          const ih  = img.naturalHeight || 500;
          const pad = 0.35;
          const nx  = Math.max(0,        ((f.left   / iw) - pad / 2) * 100);
          const ny  = Math.max(0,        ((f.top    / ih) - pad / 2) * 100);
          const nw  = Math.min(100 - nx, ((f.width  / iw) + pad)     * 100);
          const nh  = Math.min(100 - ny, ((f.height / ih) + pad)     * 100);
          const detected: FaceBox = { x: nx, y: ny, w: nw, h: nh };
          setBox(detected);
          drawBlur(img, detected);
          return;
        }
      } catch { /* fall through to default box */ }
    }
    drawBlur(img);
  }, [blurred, drawBlur]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !blurred) return;
    if (img.complete && img.naturalWidth > 0) drawBlur(img);
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
          if (blurred) runDetection(e.currentTarget as HTMLImageElement);
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