"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OfferModal } from "@/components/client/offer-modal";
import { FaceBlurImage } from "@/components/model/face-blur-image";
import { ModelCard } from "@/components/model/model-card";
import { useToast } from "@/components/ui/use-toast";
import {
  MapPin, Ruler, Coins, Eye, Clock, ShieldCheck,
  ChevronLeft, Images, User, Sparkles, Lock, ZoomIn, X,
} from "lucide-react";
import { formatCoins, FACE_REVEAL_COST, coinsToNairaFormatted } from "@/lib/coins";
import { cn } from "@/lib/utils";

// ─── TYPES ──────────────────────────────────────

interface ModelCharge {
  meetType: "SHORT" | "OVERNIGHT" | "WEEKEND";
  minCoins: number;
  maxCoins: number;
}

interface GalleryItem { id: string; imageUrl: string; order: number; }

interface ModelDetailClientProps {
  model: {
    id: string;
    fullName: string;
    nickname: string | null;
    modelProfile: {
      id: string; age: number; height: string; city: string; state: string;
      bodyType: string; complexion: string; about: string;
      profilePictureUrl: string; allowFaceReveal: boolean; isFaceBlurred: boolean;
      charges: ModelCharge[]; gallery: GalleryItem[];
    };
  };
  walletBalance: number;
  clientProfileId: string;
  revealInfo: { revealed: boolean; expiresAt: string | null };
  otherModels: Array<{
    id: string; fullName: string; nickname: string | null;
    modelProfile: {
      id: string; age: number; height: string; city: string; state: string;
      bodyType: string; complexion: string; about: string;
      profilePictureUrl: string; allowFaceReveal: boolean; isFaceBlurred: boolean;
      charges: ModelCharge[]; gallery: GalleryItem[];
    };
  }>;
  otherRevealMap: Record<string, string>;
}

// ─── CONSTANTS ──────────────────────────────────

const MEET_CONFIG: Record<string, { label: string; gradient: string; border: string; text: string; dot: string }> = {
  SHORT:     { label: "Short Meet",  gradient: "from-blue-500/15 to-blue-600/5",   border: "border-blue-500/25",   text: "text-blue-400",   dot: "bg-blue-400" },
  OVERNIGHT: { label: "Overnight",   gradient: "from-violet-500/15 to-violet-600/5", border: "border-violet-500/25", text: "text-violet-400", dot: "bg-violet-400" },
  WEEKEND:   { label: "Weekend",     gradient: "from-rose-500/15 to-rose-600/5",   border: "border-rose-500/25",   text: "text-rose-400",   dot: "bg-rose-400" },
};

const BODY_LABEL: Record<string, string> = {
  SLIM: "Slim", AVERAGE: "Average", ATHLETIC: "Athletic", CURVY: "Curvy", PLUS_SIZE: "Plus Size",
};

const BODY_COLOR: Record<string, string> = {
  SLIM:      "bg-blue-400/10 border-blue-400/25 text-blue-400",
  AVERAGE:   "bg-violet-400/10 border-violet-400/25 text-violet-400",
  ATHLETIC:  "bg-emerald-400/10 border-emerald-400/25 text-emerald-400",
  CURVY:     "bg-rose-400/10 border-rose-400/25 text-rose-400",
  PLUS_SIZE: "bg-orange-400/10 border-orange-400/25 text-orange-400",
};

const COMPLEXION_LABEL: Record<string, string> = {
  FAIR: "Fair", LIGHT: "Light", MEDIUM: "Medium", OLIVE: "Olive", TAN: "Tan", DARK: "Dark",
};

// ─── LIGHTBOX ────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/98 backdrop-blur-md animate-fade-in"
      onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all">
        <X className="h-5 w-5" />
      </button>
      <div className="relative w-full max-w-lg mx-4 max-h-[88vh] aspect-[3/4]" onClick={(e) => e.stopPropagation()}>
        <Image src={src} alt="Gallery photo" fill className="object-contain rounded-2xl" sizes="640px" />
      </div>
      <p className="absolute bottom-5 text-[10px] text-white/25 tracking-widest">TAP ANYWHERE TO CLOSE</p>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────

