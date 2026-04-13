/**
 * ModelIcon — brand silhouette used everywhere Crown used to appear.
 * Drop-in replacement: accepts the same `className` prop.
 *
 * Usage:
 *   import { ModelIcon } from "@/components/shared/model-icon";
 *   <ModelIcon className="h-5 w-5 text-gold" />
 */
export function ModelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 130"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Head */}
      <ellipse cx="40" cy="13" rx="11" ry="11.5" />
      {/* Neck */}
      <path d="M35.5 24 Q37 28 40 28.5 Q43 28 44.5 24 L44.5 31 Q42.5 32.5 40 32.5 Q37.5 32.5 35.5 31 Z" />
      {/* Shoulders — gentle feminine slope */}
      <path d="M10 34 Q18 30 40 29.5 Q62 30 70 34 L66 58 Q54 54.5 40 54.5 Q26 54.5 14 58 Z" />
      {/* Waist — narrow pinch */}
      <path d="M14 58 Q26 54.5 40 54.5 Q54 54.5 66 58 L67.5 72 Q55 68.5 40 68.5 Q25 68.5 12.5 72 Z" />
      {/* Hips — wide & curvy */}
      <path d="M12.5 72 Q25 68.5 40 68.5 Q55 68.5 67.5 72 L65 95 Q52 103 40 103 Q28 103 15 95 Z" />
      {/* Left leg */}
      <path d="M15 95 Q28 103 40 103 L36.5 128 L26 128 Z" />
      {/* Right leg */}
      <path d="M65 95 Q52 103 40 103 L43.5 128 L54 128 Z" />
    </svg>
  );
}