"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface FaceBlurImageProps {
  /** Blurred URL stored in DB (always safe to show) */
  src: string;
  /** Original clear URL (from useRevealedImages hook) */
  revealedSrc?: string | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  revealed?: boolean;
  expiresAt?: string | null;
}

export function FaceBlurImage({
  src,
  revealedSrc,
  alt,
  fill = false,
  width,
  height,
  className = "",
  sizes,
  priority = false,
  revealed = false,
  expiresAt,
}: FaceBlurImageProps) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  // Countdown for the 24h reveal window
  useEffect(() => {
    if (!expiresAt || !revealed) {
      setTimeLeft(null);
      return;
    }

    const calc = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };

    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [expiresAt, revealed]);

  const showOriginal = revealed && !!revealedSrc;
  const activeSrc = showOriginal ? (revealedSrc as string) : src;

  return (
    /**
     * ✅ FIX: When fill={true}, <Image fill> sizes itself relative to its
     * immediate parent. The old code used `relative` here, which gave the
     * wrapper div zero height, causing every fill image to render at 0px tall.
     *
     * Fix: use `absolute inset-0` so the wrapper stretches to fill the
     * grandparent (which has the real aspect-ratio / height set by the caller),
     * giving <Image fill> a correctly-sized container to expand into.
     *
     * When fill={false} we still use `relative overflow-hidden` because the
     * image has explicit width/height and doesn't need to fill a parent.
     */
    <div
      className={
        fill
          ? `absolute inset-0 ${className}`
          : `relative overflow-hidden ${className}`
      }
    >
      <Image
        src={activeSrc}
        alt={alt}
        {...(fill ? { fill: true } : { width: width ?? 400, height: height ?? 500 })}
        sizes={sizes ?? "(max-width: 640px) 100vw, 400px"}
        className="object-cover object-top w-full h-full"
        priority={priority}
        // Skip Next.js image optimization for signed/original URLs
        unoptimized={showOriginal}
      />

      {/* Reveal countdown badge */}
      {revealed && timeLeft && (
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-xl bg-black/70 border border-gold/30 px-2 py-1 text-[10px] text-gold font-bold backdrop-blur-sm pointer-events-none z-10">
          👁 {timeLeft}
        </div>
      )}
    </div>
  );
}