export function ModelDetailClient({
  model, walletBalance, clientProfileId, revealInfo: initialRevealInfo,
  otherModels, otherRevealMap,
}: ModelDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const p = model.modelProfile;
  const displayName = model.nickname || "Model";

  const [revealInfo, setRevealInfo]   = useState(initialRevealInfo);
  const [revealing, setRevealing]     = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [offerOpen, setOfferOpen]     = useState(false);

  const isBlurred = p.isFaceBlurred && !revealInfo.revealed;
  const allImages = [p.profilePictureUrl, ...p.gallery.map((g) => g.imageUrl)];
  const lowestMin = p.charges.length > 0 ? Math.min(...p.charges.map((c) => c.minCoins)) : 0;

  async function handleReveal() {
    setRevealing(true);
    try {
      const res  = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelProfileId: p.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reveal failed");
      setRevealInfo({ revealed: true, expiresAt: data.expiresAt });
      toast({ title: "Face revealed! 👁️", description: "Access valid for 24 hours." });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Reveal failed", description: err.message, variant: "destructive" });
    } finally {
      setRevealing(false);
    }
  }

  // Dummy onMakeOffer for other models — opens modal
  const [otherOfferModal, setOtherOfferModal] = useState<{
    open: boolean;
    model: { id: string; fullName: string; profileId: string; charges: ModelCharge[] } | null;
  }>({ open: false, model: null });

  function handleOtherMakeOffer(modelId: string, profileId: string) {
    const m = otherModels.find((x) => x.id === modelId);
    if (!m?.modelProfile) return;
    setOtherOfferModal({
      open: true,
      model: { id: modelId, fullName: m.nickname || m.fullName, profileId, charges: m.modelProfile.charges },
    });
  }

  return (
    <>
      {lightboxImg && <Lightbox src={lightboxImg} onClose={() => setLightboxImg(null)} />}

      <div className="min-h-screen bg-background pb-32">

        {/* ── GALLERY STRIP AT TOP ─────────────── */}
        <div className="bg-black">
          {/* Back button over gallery */}
          <div className="relative">
            <div className="absolute top-4 left-4 z-20">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1.5 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md px-3 py-2 text-sm text-white/90 hover:bg-black/80 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="font-medium">Back</span>
              </button>
            </div>
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-2xl bg-gold/85 backdrop-blur-sm px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-black" />
              <span className="text-[10px] font-black text-black tracking-widest">VERIFIED</span>
            </div>

            {/* Hero image */}
            <div className="relative h-[55vh] min-h-[360px] overflow-hidden">
              <FaceBlurImage
                src={p.profilePictureUrl}
                alt={displayName}
                fill
                blurred={isBlurred}
                sizes="100vw"
                priority
                expiresAt={revealInfo.expiresAt}
                cost={FACE_REVEAL_COST}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent pointer-events-none" />

              {!isBlurred && revealInfo.expiresAt && (
                <div className="absolute top-16 right-4 flex items-center gap-1.5 rounded-xl bg-emerald-500/80 backdrop-blur-sm px-2.5 py-1">
                  <Eye className="h-3 w-3 text-white" />
                  <span className="text-[10px] font-bold text-white">Unlocked</span>
                </div>
              )}

              {/* Name overlay */}
              <div className="absolute bottom-0 inset-x-0 px-4 pb-4 pointer-events-none">
                <h1 className="text-3xl font-black text-white font-playfair" style={{ textShadow: "0 2px 16px rgba(0,0,0,0.9)" }}>
                  {displayName}
                </h1>
                <div className="flex items-center gap-1.5 mt-1">
                  <MapPin className="h-3 w-3 text-gold" />
                  <span className="text-sm text-white/80 font-medium">{p.city}, {p.state}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Gallery thumbnails row */}
          {allImages.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto px-4 py-3 scrollbar-hide bg-black/90">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setLightboxImg(img)}
                  className="relative shrink-0 h-16 w-12 rounded-lg overflow-hidden border-2 border-transparent hover:border-gold/60 transition-all group/thumb"
                >
                  {idx === 0 && isBlurred ? (
                    <FaceBlurImage src={img} alt={displayName} fill blurred sizes="48px" />
                  ) : (
                    <Image src={img} alt={`Photo ${idx + 1}`} fill
                      className="object-cover object-top group-hover/thumb:scale-105 transition-transform" sizes="48px" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/20 transition-all flex items-center justify-center">
                    <ZoomIn className="h-3 w-3 text-white opacity-0 group-hover/thumb:opacity-100" />
                  </div>
                  {idx === 0 && (
                    <div className="absolute bottom-0 inset-x-0 bg-gold text-black text-[7px] font-black text-center py-0.5">
                      MAIN
                    </div>
                  )}
                </button>
              ))}
              <div className="flex items-center pl-1 shrink-0">
                <span className="text-[10px] text-white/40">{allImages.length} photos</span>
              </div>
            </div>
          )}
        </div>

        {/* ── CONTENT ──────────────────────────── */}
        <div className="px-4 max-w-2xl mx-auto space-y-4 pt-4">

          {/* Attribute pills */}
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1 rounded-full bg-card border border-border px-2.5 py-1 text-xs font-semibold text-foreground">
              <User className="h-3 w-3 text-gold" />{p.age} yrs
            </span>
            <span className="flex items-center gap-1 rounded-full bg-card border border-border px-2.5 py-1 text-xs font-semibold text-foreground">
              <Ruler className="h-3 w-3 text-gold" />{p.height}
            </span>
            {p.bodyType && (
              <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold", BODY_COLOR[p.bodyType] ?? "bg-secondary border-border text-muted-foreground")}>
                {BODY_LABEL[p.bodyType]}
              </span>
            )}
            {p.complexion && (
              <span className="rounded-full bg-card border border-border px-2.5 py-1 text-xs text-muted-foreground">
                {COMPLEXION_LABEL[p.complexion]}
              </span>
            )}
          </div>

          {/* About */}
          {p.about && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="h-0.5 bg-gold-gradient" />
              <div className="p-4 space-y-1.5">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-gold" />About
                </p>
                <p className="text-sm text-foreground leading-relaxed">{p.about}</p>
              </div>
            </div>
          )}

          {/* Face reveal */}
          {p.isFaceBlurred && p.allowFaceReveal && (
            isBlurred ? (
              <button onClick={handleReveal} disabled={revealing}
                className="w-full disabled:opacity-60 disabled:cursor-not-allowed group">
                <div className="rounded-2xl border border-gold/35 bg-gradient-to-br from-amber-950/70 via-yellow-900/40 to-amber-950/70 hover:border-gold/60 transition-all p-4 flex items-center gap-3 overflow-hidden relative">
                  <div className="absolute inset-0 shimmer opacity-20 pointer-events-none" />
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/20 border border-gold/40">
                    {revealing ? (
                      <div className="flex gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="h-1.5 w-1.5 rounded-full bg-gold animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    ) : (
                      <Eye className="h-5 w-5 text-gold" />
                    )}
                  </div>
                  <div className="relative flex-1 text-left">
                    <p className="font-black text-gold text-sm">{revealing ? "Revealing..." : "Unlock Face Reveal"}</p>
                    <p className="text-xs text-amber-400/70 mt-0.5">
                      {FACE_REVEAL_COST.toLocaleString()} DC · 24hrs · {coinsToNairaFormatted(FACE_REVEAL_COST)}
                    </p>
                  </div>
                  <div className="relative flex items-center gap-1 rounded-xl bg-gold/15 border border-gold/30 px-2.5 py-1 shrink-0">
                    <Clock className="h-3 w-3 text-gold/70" />
                    <span className="text-[10px] text-gold font-black">24H</span>
                  </div>
                </div>
              </button>
            ) : (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/25">
                  <Eye className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-emerald-400 text-sm">Face Revealed</p>
                  <p className="text-xs text-muted-foreground">Access expires in 24 hours</p>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            )
          )}

          {/* Rates */}
          {p.charges.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Coins className="h-3 w-3 text-gold" />Rates
              </p>
              <div className="space-y-2">
                {p.charges.map((charge) => {
                  const cfg = MEET_CONFIG[charge.meetType];
                  if (!cfg) return null;
                  return (
                    <div key={charge.meetType}
                      className={cn("rounded-2xl border bg-gradient-to-br p-3.5 flex items-center justify-between", cfg.gradient, cfg.border)}>
                      <div className="flex items-center gap-2.5">
                        <div className={cn("h-2 w-2 rounded-full shrink-0", cfg.dot)} />
                        <p className={cn("font-black text-sm", cfg.text)}>{cfg.label}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Coins className="h-3 w-3 text-gold" />
                          <span className="font-black text-gold text-lg leading-none">{formatCoins(charge.maxCoins)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">min {formatCoins(charge.minCoins)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {p.charges.length === 0 && (
            <div className="flex flex-col items-center py-10 rounded-2xl border border-dashed border-border bg-secondary/30 space-y-2">
              <Lock className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-semibold text-muted-foreground">No rates set yet</p>
            </div>
          )}

          {/* ── OTHER MODELS IN STATE ────────── */}
          {otherModels.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-gold" />
                  More Models in {p.state}
                </p>
                <Link href="/client/models"
                  className="text-[10px] text-gold hover:text-gold-light font-bold transition-colors">
                  View All →
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {otherModels.map((m) => (
                  <ModelCard
                    key={m.id}
                    model={m as any}
                    revealInfo={{
                      revealed: !!otherRevealMap[m.modelProfile?.id ?? ""],
                      expiresAt: otherRevealMap[m.modelProfile?.id ?? ""] ?? null,
                    }}
                    onMakeOffer={handleOtherMakeOffer}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="h-4" />
        </div>
      </div>

      {/* ── STICKY BOTTOM BAR ─────────────────── */}
      {p.charges.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-50">
          <div className="absolute inset-0 bg-card/92 backdrop-blur-xl border-t border-border" />
          <div className="relative max-w-2xl mx-auto flex items-center gap-3 px-4 py-3.5">
            <div className="h-10 w-10 rounded-xl overflow-hidden border border-border bg-secondary shrink-0">
              <FaceBlurImage
                src={p.profilePictureUrl}
                alt={displayName}
                fill={false}
                blurred={isBlurred}
                className="h-full w-full object-cover object-top"
                sizes="40px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
              <p className="text-xs text-gold font-semibold">From {formatCoins(lowestMin)} DC</p>
            </div>
            <Button
              onClick={() => setOfferOpen(true)}
              className="h-10 px-6 bg-gold-gradient text-black font-black hover:opacity-90 gold-glow rounded-xl shrink-0 text-sm"
            >
              <Coins className="mr-1.5 h-4 w-4" />
              Make Offer
            </Button>
          </div>
        </div>
      )}

      {/* Offer modals */}
      {p.charges.length > 0 && (
        <OfferModal
          open={offerOpen}
          onClose={() => setOfferOpen(false)}
          model={{ id: model.id, fullName: displayName, profileId: p.id, charges: p.charges }}
          walletBalance={walletBalance}
          onSuccess={() => { setOfferOpen(false); router.refresh(); }}
        />
      )}
      {otherOfferModal.model && (
        <OfferModal
          open={otherOfferModal.open}
          onClose={() => setOtherOfferModal({ open: false, model: null })}
          model={otherOfferModal.model}
          walletBalance={walletBalance}
          onSuccess={() => { setOtherOfferModal({ open: false, model: null }); router.refresh(); }}
        />
      )}
    </>
  );
}