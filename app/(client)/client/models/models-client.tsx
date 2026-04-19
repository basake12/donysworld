"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { ModelCard } from "@/components/model/model-card";
import { OfferModal } from "@/components/client/offer-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Users, Search, SlidersHorizontal, X, MapPin, Loader2, Star,
} from "lucide-react";
import { NIGERIA_STATES } from "@/lib/nigeria-states";
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

interface Model {
  id: string;
  fullName: string;
  nickname: string | null;
  modelProfile: {
    id: string; age: number; height: string; city: string; state: string;
    bodyType: string; complexion: string; about: string;
    profilePictureUrl: string;
    originalPictureUrl?: string | null;
    allowFaceReveal: boolean; isFaceBlurred: boolean;
    charges: ModelCharge[]; gallery: GalleryItem[];
  };
}

interface ModelsClientProps {
  models: Model[];
  walletBalance: number;
  clientProfileId: string;
  revealMap: Record<string, string>;
  states: string[];
}

export function ModelsClient({
  models, walletBalance, clientProfileId, revealMap, states,
}: ModelsClientProps) {
  const router    = useRouter();
  const { toast } = useToast();

  const [search,          setSearch]          = useState("");
  const [stateFilter,     setStateFilter]     = useState("all");
  const [cityFilter,      setCityFilter]      = useState("all");
  const [bodyTypeFilter,  setBodyTypeFilter]  = useState("all");
  const [showFilters,     setShowFilters]     = useState(false);
  const [locating,        setLocating]        = useState(false);
  const [locationLabel,   setLocationLabel]   = useState<string | null>(null);
  const [localRevealMap,  setLocalRevealMap]  = useState<Record<string, string>>(revealMap);

  const [offerModal, setOfferModal] = useState<{
    open: boolean;
    model: { id: string; fullName: string; profileId: string; charges: ModelCharge[] } | null;
  }>({ open: false, model: null });

  // ── Auto-detect location ─────────────────────
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    autoDetectLocation();
  }, []);

  async function autoDetectLocation() {
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 600000 })
      );
      const { latitude, longitude } = pos.coords;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { "Accept-Language": "en" }, cache: "force-cache" }
      );
      if (!res.ok) return;
      const data = await res.json();
      const rawState: string = data.address?.state || "";
      const matched = NIGERIA_STATES.find((s) => {
        const a = s.state.toLowerCase(), b = rawState.toLowerCase();
        return b.includes(a) || a.includes(b) ||
          (a === "fct" && b.includes("capital")) ||
          (b.includes("fct") && a === "fct");
      });
      if (matched) {
        setStateFilter(matched.state);
        setLocationLabel(matched.state);
      }
    } catch { /* silent */ }
    finally { setLocating(false); }
  }

  // ── Filtered ─────────────────────────────────
  const filtered = useMemo(() => {
    return models.filter((m) => {
      const p = m.modelProfile;
      if (!p) return false;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (m.nickname || "").toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q);
      const matchState = stateFilter === "all" || p.state === stateFilter;
      const matchCity  = cityFilter  === "all" || p.city  === cityFilter;
      const matchBody  = bodyTypeFilter === "all" || p.bodyType === bodyTypeFilter;
      return matchSearch && matchState && matchCity && matchBody;
    });
  }, [models, search, stateFilter, cityFilter, bodyTypeFilter]);

  const citiesInState = useMemo(() => {
    if (stateFilter === "all") {
      return Array.from(new Set(models.map((m) => m.modelProfile?.city).filter(Boolean) as string[])).sort();
    }
    return NIGERIA_STATES.find((s) => s.state === stateFilter)?.cities ?? [];
  }, [stateFilter, models]);

  const activeFilters = [stateFilter !== "all", cityFilter !== "all", bodyTypeFilter !== "all"].filter(Boolean).length;

  function clearFilters() {
    setStateFilter("all");
    setCityFilter("all");
    setBodyTypeFilter("all");
    setSearch("");
    setLocationLabel(null);
  }

  function handleMakeOffer(modelId: string, profileId: string) {
    const m = models.find((x) => x.id === modelId);
    if (!m?.modelProfile) return;
    setOfferModal({
      open: true,
      model: { id: modelId, fullName: m.nickname || m.fullName, profileId, charges: m.modelProfile.charges },
    });
  }

  return (
    <>
      <div className="space-y-5">

        {/* ── HEADER ────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-foreground font-playfair">Browse Models</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{models.length} verified models</p>
          </div>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground gap-1 h-8">
              <X className="h-3 w-3" />Clear filters
            </Button>
          )}
        </div>

        {/* ── LOCATION DETECTED BAR ─────────── */}
        {(locating || locationLabel) && (
          <div className="flex items-center gap-2 rounded-xl border border-gold/20 bg-gold/5 px-3 py-2.5">
            {locating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 text-gold animate-spin" />
                <span className="text-xs text-muted-foreground">Detecting your location...</span>
              </>
            ) : (
              <>
                <MapPin className="h-3.5 w-3.5 text-gold" />
                <span className="text-xs text-foreground">
                  Showing models in <span className="text-gold font-bold">{locationLabel}</span>
                </span>
                <button onClick={clearFilters} className="ml-auto text-[10px] text-muted-foreground hover:text-foreground">
                  Show all
                </button>
              </>
            )}
          </div>
        )}

        {/* ── SEARCH + FILTER ROW ───────────── */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name, city or state..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 bg-secondary border-border focus:border-gold text-sm rounded-xl"
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters((p) => !p)}
              className={cn(
                "gap-2 h-10 rounded-xl border-border px-4 text-sm shrink-0",
                showFilters && "border-gold text-gold bg-gold/8"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilters > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[9px] font-black text-black">
                  {activeFilters}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">State</label>
                <Select value={stateFilter} onValueChange={(v) => { setStateFilter(v); setCityFilter("all"); }}>
                  <SelectTrigger className="h-10 bg-secondary border-border focus:border-gold rounded-xl text-sm">
                    <SelectValue placeholder="All states" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56 rounded-xl">
                    <SelectItem value="all">All States</SelectItem>
                    {NIGERIA_STATES.map((s) => (
                      <SelectItem key={s.state} value={s.state}>{s.state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">City</label>
                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger className="h-10 bg-secondary border-border focus:border-gold rounded-xl text-sm">
                    <SelectValue placeholder="All cities" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56 rounded-xl">
                    <SelectItem value="all">All Cities</SelectItem>
                    {citiesInState.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Body Type</label>
                <Select value={bodyTypeFilter} onValueChange={setBodyTypeFilter}>
                  <SelectTrigger className="h-10 bg-secondary border-border focus:border-gold rounded-xl text-sm">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Body Types</SelectItem>
                    <SelectItem value="SLIM">Slim</SelectItem>
                    <SelectItem value="AVERAGE">Average</SelectItem>
                    <SelectItem value="ATHLETIC">Athletic</SelectItem>
                    <SelectItem value="CURVY">Curvy</SelectItem>
                    <SelectItem value="PLUS_SIZE">Plus Size</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {(search || activeFilters > 0) && (
          <p className="text-xs text-muted-foreground">
            <span className="text-gold font-bold">{filtered.length}</span> of {models.length} models
          </p>
        )}

        {/* ── MODEL GRID ────────────────────── */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No models found"
            description={activeFilters > 0 || search ? "Try adjusting your filters." : "No active models available."}
            action={(activeFilters > 0 || search) ? (
              <Button variant="outline" onClick={clearFilters}
                className="border-gold/30 text-gold hover:bg-gold/8 rounded-xl text-sm">
                Clear Filters
              </Button>
            ) : undefined}
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-gold fill-gold" />
                <h2 className="text-sm font-black text-foreground">
                  {locationLabel ? `Models in ${locationLabel}` : "All Models"}
                </h2>
                <Badge variant="outline" className="text-[10px] border-gold/20 text-gold px-2 py-0 rounded-full">
                  {filtered.length}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filtered.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model as any}
                    revealInfo={{
                      revealed:  !!localRevealMap[model.modelProfile?.id ?? ""],
                      expiresAt: localRevealMap[model.modelProfile?.id ?? ""] ?? null,
                    }}
                    onMakeOffer={handleMakeOffer}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {offerModal.model && (
        <OfferModal
          open={offerModal.open}
          onClose={() => setOfferModal({ open: false, model: null })}
          model={offerModal.model}
          walletBalance={walletBalance}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
}