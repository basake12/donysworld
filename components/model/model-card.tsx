"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin, Ruler, User, Coins,
  ChevronLeft, ChevronRight, Images, Eye, Clock,
} from "lucide-react";
import { formatCoins, FACE_REVEAL_COST } from "@/lib/coins";
import { FaceBlurImage } from "./face-blur-image";
import { GalleryModal } from "./gallery-modal";
import { cn } from "@/lib/utils";

interface ModelCharge {
  meetType: "SHORT" | "OVERNIGHT" | "WEEKEND";
  minCoins: number;
  maxCoins: number;
}

interface GalleryItem {
  id: string;
  imageUrl: string;
  order: number;
}

interface RevealInfo {
  revealed: boolean;
  expiresAt: string | null;
}

interface ModelCardProps {
  model: {
    id: string;
    fullName: string;
    nickname: string | null;
    modelProfile: {
      id: string;
      age: number;
      height: string;
      city: string;
      state: string;
      bodyType: string;
      complexion: string;
      about: string;
      profilePictureUrl: string;
      allowFaceReveal: boolean;
      isFaceBlurred: boolean;
      charges: ModelCharge[];
      gallery: GalleryItem[];
    };
  };
  revealInfo: RevealInfo;
  onMakeOffer: (modelId: string, profileId: string) => void;
  onRevealFace: (profileId: string) => Promise<void>;
}

const MEET_LABEL: Record<string, string> = {
  SHORT: "Short Meet",
  OVERNIGHT: "Overnight",
  WEEKEND: "Weekend",
};

const BODY_LABEL: Record<string, string> = {
  SLIM: "Slim", AVERAGE: "Average", ATHLETIC: "Athletic",
  CURVY: "Curvy", PLUS_SIZE: "Plus Size",
};

const COMPLEXION_LABEL: Record<string, string> = {
  FAIR: "Fair", LIGHT: "Light", MEDIUM: "Medium",
  OLIVE: "Olive", TAN: "Tan", DARK: "Dark",
};

