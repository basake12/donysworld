"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * FaceBlurImage
 *
 * Pure presentational component. Renders `src` (the blurred public URL) by
 * default. When `revealed` is true AND `revealedSrc` is provided, renders
 * `revealedSrc` instead.
 *
 * The parent is responsible for obtaining `revealedSrc` — typically via the
 * `useRevealedImages` hook, which batches one fetch per model. This component
 * does no fetching, keeps no URL state, and cannot leak an original URL that
 * the parent hasn't already chosen to show.
 *
 * Countdown badge is driven entirely by `expiresAt` + `revealed`.
 */
interface FaceBlurImageProps {
  /** The blurred public URL — always safe to render. */
  src: string;
  /**
   * The pre-resolved signed URL (or legacy public URL) for the original.
   * Provide via useRevealedImages(). Null/undefined → stay blurred.
   */
  revealedSrc?: string | null;
  alt: string;
  /** When true and revealedSrc is set, render the original. */
  revealed?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** ISO string — the 24h reveal expiry. Drives the countdown badge only. */
  expiresAt?: string | null;
}

export function FaceBlurImage({
  src,
  revealedSrc,
  alt,
  revealed = false,
  fill = false,
  width,
  height,
  className = "",
  sizes,
  priority = false,
  expiresAt,
}: FaceBlurImageProps) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  // Countdown badge — the 24h reveal window, not the signed-URL TTL.
  useEffect(() => {
    if (!expiresAt || !revealed) {
      setTimeLeft(null);
      return;
    }

    function calc() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m`);
    }

    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [expiresAt, revealed]);

  const showOriginal = revealed && !!revealedSrc;
  const activeSrc = showOriginal ? (revealedSrc as string) : src;

  const wrapperCls = fill
    ? `absolute inset-0 overflow-hidden ${className}`
    : `relative overflow-hidden ${className}`;

  return (
    <div className={wrapperCls}>
      <Image
        src={activeSrc}
        alt={alt}
        {...(fill ? { fill: true } : { width: width ?? 400, height: height ?? 500 })}
        sizes={sizes ?? "(max-width: 640px) 100vw, 400px"}
        className="object-cover object-top w-full h-full"
        priority={priority}
        // Signed URLs rotate every ~60s — skip Next's /_next/image proxy so
        // the fresh URL is actually used instead of being cached under the
        // now-dead previous URL.
        unoptimized={showOriginal}
      />

      {revealed && timeLeft && (
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