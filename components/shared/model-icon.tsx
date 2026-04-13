/**
 * ModelIcon — brand logo using your own image file.
 *
 * HOW TO CUSTOMISE:
 *   1. Put your image at:  public/icons/brand-logo.png
 *      (supports .png, .jpg, .webp, .svg)
 *   2. That's it — every place in the app that uses this component updates.
 *
 * The `className` prop controls size and color tint exactly like before:
 *   <ModelIcon className="h-5 w-5" />          — sized only
 *   <ModelIcon className="h-5 w-5 text-gold" /> — tinted gold via CSS filter
 */

import Image from "next/image";

// ── Change this path to match wherever you put your image ──
const BRAND_IMAGE_SRC = "/icons/brand-logo.png";

export function ModelIcon({ className }: { className?: string }) {
  // Parse out just the size classes so we can pass w/h to next/image
  // Falls back to 20×20 if no h-* / w-* class is present
  const sizeMap: Record<string, number> = {
    "h-3":    12, "w-3":    12,
    "h-3.5":  14, "w-3.5":  14,
    "h-4":    16, "w-4":    16,
    "h-4.5":  18, "w-4.5":  18,
    "h-5":    20, "w-5":    20,
    "h-6":    24, "w-6":    24,
    "h-7":    28, "w-7":    28,
    "h-8":    32, "w-8":    32,
    "h-9":    36, "w-9":    36,
    "h-10":   40, "w-10":   40,
  };

  const classes = (className ?? "").split(" ");
  const hClass  = classes.find((c) => c.startsWith("h-"));
  const wClass  = classes.find((c) => c.startsWith("w-"));
  const size    = (hClass && sizeMap[hClass]) ?? (wClass && sizeMap[wClass]) ?? 20;

  return (
    <Image
      src={BRAND_IMAGE_SRC}
      alt="Dony's World"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
      priority
    />
  );
}