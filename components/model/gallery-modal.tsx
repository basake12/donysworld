"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { ChevronLeft, ChevronRight, X, Images, Eye } from "lucide-react";
import { FaceBlurImage } from "./face-blur-image";
import { FACE_REVEAL_COST } from "@/lib/coins";
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
        <VisuallyHidden.Root>
          <DialogTitle>{modelName}&apos;s Gallery</DialogTitle>
        </VisuallyHidden.Root>

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
        <div className="bg-black" style={{ height: "460px", position: "relative" }}>
          <FaceBlurImage
            key={allImages[current]}
            src={allImages[current]}
            alt={modelName}
            fill
            blurred={isBlurred}
            sizes="(max-width: 640px) 100vw, 512px"
            priority
            expiresAt={expiresAt}
            allowReveal={allowReveal && isBlurred}
            onReveal={onReveal}
            revealing={revealing}
            cost={FACE_REVEAL_COST}
          />

          {/* Nav arrows */}
          {allImages.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 transition-all backdrop-blur-sm border border-white/10"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 transition-all backdrop-blur-sm border border-white/10"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Reveal info banner */}
          {isBlurred && !allowReveal && (
            <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-sm px-4 py-3 text-center">
              <p className="text-xs text-muted-foreground">
                This model has not enabled face reveal
              </p>
            </div>
          )}

          {!isBlurred && expiresAt && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 border border-gold/40 px-3 py-1 backdrop-blur-sm">
              <p className="text-xs text-gold font-medium flex items-center gap-1.5">
                <Eye className="h-3 w-3" />
                Face revealed — expires in 24h
              </p>
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {allImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-3 border-t border-border scrollbar-hide">
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