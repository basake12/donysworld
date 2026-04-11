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
  /** Required when fill={false}. Ignored when fill={true}. */
  width?: number;
  /** Required when fill={false}. Ignored when fill={true}. */
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  expiresAt?: string | null;
  cost?: number;
}

// Default — upper-center portrait region
const DEFAULT_BOX: FaceBox = { x: 22, y: 3, w: 56, h: 42 };

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

  // ── Expiry countdown ─────────────────────────
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

  // ── Draw pixelated mosaic on canvas ──────────
  const drawMosaic = useCallback((img: HTMLImageElement) => {
    const canvas  = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const cw = wrapper.offsetWidth  || img.naturalWidth  || 400;
    const ch = wrapper.offsetHeight || img.naturalHeight || 500;

    canvas.width  = cw;
    canvas.height = ch;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fx = Math.round((box.x / 100) * cw);
    const fy = Math.round((box.y / 100) * ch);
    const fw = Math.round((box.w / 100) * cw);
    const fh = Math.round((box.h / 100) * ch);

    const PIXEL = 14;
    const sw    = Math.max(1, Math.round(fw / PIXEL));
    const sh    = Math.max(1, Math.round(fh / PIXEL));

    ctx.drawImage(img, 0, 0, cw, ch);
    ctx.drawImage(img, fx, fy, fw, fh, fx, fy, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, fx, fy, sw, sh, fx, fy, fw, fh);
    ctx.imageSmoothingEnabled = true;

    setReady(true);
  }, [box]);

  // ── Face detection (Chrome Android / Edge) ────
  const runDetection = useCallback(async (img: HTMLImageElement) => {
    if (!blurred || !("FaceDetector" in window)) return;
    try {
      const fd    = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await fd.detect(img);
      if (faces.length > 0) {
        const f   = faces[0].boundingBox;
        const iw  = img.naturalWidth  || 400;
        const ih  = img.naturalHeight || 500;
        const pad = 0.28;
        const nx  = Math.max(0,   ((f.left  / iw) - pad / 2) * 100);
        const ny  = Math.max(0,   ((f.top   / ih) - pad / 2) * 100);
        const nw  = Math.min(100 - nx, ((f.width  / iw) + pad) * 100);
        const nh  = Math.min(100 - ny, ((f.height / ih) + pad) * 100);
        setBox({ x: nx, y: ny, w: nw, h: nh });
        return;
      }
    } catch { /* keep default */ }
    drawMosaic(img);
  }, [blurred, drawMosaic]);

  // Re-draw whenever box updates
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !blurred) return;
    if (img.complete && img.naturalWidth > 0) drawMosaic(img);
  }, [box, blurred, drawMosaic]);

  const wrapperCls = fill
    ? `absolute inset-0 overflow-hidden ${className}`
    : `relative overflow-hidden ${className}`;

  return (
    <div ref={wrapperRef} className={wrapperCls}>

      {/* ── Base image ─────────────────────── */}
      <Image
        ref={imgRef as any}
        src={src}
        alt={alt}
        // In fill mode Next.js manages sizing via the wrapper; in non-fill
        // mode explicit width/height are mandatory — fall back to safe defaults
        // so the component never crashes even if the caller omits them.
        {...(fill
          ? { fill: true }
          : { width: width ?? 400, height: height ?? 500 }
        )}
        sizes={sizes ?? "(max-width: 640px) 100vw, 400px"}
        className="object-cover object-top"
        priority={priority}
        crossOrigin="anonymous"
        onLoad={(e) => {
          if (blurred) {
            drawMosaic(e.currentTarget as HTMLImageElement);
            runDetection(e.currentTarget as HTMLImageElement);
          }
        }}
      />

      {/* ── Mosaic canvas (blurred only) ───── */}
      {blurred && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            opacity: canvasReady ? 1 : 0,
            transition: "opacity 0.15s ease",
          }}
        />
      )}

      {/* ── Reveal expiry badge ─────────────── */}
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