"use client";

import { useEffect, useState } from "react";
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
  faceBox?: FaceBox | null;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  expiresAt?: string | null;
  cost?: number;
}

// Fallback box — used when faceBox is null
const DEFAULT_BOX: FaceBox = { x: 28, y: 3, w: 44, h: 28 };

export function FaceBlurImage({
  src,
  alt,
  blurred,
  faceBox,
  fill = false,
  width,
  height,
  className = "",
  sizes,
  priority = false,
  expiresAt,
}: FaceBlurImageProps) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

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

  const box = faceBox ?? DEFAULT_BOX;

  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rx = box.w / 2;
  const ry = box.h / 2;
  const clipPath = `ellipse(${rx}% ${ry}% at ${cx}% ${cy}%)`;

  const wrapperCls = fill
    ? `absolute inset-0 overflow-hidden ${className}`
    : `relative overflow-hidden ${className}`;

  return (
    <div className={wrapperCls}>
      {/* Sharp base image */}
      <Image
        src={src}
        alt={alt}
        {...(fill ? { fill: true } : { width: width ?? 400, height: height ?? 500 })}
        sizes={sizes ?? "(max-width: 640px) 100vw, 400px"}
        className="object-cover object-top w-full h-full"
        priority={priority}
      />

      {/*
        Blurred face overlay — second img copy with CSS filter:blur()
        clipped to an ellipse over the face.

        WHY NOT backdrop-filter:
        - backdrop-filter + clip-path breaks inside overflow:hidden on Android Chrome
        - backdrop-filter creates a GPU compositing layer per card → slow on mobile

        WHY THIS WORKS:
        - filter:blur() on a regular img element works on ALL browsers
        - No compositing layer, no GPU overhead
        - scale(1.05) prevents the blur from fading out at ellipse edges
      */}
      {blurred && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ clipPath, WebkitClipPath: clipPath }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-top"
            style={{
              filter: "blur(18px)",
              transform: "scale(1.05)",
              transformOrigin: "center",
            }}
          />
        </div>
      )}

      {/* Expiry badge */}
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