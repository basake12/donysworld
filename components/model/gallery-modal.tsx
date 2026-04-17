"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X, Eye, Images, Clock } from "lucide-react";
import { FaceBlurImage } from "./face-blur-image";
import { cn } from "@/lib/utils";

interface GalleryItem {
  id: string;
  imageUrl: string;
  order: number;
}

interface GalleryModalProps {
  open: boolean;
  onClose: () => void;
  modelName: string;
  profilePicture: string;
  gallery: GalleryItem[];
  isBlurred: boolean;
  allowReveal: boolean;
  onReveal: () => Promise<void>;
  revealing: boolean;
  expiresAt: string | null;
}

export function GalleryModal({
  open,
  onClose,
  modelName,
  profilePicture,
  gallery,
  isBlurred,
  allowReveal,
  onReveal,
  revealing,
  expiresAt,
}: GalleryModalProps) {
  const [current, setCurrent] = useState(0);

  const allImages = [profilePicture, ...gallery.map((g) => g.imageUrl)];

  function prev() {
    setCurrent((s) => (s === 0 ? allImages.length - 1 : s - 1));
  }

  function next() {
    setCurrent((s) => (s === allImages.length - 1 ? 0 : s + 1));
  }

  function handleClose() {
    setCurrent(0);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-black border-white/10 max-w-lg p-0 overflow-hidden rounded-2xl">

        {/* ── HEADER ──────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-black/80 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15 border border-gold/20">
              <Images className="h-3.5 w-3.5 text-gold" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">{modelName}</p>
              <p className="text-[10px] text-white/40 mt-0.5">
                {current + 1} of {allImages.length} photos
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/8 text-white/60 hover:text-white hover:bg-white/15 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── MAIN IMAGE — consistent 3:4 aspect ratio ── */}
        <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: "3/4", maxHeight: "65vh" }}>
          <FaceBlurImage
            key={allImages[current]}
            src={allImages[current]}
            alt={modelName}
            fill
            blurred={isBlurred}
            sizes="(max-width: 640px) 100vw, 512px"
            priority
            expiresAt={expiresAt}
          />

          {/* Side gradients */}
          <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/40 to-transparent pointer-events-none" />

          {/* ── Navigation arrows ── */}
          {allImages.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-2xl bg-black/60 text-white hover:bg-black/90 border border-white/10 backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-2xl bg-black/60 text-white hover:bg-black/90 border border-white/10 backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {/* ── Dot indicators ── */}
          {allImages.length > 1 && allImages.length <= 8 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-1">
              {allImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={cn(
                    "rounded-full transition-all",
                    i === current ? "w-5 h-1.5 bg-gold" : "w-1.5 h-1.5 bg-white/30"
                  )}
                />
              ))}
            </div>
          )}

          {/* ── No reveal notice ── */}
          {isBlurred && !allowReveal && (
            <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/90 to-transparent pt-8 pb-4 px-4 text-center">
              <p className="text-xs text-white/50">Face reveal not enabled by this model</p>
            </div>
          )}

          {/* ── Reveal CTA ── */}
          {isBlurred && allowReveal && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
              <button
                onClick={onReveal}
                disabled={revealing}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-black/85 border border-gold/50 text-gold hover:bg-black hover:border-gold transition-all backdrop-blur-md disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-black/50"
              >
                <Eye className="h-4 w-4" />
                <span className="text-xs font-black tracking-wide">
                  {revealing ? "Revealing..." : "Unlock Face · 1,000 DC · 24H"}
                </span>
                <div className="flex items-center gap-1 border-l border-gold/30 pl-2.5">
                  <Clock className="h-3 w-3 text-gold/60" />
                  <span className="text-[10px] text-gold/70 font-bold">24H</span>
                </div>
              </button>
            </div>
          )}

          {/* ── Revealed status ── */}
          {!isBlurred && expiresAt && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 backdrop-blur-md">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <Eye className="h-3.5 w-3.5 text-emerald-400" />
                <p className="text-xs text-emerald-400 font-bold">Face Unlocked · 24h access</p>
              </div>
            </div>
          )}
        </div>

        {/* ── THUMBNAIL STRIP — all blurred when isBlurred ── */}
        {allImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-3 border-t border-white/8 bg-black/80 scrollbar-hide">
            {allImages.map((img, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={cn(
                  "relative shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200",
                  "h-14 w-10",                        // fixed 5:7 ratio — consistent regardless of source
                  i === current
                    ? "border-gold shadow-md shadow-gold/30 scale-105"
                    : "border-transparent opacity-50 hover:opacity-80 hover:border-white/20"
                )}
              >
                {/* ALL thumbnails use FaceBlurImage so blur applies everywhere */}
                <FaceBlurImage
                  src={img}
                  alt={`Photo ${i + 1}`}
                  fill
                  blurred={isBlurred}
                  sizes="40px"
                />
                {i === 0 && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 py-0.5">
                    <span className="text-[7px] font-black text-gold/90 block text-center tracking-wider">MAIN</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}