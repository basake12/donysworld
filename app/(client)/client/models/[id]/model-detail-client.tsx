"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OfferModal } from "@/components/client/offer-modal";
import { FaceBlurImage } from "@/components/model/face-blur-image";
import { ModelCard } from "@/components/model/model-card";
import { useRevealedImages } from "@/hooks/use-revealed-images";
import { useToast } from "@/components/ui/use-toast";
import {
  MapPin, Ruler, Eye, Clock, ShieldCheck,
  ChevronLeft, User, Sparkles, Lock, X, CheckCircle2,
} from "lucide-react";
import { FACE_REVEAL_COST, coinsToNairaFormatted } from "@/lib/coins";
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

interface ModelDetailClientProps {
  model: {
    id: string;
    fullName: string;
    nickname: string | null;
    modelProfile: {
      id: string; age: number; height: string; city: string; state: string;
      bodyType: string; complexion: string; about: string;
      profilePictureUrl: string;
      allowFaceReveal: boolean; isFaceBlurred: boolean; isAvailable: boolean;
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
      profilePictureUrl: string;
      allowFaceReveal: boolean; isFaceBlurred: boolean; isAvailable: boolean;
      charges: ModelCharge[]; gallery: GalleryItem[];
    };
  }>;
  otherRevealMap: Record<string, string>;
}

const BODY_LABEL: Record<string, string> = { SLIM: "Slim", AVERAGE: "Average", ATHLETIC: "Athletic", CURVY: "Curvy", PLUS_SIZE: "Plus Size" };
const BODY_COLOR: Record<string, string> = {
  SLIM:      "bg-blue-400/10 border-blue-400/25 text-blue-400",
  AVERAGE:   "bg-violet-400/10 border-violet-400/25 text-violet-400",
  ATHLETIC:  "bg-emerald-400/10 border-emerald-400/25 text-emerald-400",
  CURVY:     "bg-rose-400/10 border-rose-400/25 text-rose-400",
  PLUS_SIZE: "bg-orange-400/10 border-orange-400/25 text-orange-400",
};
const COMPLEXION_LABEL: Record<string, string> = { FAIR: "Fair", LIGHT: "Light", MEDIUM: "Medium", OLIVE: "Olive", TAN: "Tan", DARK: "Dark" };