export function ModelCard({
  model, revealInfo, onMakeOffer, onRevealFace,
}: ModelCardProps) {
  const [revealing, setRevealing] = useState(false);
  const [slide, setSlide] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const p = model.modelProfile;
  const isBlurred = p.isFaceBlurred && !revealInfo.revealed;
  const displayName = model.nickname || "Model";

  const allImages = [
    p.profilePictureUrl,
    ...p.gallery.map((g) => g.imageUrl),
  ];

  const lowestCharge = p.charges.reduce(
    (min, c) => (c.maxCoins < min ? c.maxCoins : min), Infinity
  );

  function prev(e: React.MouseEvent) {
    e.stopPropagation();
    setSlide((s) => (s === 0 ? allImages.length - 1 : s - 1));
  }

  function next(e: React.MouseEvent) {
    e.stopPropagation();
    setSlide((s) => (s === allImages.length - 1 ? 0 : s + 1));
  }

  async function handleReveal() {
    setRevealing(true);
    await onRevealFace(p.id);
    setRevealing(false);
  }

  return (
    <>
      <div className="group rounded-2xl border border-border bg-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 hover:border-gold/30 flex flex-col">

        {/* ── IMAGE CAROUSEL ───────────────────── */}
        <div className="relative h-72 bg-secondary overflow-hidden">
          {/* Circle blur only — no button inside image */}
          <FaceBlurImage
            key={allImages[slide]}
            src={allImages[slide]}
            alt={displayName}
            fill
            blurred={isBlurred}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
            priority={slide === 0}
            expiresAt={revealInfo.expiresAt}
            cost={FACE_REVEAL_COST}
          />

          {/* Dark gradient */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

          {/* Location */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-sm border border-white/10">
            <MapPin className="h-3 w-3 text-gold" />
            <span className="text-xs font-medium text-white">
              {p.city}, {p.state}
            </span>
          </div>

          {/* Slide counter */}
          {allImages.length > 1 && (
            <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm border border-white/10">
              <span className="text-[10px] text-white/80">
                {slide + 1}/{allImages.length}
              </span>
            </div>
          )}

          {/* Carousel arrows */}
          {allImages.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setSlide(i); }}
                    className={cn(
                      "rounded-full transition-all",
                      i === slide ? "w-4 h-1.5 bg-gold" : "w-1.5 h-1.5 bg-white/40"
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── INFO ──────────────────────────────── */}
        <div className="flex flex-col flex-1 p-4 space-y-3">

          {/* Name + badges */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-foreground text-lg leading-tight">
                {displayName}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {p.age} yrs
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Ruler className="h-3 w-3" />
                  {p.height}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1 items-end shrink-0">
              <Badge variant="outline" className="text-[10px] px-2 py-0 border-gold/20 text-gold">
                {BODY_LABEL[p.bodyType]}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-2 py-0 border-border text-muted-foreground">
                {COMPLEXION_LABEL[p.complexion]}
              </Badge>
            </div>
          </div>

          {/* About */}
          {p.about && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {p.about}
            </p>
          )}

          {/* Charges */}
          {p.charges.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {(["SHORT", "OVERNIGHT", "WEEKEND"] as const).map((type) => {
                const charge = p.charges.find((c) => c.meetType === type);
                if (!charge) return null;
                return (
                  <div
                    key={type}
                    className="flex flex-col items-center rounded-xl bg-secondary border border-border px-2 py-2 gap-0.5"
                  >
                    <span className="text-[9px] text-muted-foreground font-medium text-center leading-tight">
                      {MEET_LABEL[type]}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Coins className="h-2.5 w-2.5 text-gold" />
                      <span className="text-[10px] font-bold text-gold">
                        {charge.maxCoins.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── CTA BUTTONS ─────────────────────── */}
          <div className="mt-auto pt-1 space-y-2">

            {/* REVEAL FACE button — only when blurred + model allows */}
            {isBlurred && p.allowFaceReveal && (
              <button
                onClick={handleReveal}
                disabled={revealing}
                className="w-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="relative flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gold/40 bg-gradient-to-r from-amber-950/80 via-yellow-900/50 to-amber-950/80 hover:border-gold/80 hover:from-amber-900/80 hover:via-yellow-800/60 hover:to-amber-900/80 transition-all duration-200">
                  {/* Eye icon circle */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/20 border border-gold/50">
                    {revealing ? (
                      <span className="text-gold text-xs animate-pulse font-bold">···</span>
                    ) : (
                      <Eye className="h-4 w-4 text-gold" />
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-bold text-gold leading-tight">
                      {revealing ? "Revealing face..." : "Unlock Face Reveal"}
                    </p>
                    <p className="text-[10px] text-amber-400/80 leading-tight">
                      1,000 DC · Valid for 24 hours only
                    </p>
                  </div>

                  {/* 24H badge */}
                  {!revealing && (
                    <div className="flex shrink-0 items-center gap-1 rounded-full bg-gold/15 border border-gold/30 px-2 py-0.5">
                      <Clock className="h-2.5 w-2.5 text-gold/70" />
                      <span className="text-[9px] text-gold font-bold">24H</span>
                    </div>
                  )}
                </div>
              </button>
            )}

            {/* Face already revealed — green status bar */}
            {!isBlurred && revealInfo.expiresAt && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  <Eye className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-emerald-400 leading-tight">
                    Face Unlocked
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Access expires in 24 hours
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5">
                  <Clock className="h-2.5 w-2.5 text-emerald-400/70" />
                  <span className="text-[9px] text-emerald-400 font-bold">24H</span>
                </div>
              </div>
            )}

            {/* Gallery button */}
            {p.gallery.length > 0 && (
              <Button
                onClick={() => setGalleryOpen(true)}
                variant="outline"
                className="w-full h-9 border-gold/30 text-gold hover:bg-gold/10 rounded-xl text-sm gap-2"
              >
                <Images className="h-4 w-4" />
                View Gallery ({p.gallery.length} photo{p.gallery.length !== 1 ? "s" : ""})
              </Button>
            )}

            {/* Make Offer */}
            <Button
              onClick={() => onMakeOffer(model.id, p.id)}
              disabled={p.charges.length === 0}
              className="w-full h-10 bg-gold-gradient text-primary-foreground font-bold hover:opacity-90 disabled:opacity-40 rounded-xl text-sm"
            >
              {p.charges.length === 0
                ? "No charges set"
                : `Make Offer · from ${lowestCharge === Infinity ? 0 : lowestCharge.toLocaleString()} DC`}
            </Button>

          </div>
        </div>
      </div>

      {/* Gallery modal */}
      <GalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        modelName={displayName}
        profilePicture={p.profilePictureUrl}
        gallery={p.gallery}
        isBlurred={isBlurred}
        allowReveal={p.allowFaceReveal}
        onReveal={handleReveal}
        revealing={revealing}
        expiresAt={revealInfo.expiresAt}
      />
    </>
  );
}