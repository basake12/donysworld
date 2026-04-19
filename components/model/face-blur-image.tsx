"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface FaceBlurImageProps {
  /** Pre-blurred version — shown to all clients by default. */
  src: string;
  /** Original unblurred version — only passed when client has an active reveal. */
  originalSrc?: string | null;
  alt: string;
  /** When true and originalSrc is present, show the original. */
  revealed?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** ISO string — when set and revealed, shows a countdown badge. */
  expiresAt?: string | null;
}

export function FaceBlurImage({
  src,
  originalSrc,
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

  useEffect(() => {
    if (!expiresAt || !revealed) return;
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
  }, [expiresAt, revealed]);

  // Show original only when explicitly revealed and original URL is available.
  const activeSrc = revealed && originalSrc ? originalSrc : src;

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