// ── Image identity for reveal-url lookup ──────────────────────────────────────
interface ImageEntry {
  src: string;
  /** null → profile picture. string → gallery item id. */
  galleryId: string | null;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

interface LightboxProps {
  src: string;
  revealedSrc: string | null;
  revealed: boolean;
  onClose: () => void;
  expiresAt: string | null;
  allowReveal: boolean;
  onReveal: () => Promise<void>;
  revealing: boolean;
}

function Lightbox({ src, revealedSrc, revealed, onClose, expiresAt, allowReveal, onReveal, revealing }: LightboxProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/98 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <button onClick={onClose}
        className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all">
        <X className="h-5 w-5" />
      </button>
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{ aspectRatio: "3/4", maxHeight: "82vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <FaceBlurImage
          src={src}
          revealedSrc={revealedSrc}
          alt="Gallery photo"
          fill
          revealed={revealed}
          sizes="480px"
          expiresAt={expiresAt}
        />
        {!revealed && allowReveal && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={(e) => { e.stopPropagation(); onReveal(); }}
              disabled={revealing}
              className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-black/85 border border-gold/50 text-gold hover:bg-black hover:border-gold transition-all backdrop-blur-md disabled:opacity-50 shadow-lg"
            >
              <Eye className="h-4 w-4" />
              <span className="text-xs font-black tracking-wide">
                {revealing ? "Revealing..." : "Unlock Face · 1,000 DC · 24H"}
              </span>
            </button>
          </div>
        )}
        {revealed && expiresAt && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 backdrop-blur-md">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <Eye className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-xs text-emerald-400 font-bold">Unlocked · 24h</p>
            </div>
          </div>
        )}
      </div>
      <p className="absolute bottom-5 text-[10px] text-white/25 tracking-widest">TAP ANYWHERE TO CLOSE</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ModelDetailClient({
  model, walletBalance, revealInfo: initialRevealInfo,
  otherModels, otherRevealMap,
}: ModelDetailClientProps) {
  const router      = useRouter();
  const { toast }   = useToast();
  const p           = model.modelProfile;
  const displayName = model.nickname || "Model";

  const [revealInfo,    setRevealInfo]    = useState(initialRevealInfo);
  const [revealing,     setRevealing]     = useState(false);
  const [lightbox,      setLightbox]      = useState<ImageEntry | null>(null);
  const [offerOpen,     setOfferOpen]     = useState(false);
  const [offerMeetType, setOfferMeetType] = useState<"SHORT" | "OVERNIGHT" | "WEEKEND" | null>(null);

  // One hook for the entire detail page — covers hero strip + lightbox.
  // The "more models" cards below each have their own hook internally.
  const revealedImages = useRevealedImages(p.id, revealInfo.revealed);

  const allImages: ImageEntry[] = [
    { src: p.profilePictureUrl, galleryId: null },
    ...p.gallery.map((g) => ({ src: g.imageUrl, galleryId: g.id })),
  ];

  function revealedSrcFor(entry: ImageEntry): string | null {
    if (entry.galleryId === null) return revealedImages.profilePicture;
    return revealedImages.gallery[entry.galleryId] ?? null;
  }

  /**
   * The raw <img> strip needs a plain string, not the dual-URL contract.
   * Resolve to whichever the viewer should see right now.
   */
  function displaySrc(entry: ImageEntry): string {
    if (!revealInfo.revealed) return entry.src;
    const rev = revealedSrcFor(entry);
    return rev ?? entry.src;
  }

  function openOffer(meetType: "SHORT" | "OVERNIGHT" | "WEEKEND") {
    setOfferMeetType(meetType);
    setOfferOpen(true);
  }

  async function handleReveal() {
    setRevealing(true);
    try {
      const res  = await fetch("/api/reveal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelProfileId: p.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reveal failed");
      setRevealInfo({ revealed: true, expiresAt: data.expiresAt });
      toast({ title: "Face revealed! 👁️", description: "Access valid for 24 hours." });
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reveal failed";
      toast({ title: "Reveal failed", description: msg, variant: "destructive" });
    } finally {
      setRevealing(false);
    }
  }

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
      {lightbox && (
        <Lightbox
          src={lightbox.src}
          revealedSrc={revealedSrcFor(lightbox)}
          onClose={() => setLightbox(null)}
          revealed={revealInfo.revealed}
          expiresAt={revealInfo.expiresAt}
          allowReveal={p.allowFaceReveal && p.isFaceBlurred}
          onReveal={handleReveal}
          revealing={revealing}
        />
      )}

      <div className="min-h-screen bg-background pb-10">

        {/* ── TOP NAV ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border sticky top-0 z-40">
          <button onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-secondary transition-colors">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex items-center gap-1.5 rounded-xl bg-gold/15 border border-gold/30 px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-gold" />
            <span className="text-[10px] font-black text-gold tracking-widest">VERIFIED</span>
          </div>
        </div>

        {/* ── FULL-IMAGE HORIZONTAL GALLERY STRIP ──────────────────────── */}
        <div className="relative bg-muted/30">
          <div
            className="flex overflow-x-auto gap-2 px-3 py-3 scrollbar-hide"
            style={{ height: "72vw", maxHeight: 520, minHeight: 280 }}
          >
            {allImages.map((img, idx) => (
              <div
                key={idx}
                className="relative shrink-0 h-full rounded-2xl overflow-hidden cursor-pointer group"
                onClick={() => setLightbox(img)}
              >
                {/*
                  Plain <img> here so photos render at their natural aspect
                  ratio inside the fixed-height strip — no forced crop, no
                  letterboxing. Blur is already baked into img.src server-side;
                  originals, when revealed, come from the signed-URL hook via
                  displaySrc().
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displaySrc(img)}
                  alt={`Photo ${idx + 1}`}
                  className="h-full w-auto object-cover rounded-2xl transition-transform duration-300 group-hover:scale-[1.02]"
                  draggable={false}
                />

                {!revealInfo.revealed && p.isFaceBlurred && idx === 0 && p.allowFaceReveal && (
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-3 pointer-events-none">
                    <div className="flex items-center gap-1.5 rounded-xl bg-black/75 border border-gold/30 px-3 py-1.5 backdrop-blur-sm">
                      <Eye className="h-3 w-3 text-gold" />
                      <span className="text-[10px] text-gold font-black">Tap to reveal</span>
                    </div>
                  </div>
                )}

                {revealInfo.revealed && revealInfo.expiresAt && idx === 0 && (
                  <div className="absolute top-2 left-2">
                    <div className="flex items-center gap-1 rounded-xl bg-emerald-500/90 px-2 py-0.5">
                      <Eye className="h-2.5 w-2.5 text-white" />
                      <span className="text-[9px] font-bold text-white">Unlocked</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {allImages.length > 1 && (
            <p className="text-center text-[10px] text-muted-foreground pb-1">
              {allImages.length} photos · scroll to see all
            </p>
          )}
        </div>

        {/* ── BODY ─────────────────────────────────────────────────────── */}
        <div className="px-4 max-w-2xl mx-auto space-y-5 pt-5">

          <div>
            <h1 className="text-2xl font-black text-foreground font-playfair">{displayName}</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin className="h-3.5 w-3.5 text-gold" />
              <span className="text-sm text-muted-foreground">{p.city}, {p.state}</span>
            </div>
          </div>

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

          {p.isFaceBlurred && p.allowFaceReveal && (
            !revealInfo.revealed ? (
              <button onClick={handleReveal} disabled={revealing} className="w-full disabled:opacity-60 disabled:cursor-not-allowed">
                <div className="rounded-2xl border border-gold/35 bg-gradient-to-br from-amber-950/70 via-yellow-900/40 to-amber-950/70 hover:border-gold/60 transition-all p-4 flex items-center gap-3 relative overflow-hidden">
                  <div className="absolute inset-0 shimmer opacity-20 pointer-events-none" />
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/20 border border-gold/40">
                    {revealing
                      ? <div className="flex gap-0.5">{[0,1,2].map((i) => (<span key={i} className="h-1.5 w-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />))}</div>
                      : <Eye className="h-5 w-5 text-gold" />}
                  </div>
                  <div className="relative flex-1 text-left">
                    <p className="font-black text-gold text-sm">{revealing ? "Revealing..." : "Unlock Face Reveal"}</p>
                    <p className="text-xs text-amber-400/70 mt-0.5">{FACE_REVEAL_COST.toLocaleString()} DC · 24hrs · {coinsToNairaFormatted(FACE_REVEAL_COST)}</p>
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

          {p.charges.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-black text-foreground">Experiences</h2>
              <div className="space-y-3">
                {p.charges.map((charge) => (
                  <div
                    key={charge.meetType}
                    className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-foreground text-sm">
                        {charge.meetType === "SHORT"     && "Short Meet"}
                        {charge.meetType === "OVERNIGHT" && "Overnight"}
                        {charge.meetType === "WEEKEND"   && "Weekend"}
                      </p>
                      <p className="text-xs text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />Offers allowed
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="font-black text-gold text-sm leading-none">
                          {charge.maxCoins.toLocaleString()} DC
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          min {charge.minCoins.toLocaleString()}
                        </p>
                      </div>
                      <Button
                        onClick={() => openOffer(charge.meetType)}
                        className="h-9 px-4 bg-gold-gradient text-black font-black rounded-xl text-xs hover:opacity-90 shrink-0"
                      >
                        Make Offer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {p.charges.length === 0 && (
            <div className="flex flex-col items-center py-10 rounded-2xl border border-dashed border-border bg-secondary/30 space-y-2">
              <Lock className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-semibold text-muted-foreground">No rates set yet</p>
            </div>
          )}

          {otherModels.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-gold" />More Models in {p.state}
                </p>
                <Link href="/client/models" className="text-[10px] text-gold hover:text-gold-light font-bold transition-colors">
                  View All →
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {otherModels.map((m) => (
                  <ModelCard key={m.id} model={m}
                    revealInfo={{
                      revealed:  !!otherRevealMap[m.modelProfile?.id ?? ""],
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

      <OfferModal
        open={offerOpen}
        onClose={() => { setOfferOpen(false); setOfferMeetType(null); }}
        model={{ id: model.id, fullName: displayName, profileId: p.id, charges: p.charges }}
        walletBalance={walletBalance}
        defaultMeetType={offerMeetType}
        onSuccess={() => { setOfferOpen(false); setOfferMeetType(null); router.refresh(); }}
      />
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