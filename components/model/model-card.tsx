"use client";

import Link from "next/link";
import { MapPin, ShieldCheck, Clock, UserCheck } from "lucide-react";
import { FaceBlurImage } from "./face-blur-image";
import { cn } from "@/lib/utils";

interface ModelCharge {
  meetType: "SHORT" | "OVERNIGHT" | "WEEKEND";
  minCoins: number;
  maxCoins: number;
}

interface GalleryItem {
  id: string;
  imageUrl: string;
  originalImageUrl?: string | null;
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
      originalPictureUrl?: string | null;
      allowFaceReveal: boolean;
      isFaceBlurred: boolean;
      isAvailable: boolean;
      charges: ModelCharge[];
      gallery: GalleryItem[];
    };
  };
  revealInfo: RevealInfo;
  onMakeOffer: (modelId: string, profileId: string) => void;
  onRevealFace?: (profileId: string) => Promise<void>;
}

const BODY_COLORS: Record<string, string> = {
  SLIM:      "text-blue-400 bg-blue-400/10 border-blue-400/20",
  AVERAGE:   "text-violet-400 bg-violet-400/10 border-violet-400/20",
  ATHLETIC:  "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  CURVY:     "text-rose-400 bg-rose-400/10 border-rose-400/20",
  PLUS_SIZE: "text-orange-400 bg-orange-400/10 border-orange-400/20",
};

const BODY_LABEL: Record<string, string> = {
  SLIM: "Slim", AVERAGE: "Average", ATHLETIC: "Athletic",
  CURVY: "Curvy", PLUS_SIZE: "Plus Size",
};

export function ModelCard({ model, revealInfo }: ModelCardProps) {
  const p           = model.modelProfile;
  const displayName = model.nickname || "Model";
  const galleryCount = p.gallery.length;
  const detailHref  = `/client/models/${model.id}`;

  return (
    <div className="group relative rounded-2xl border border-border bg-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/70 hover:border-gold/30 flex flex-col cursor-pointer">

      <Link href={detailHref} className="relative aspect-[3/4] bg-secondary overflow-hidden flex-shrink-0 block">
        <FaceBlurImage
          src={p.profilePictureUrl}
          originalSrc={p.originalPictureUrl}
          alt={displayName}
          fill
          revealed={revealInfo.revealed}
          sizes="(max-width: 640px) 50vw, 320px"
          priority
          expiresAt={revealInfo.expiresAt}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-full bg-gold/90 backdrop-blur-sm px-2 py-0.5 shadow-lg">
            <ShieldCheck className="h-2.5 w-2.5 text-black" />
            <span className="text-[9px] font-black text-black tracking-wider">VERIFIED</span>
          </div>
          {p.isAvailable && (
            <span className="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.7)] animate-pulse" />
          )}
        </div>

        {!revealInfo.expiresAt && galleryCount > 0 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-1 rounded-full bg-black/65 border border-white/15 backdrop-blur-sm px-2.5 py-0.5">
              <span className="text-[9px] font-semibold text-white/90">{galleryCount + 1} photos</span>
            </div>
          </div>
        )}

        {revealInfo.revealed && revealInfo.expiresAt && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-1 rounded-full bg-emerald-500/90 backdrop-blur-sm px-2.5 py-0.5">
              <Clock className="h-2.5 w-2.5 text-white" />
              <span className="text-[9px] font-bold text-white">Unlocked</span>
            </div>
          </div>
        )}
      </Link>

      <div className="flex flex-col flex-1 p-3 gap-2">
        <div>
          <h3 className="font-black text-foreground text-sm leading-tight tracking-wide truncate">
            {displayName}
          </h3>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <span className="text-[11px] text-muted-foreground font-medium">{p.age} yrs</span>
            <span className="text-[11px] text-muted-foreground/40">·</span>
            <MapPin className="h-2.5 w-2.5 text-gold flex-shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">{p.city}, {p.state}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {p.bodyType && (
            <span className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
              BODY_COLORS[p.bodyType] ?? "text-muted-foreground bg-secondary border-border"
            )}>
              {BODY_LABEL[p.bodyType]}
            </span>
          )}
          {p.height && (
            <span className="text-[10px] text-muted-foreground bg-secondary border border-border rounded-full px-2 py-0.5">
              {p.height}
            </span>
          )}
        </div>

        <Link
          href={detailHref}
          className={cn(
            "mt-auto w-full h-9 font-black rounded-xl text-xs",
            "bg-gold-gradient text-black",
            "flex items-center justify-center gap-1.5",
            "transition-all duration-200 hover:opacity-90 active:scale-[0.98]",
          )}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Connect
        </Link>
      </div>
    </div>
  );
}