/**
 * ModelIcon — brand logo using your own image file.
 *
 * HOW TO CUSTOMISE:
 *   1. Put your image at:  public/icons/brand-logo.png
 *   2. That's it. Every place that used Crown now shows your image.
 *
 * Size is controlled by className exactly like before:
 *   <ModelIcon className="h-5 w-5" />
 *   <ModelIcon className="h-9 w-9" />
 */

import Image from "next/image";

const BRAND_IMAGE_SRC = "/icons/brand-logo.png";

export function ModelIcon({ className }: { className?: string }) {
  return (
    <Image
      src={BRAND_IMAGE_SRC}
      alt="Dony's World"
      width={128}
      height={128}
      className={className}
      style={{ objectFit: "contain" }}
      priority
    />
  );
}