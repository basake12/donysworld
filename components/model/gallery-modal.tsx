"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Images, Eye } from "lucide-react";
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

  const allImages = [
    profilePicture,
    ...gallery.map((g) => g.imageUrl),
  ];

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
      <DialogContent className="bg-card border-border max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Images className="h-4 w-4 text-gold" />
            <span className="font-semibold text-foreground text-sm">
              {modelName}&apos;s Gallery
            </span>
            <span className="text-xs text-muted-foreground">
              {current + 1} / {allImages.length}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Main image */}
        <div className="relative bg-black" style={{ height: "460px", position: "relative" }}>
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

          {/* Nav arrows */}
          {allImages.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 transition-all backdrop-blur-sm border border-white/10"
                style={{ zIndex: 20 }}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 transition-all backdrop-blur-sm border border-white/10"
                style={{ zIndex: 20 }}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {/* No reveal allowed notice */}
          {isBlurred && !allowReveal && (
            <div
              className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-sm px-4 py-3 text-center"
              style={{ zIndex: 20 }}
            >
              <p className="text-xs text-muted-foreground">
                This model has not enabled face reveal
              </p>
            </div>
          )}

          {/* Reveal CTA inside gallery */}
          {isBlurred && allowReveal && (
            <div
              className="absolute bottom-3 left-1/2 -translate-x-1/2"
              style={{ zIndex: 20 }}
            >
              <button
                onClick={onReveal}
                disabled={revealing}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/80 border border-gold/60 text-gold hover:bg-black/95 transition-all backdrop-blur-sm disabled:opacity-50"
              >
                <Eye className="h-4 w-4" />
                <span className="text-xs font-bold">
                  {revealing ? "Revealing..." : "Unlock Face · 1,000 DC · 24H access"}
                </span>
              </button>
            </div>
          )}

          {/* Already revealed */}
          {!isBlurred && expiresAt && (
            <div
              className="absolute bottom-3 left-1/2 -translate-x-1/2"
              style={{ zIndex: 20 }}
            >
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 border border-emerald-500/40 backdrop-blur-sm">
                <Eye className="h-3.5 w-3.5 text-emerald-400" />
                <p className="text-xs text-emerald-400 font-medium">
                  Face revealed — expires in 24h
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {allImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-3 border-t border-border">
            {allImages.map((img, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={cn(
                  "relative shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 transition-all",
                  i === current
                    ? "border-gold shadow-md shadow-gold/20"
                    : "border-border opacity-60 hover:opacity-100"
                )}
              >
                <FaceBlurImage
                  src={img}
                  alt={`Photo ${i + 1}`}
                  fill
                  blurred={isBlurred && i === 0}
                  sizes="56px"
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}