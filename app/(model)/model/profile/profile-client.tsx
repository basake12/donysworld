"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2, Save, Eye, EyeOff, MapPin, User, Coins,
  CheckCircle2, Upload, Trash2, Images, Plus,
} from "lucide-react";
import { formatCoins, MEET_LIMITS, coinsToNairaFormatted } from "@/lib/coins";
import { NIGERIA_STATES, getCitiesForState } from "@/lib/nigeria-states";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

const profileSchema = z.object({
  age: z.number({ error: "Age is required" }).min(18).max(60),
  height: z.string().min(1, "Height is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  bodyType: z.enum(["SLIM", "AVERAGE", "ATHLETIC", "CURVY", "PLUS_SIZE"]),
  complexion: z.enum(["FAIR", "LIGHT", "MEDIUM", "OLIVE", "TAN", "DARK"]),
  about: z.string().min(20, "Min 20 characters").max(500),
  allowFaceReveal: z.boolean(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const BODY_TYPE_OPTIONS = [
  { value: "SLIM", label: "Slim" },
  { value: "AVERAGE", label: "Average" },
  { value: "ATHLETIC", label: "Athletic" },
  { value: "CURVY", label: "Curvy" },
  { value: "PLUS_SIZE", label: "Plus Size" },
];

const COMPLEXION_OPTIONS = [
  { value: "FAIR", label: "Fair" },
  { value: "LIGHT", label: "Light" },
  { value: "MEDIUM", label: "Medium" },
  { value: "OLIVE", label: "Olive" },
  { value: "TAN", label: "Tan" },
  { value: "DARK", label: "Dark" },
];

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

interface ProfileClientProps {
  profile: {
    id: string; age: number; height: string; city: string; state: string;
    bodyType: string; complexion: string; about: string;
    profilePictureUrl: string; allowFaceReveal: boolean;
    isFaceBlurred: boolean; status: string;
    charges: ModelCharge[]; gallery: GalleryItem[];
  };
  user: { fullName: string; email: string; whatsappNumber: string };
}

export function ModelProfileClient({ profile, user }: ProfileClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCharges, setSavingCharges] = useState(false);
  const [allowReveal, setAllowReveal] = useState(profile.allowFaceReveal);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>(profile.gallery);

  const getCharge = (type: "SHORT" | "OVERNIGHT" | "WEEKEND") =>
    profile.charges.find((c) => c.meetType === type);

  const [charges, setCharges] = useState({
    SHORT_min: getCharge("SHORT")?.minCoins ?? MEET_LIMITS.SHORT.min,
    SHORT_max: getCharge("SHORT")?.maxCoins ?? MEET_LIMITS.SHORT.max,
    OVERNIGHT_min: getCharge("OVERNIGHT")?.minCoins ?? MEET_LIMITS.OVERNIGHT.min,
    OVERNIGHT_max: getCharge("OVERNIGHT")?.maxCoins ?? MEET_LIMITS.OVERNIGHT.max,
    WEEKEND_min: getCharge("WEEKEND")?.minCoins ?? MEET_LIMITS.WEEKEND.min,
    WEEKEND_max: getCharge("WEEKEND")?.maxCoins ?? MEET_LIMITS.WEEKEND.max,
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } =
    useForm<ProfileFormData>({
      resolver: zodResolver(profileSchema),
      defaultValues: {
        age: profile.age || undefined,
        height: profile.height || "",
        city: profile.city || "",
        state: profile.state || "",
        bodyType: (profile.bodyType as any) || undefined,
        complexion: (profile.complexion as any) || undefined,
        about: profile.about || "",
        allowFaceReveal: profile.allowFaceReveal,
      },
    });

  const aboutValue = watch("about") || "";
  const watchedState = watch("state") || profile.state;

  async function onProfileSubmit(data: ProfileFormData) {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/model/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, allowFaceReveal: allowReveal }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast({ title: "Profile updated!" });
      router.refresh();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChargesSubmit() {
    const types = ["SHORT", "OVERNIGHT", "WEEKEND"] as const;
    for (const t of types) {
      if (charges[`${t}_min`] >= charges[`${t}_max`]) {
        toast({ title: `${t}: min must be less than max`, variant: "destructive" });
        return;
      }
    }
    setSavingCharges(true);
    try {
      const res = await fetch("/api/model/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ charges }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast({ title: "Charges saved!" });
      router.refresh();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingCharges(false);
    }
  }

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Max 8MB", variant: "destructive" });
      return;
    }
    setUploadingGallery(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/model/gallery", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGallery((prev) => [...prev, data.item]);
      toast({ title: "Photo added!" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  async function handleDeleteGallery(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/model/gallery?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setGallery((prev) => prev.filter((g) => g.id !== id));
      toast({ title: "Photo removed" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  const MEET_CONFIG = [
    { type: "SHORT" as const, label: "Short Meet", duration: "1 Hour", limit: MEET_LIMITS.SHORT },
    { type: "OVERNIGHT" as const, label: "Overnight", duration: "3 Hours", limit: MEET_LIMITS.OVERNIGHT },
    { type: "WEEKEND" as const, label: "Weekend", duration: "48 Hours", limit: MEET_LIMITS.WEEKEND },
  ];

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader
        title="My Profile"
        description="Keep your profile complete and up to date."
        action={
          <Badge variant="outline" className={cn("text-xs px-2.5 py-1",
            profile.status === "ACTIVE"
              ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
              : "border-amber-500/30 text-amber-400 bg-amber-500/10"
          )}>
            {profile.status === "ACTIVE" && <CheckCircle2 className="mr-1 h-3 w-3" />}
            {profile.status.replace(/_/g, " ")}
          </Badge>
        }
      />

      {/* Profile picture preview */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="h-0.5 -mt-5 -mx-5 mb-5 rounded-t-xl bg-gold-gradient" />
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-gold/30 bg-secondary shrink-0">
            <Image
              src={profile.profilePictureUrl}
              alt="Profile"
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">{user.fullName}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-sm text-muted-foreground">{user.whatsappNumber}</p>
          </div>
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={handleSubmit(onProfileSubmit)} className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-gold" />
            Personal Info
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="age">Age</Label>
              <Input id="age" type="number" min={18} max={60}
                {...register("age", { valueAsNumber: true })}
                className="bg-secondary border-border focus:border-gold" />
              {errors.age && <p className="text-xs text-destructive">{errors.age.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="height">Height</Label>
              <Input id="height" placeholder={`5'7"`} {...register("height")}
                className="bg-secondary border-border focus:border-gold" />
              {errors.height && <p className="text-xs text-destructive">{errors.height.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Body Type</Label>
              <Select defaultValue={profile.bodyType} onValueChange={(v) => setValue("bodyType", v as any)}>
                <SelectTrigger className="bg-secondary border-border focus:border-gold">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {BODY_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Complexion</Label>
              <Select defaultValue={profile.complexion} onValueChange={(v) => setValue("complexion", v as any)}>
                <SelectTrigger className="bg-secondary border-border focus:border-gold">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {COMPLEXION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* State + City cascading */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-gold" />State
              </Label>
              <Select defaultValue={profile.state} onValueChange={(v) => {
                setValue("state", v);
                setValue("city", "");
              }}>
                <SelectTrigger className="bg-secondary border-border focus:border-gold">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {NIGERIA_STATES.map((s) => (
                    <SelectItem key={s.state} value={s.state}>{s.state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Select defaultValue={profile.city} onValueChange={(v) => setValue("city", v)}>
                <SelectTrigger className="bg-secondary border-border focus:border-gold">
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {getCitiesForState(watchedState).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="about">About Me</Label>
              <span className="text-xs text-muted-foreground">{aboutValue.length}/500</span>
            </div>
            <textarea
              id="about" {...register("about")} rows={4}
              placeholder="Tell clients about yourself..."
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none resize-none"
            />
            {errors.about && <p className="text-xs text-destructive">{errors.about.message}</p>}
          </div>

          {/* Face reveal toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                {allowReveal ? <Eye className="h-4 w-4 text-gold" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                Allow Face Reveal
              </p>
              <p className="text-xs text-muted-foreground">
                Clients pay 1,000 DC to reveal your face. You earn 500 DC per reveal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAllowReveal((p) => !p)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200",
                allowReveal ? "bg-gold" : "bg-secondary border border-border"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200",
                allowReveal ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
          </div>
        </div>

        <Button type="submit" disabled={savingProfile}
          className="w-full h-11 bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 gold-glow">
          {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save Profile</>}
        </Button>
      </form>

      {/* ── GALLERY ─────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="h-0.5 -mt-5 -mx-5 mb-5 rounded-t-xl bg-gold-gradient" />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Images className="h-4 w-4 text-gold" />
              Gallery
            </h2>
            <p className="text-xs text-muted-foreground">
              Add up to 6 body photos. Clients see these alongside your profile pic. Your face remains blurred on all photos until revealed.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{gallery.length}/6</span>
        </div>

        {gallery.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {gallery.map((item) => (
              <div key={item.id} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border bg-secondary group">
                <Image
                  src={item.imageUrl}
                  alt="Gallery"
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 33vw, 200px"
                />
                <button
                  onClick={() => handleDeleteGallery(item.id)}
                  disabled={deletingId === item.id}
                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                >
                  {deletingId === item.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Trash2 className="h-3 w-3" />}
                </button>
              </div>
            ))}
          </div>
        )}

        {gallery.length < 6 && (
          <label
            htmlFor="galleryUpload"
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gold/30 bg-gold/5 p-6 cursor-pointer hover:border-gold/60 hover:bg-gold/10 transition-all",
              uploadingGallery && "pointer-events-none opacity-60"
            )}
          >
            {uploadingGallery
              ? <Loader2 className="h-6 w-6 text-gold animate-spin" />
              : <Plus className="h-6 w-6 text-gold/60" />}
            <p className="text-xs text-muted-foreground text-center">
              {uploadingGallery ? "Uploading..." : "Add photo (body shots — face will auto-blur for clients)"}
              <br />
              <span className="text-[10px]">JPG, PNG, WebP · Max 8MB</span>
            </p>
            <input
              id="galleryUpload"
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGalleryUpload}
              disabled={uploadingGallery}
            />
          </label>
        )}
      </div>

      {/* ── CHARGES ─────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="h-0.5 -mt-5 -mx-5 mb-5 rounded-t-xl bg-gold-gradient" />
        <div className="space-y-1">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Coins className="h-4 w-4 text-gold" />My Charges
          </h2>
          <p className="text-xs text-muted-foreground">
            Maximum is shown to clients. They offer between min and max.
          </p>
        </div>

        <div className="space-y-4">
          {MEET_CONFIG.map(({ type, label, duration, limit }) => (
            <div key={type} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{duration}</p>
                </div>
                <Badge variant="outline" className="text-xs border-gold/20 text-gold">
                  {formatCoins(limit.min)} – {formatCoins(limit.max)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Minimum</Label>
                  <Input type="number" min={limit.min} max={limit.max}
                    value={charges[`${type}_min`]}
                    onChange={(e) => setCharges((p) => ({ ...p, [`${type}_min`]: parseInt(e.target.value) || 0 }))}
                    className="bg-secondary border-border focus:border-gold" />
                  <p className="text-[10px] text-muted-foreground">≈ {coinsToNairaFormatted(charges[`${type}_min`])}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Maximum (shown)</Label>
                  <Input type="number" min={limit.min} max={limit.max}
                    value={charges[`${type}_max`]}
                    onChange={(e) => setCharges((p) => ({ ...p, [`${type}_max`]: parseInt(e.target.value) || 0 }))}
                    className="bg-secondary border-border focus:border-gold" />
                  <p className="text-[10px] text-muted-foreground">≈ {coinsToNairaFormatted(charges[`${type}_max`])}</p>
                </div>
              </div>
              {type !== "WEEKEND" && <Separator className="bg-border/50 mt-2" />}
            </div>
          ))}
        </div>

        <Button onClick={onChargesSubmit} disabled={savingCharges}
          className="w-full h-11 bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 gold-glow">
          {savingCharges ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save Charges</>}
        </Button>
      </div>
    </div>
  );
}