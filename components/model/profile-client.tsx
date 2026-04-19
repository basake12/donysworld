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
  CheckCircle2, Upload, Trash2, Images, Plus, Camera,
  Phone, Lock, KeyRound,
} from "lucide-react";
import { formatCoins, MEET_LIMITS, coinsToNairaFormatted } from "@/lib/coins";
import { NIGERIA_STATES, getCitiesForState } from "@/lib/nigeria-states";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

const profileSchema = z.object({
  age:             z.number({ error: "Age is required" }).min(18).max(60),
  height:          z.string().min(1, "Height is required"),
  city:            z.string().min(2, "City is required"),
  state:           z.string().min(2, "State is required"),
  bodyType:        z.enum(["SLIM", "AVERAGE", "ATHLETIC", "CURVY", "PLUS_SIZE"]),
  complexion:      z.enum(["FAIR", "LIGHT", "MEDIUM", "OLIVE", "TAN", "DARK"]),
  about:           z.string().min(20, "Min 20 characters").max(500),
  allowFaceReveal: z.boolean(),
});

const accountSchema = z.object({
  fullName:       z.string().min(3, "At least 3 characters"),
  nickname:       z.string().min(2, "At least 2 characters").or(z.literal("")),
  whatsappNumber: z.string().min(10, "Enter a valid number").regex(/^\+?[0-9\s\-()+]+$/, "Invalid number"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword:     z.string().min(8, "At least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match", path: ["confirmPassword"],
});

type ProfileFormData  = z.infer<typeof profileSchema>;
type AccountFormData  = z.infer<typeof accountSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

const BODY_TYPE_OPTIONS = [
  { value: "SLIM",      label: "Slim"      },
  { value: "AVERAGE",   label: "Average"   },
  { value: "ATHLETIC",  label: "Athletic"  },
  { value: "CURVY",     label: "Curvy"     },
  { value: "PLUS_SIZE", label: "Plus Size" },
];

const COMPLEXION_OPTIONS = [
  { value: "FAIR",   label: "Fair"   },
  { value: "LIGHT",  label: "Light"  },
  { value: "MEDIUM", label: "Medium" },
  { value: "OLIVE",  label: "Olive"  },
  { value: "TAN",    label: "Tan"    },
  { value: "DARK",   label: "Dark"   },
];

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

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

interface ProfileClientProps {
  profile: {
    id: string; age: number; height: string; city: string; state: string;
    bodyType: string; complexion: string; about: string;
    profilePictureUrl: string; originalPictureUrl?: string | null;
    allowFaceReveal: boolean; isFaceBlurred: boolean; status: string;
    charges: ModelCharge[]; gallery: GalleryItem[];
  };
  user: { fullName: string; nickname?: string | null; email: string; whatsappNumber: string };
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export function ModelProfileClient({ profile, user }: ProfileClientProps) {
  const router      = useRouter();
  const { toast }   = useToast();
  const galleryInputRef    = useRef<HTMLInputElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);

  const [savingProfile,    setSavingProfile]    = useState(false);
  const [savingAccount,    setSavingAccount]    = useState(false);
  const [savingPassword,   setSavingPassword]   = useState(false);
  const [savingCharges,    setSavingCharges]    = useState(false);
  const [allowReveal,      setAllowReveal]      = useState(profile.allowFaceReveal);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingPic,     setUploadingPic]     = useState(false);
  const [deletingId,       setDeletingId]       = useState<string | null>(null);
  const [gallery,          setGallery]          = useState<GalleryItem[]>(profile.gallery);
  const [currentPicUrl,    setCurrentPicUrl]    = useState(profile.profilePictureUrl);
  const [blurStatus,       setBlurStatus]       = useState<string | null>(null);
  const [showCurrent,      setShowCurrent]      = useState(false);
  const [showNew,          setShowNew]          = useState(false);
  const [showConfirm,      setShowConfirm]      = useState(false);

  const getCharge = (type: "SHORT" | "OVERNIGHT" | "WEEKEND") =>
    profile.charges.find((c) => c.meetType === type);

  const [charges, setCharges] = useState({
    SHORT_min:     getCharge("SHORT")?.minCoins     ?? MEET_LIMITS.SHORT.min,
    SHORT_max:     getCharge("SHORT")?.maxCoins     ?? MEET_LIMITS.SHORT.max,
    OVERNIGHT_min: getCharge("OVERNIGHT")?.minCoins ?? MEET_LIMITS.OVERNIGHT.min,
    OVERNIGHT_max: getCharge("OVERNIGHT")?.maxCoins ?? MEET_LIMITS.OVERNIGHT.max,
    WEEKEND_min:   getCharge("WEEKEND")?.minCoins   ?? MEET_LIMITS.WEEKEND.min,
    WEEKEND_max:   getCharge("WEEKEND")?.maxCoins   ?? MEET_LIMITS.WEEKEND.max,
  });

  // ── Profile form ─────────────────────────────────────────────────────────

  const { register, handleSubmit, setValue, watch, formState: { errors } } =
    useForm<ProfileFormData>({
      resolver: zodResolver(profileSchema),
      defaultValues: {
        age:             profile.age || undefined,
        height:          profile.height || "",
        city:            profile.city || "",
        state:           profile.state || "",
        bodyType:        (profile.bodyType as any) || undefined,
        complexion:      (profile.complexion as any) || undefined,
        about:           profile.about || "",
        allowFaceReveal: profile.allowFaceReveal,
      },
    });

  const aboutValue   = watch("about") || "";
  const watchedState = watch("state") || profile.state;

  // ── Account form ─────────────────────────────────────────────────────────

  const accountForm = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      fullName:       user.fullName,
      nickname:       user.nickname ?? "",
      whatsappNumber: user.whatsappNumber,
    },
  });

  // ── Password form ────────────────────────────────────────────────────────

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function onProfileSubmit(data: ProfileFormData) {
    setSavingProfile(true);
    try {
      const res  = await fetch("/api/model/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
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

  async function onAccountSubmit(data: AccountFormData) {
    setSavingAccount(true);
    try {
      const res  = await fetch("/api/model/account", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast({ title: "Account updated!" });
      router.refresh();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingAccount(false);
    }
  }

  async function onPasswordSubmit(data: PasswordFormData) {
    setSavingPassword(true);
    try {
      const res  = await fetch("/api/model/password", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast({ title: "Password changed!" });
      passwordForm.reset();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleProfilePicChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { toast({ title: "JPG, PNG or WebP only", variant: "destructive" }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Max 5MB", variant: "destructive" }); return; }
    setUploadingPic(true);
    setBlurStatus("Detecting & blurring face...");
    try {
      const { blurFace, dataUrlToFile } = await import("@/lib/face-blur-client");
      const objectUrl   = URL.createObjectURL(file);
      const result      = await blurFace(objectUrl);
      URL.revokeObjectURL(objectUrl);
      const blurredFile = dataUrlToFile(result.dataUrl, `blurred_${file.name}`);
      setBlurStatus("Uploading...");
      const form = new FormData();
      form.append("image",    blurredFile);
      form.append("original", file);
      const res  = await fetch("/api/model/profile/picture", { method: "PATCH", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurrentPicUrl(data.profilePictureUrl);
      toast({ title: "Profile picture updated!" });
      router.refresh();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingPic(false);
      setBlurStatus(null);
      if (profilePicInputRef.current) profilePicInputRef.current.value = "";
    }
  }

  async function onChargesSubmit() {
    const types = ["SHORT", "OVERNIGHT", "WEEKEND"] as const;
    for (const t of types) {
      if (charges[`${t}_min`] >= charges[`${t}_max`]) {
        toast({ title: `${t}: min must be less than max`, variant: "destructive" }); return;
      }
    }
    setSavingCharges(true);
    try {
      const res  = await fetch("/api/model/charges", {
        method: "POST", headers: { "Content-Type": "application/json" },
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
    if (file.size > 8 * 1024 * 1024) { toast({ title: "Max 8MB", variant: "destructive" }); return; }
    setUploadingGallery(true);
    setBlurStatus("Detecting & blurring face...");
    try {
      const { blurFace, dataUrlToFile } = await import("@/lib/face-blur-client");
      const objectUrl   = URL.createObjectURL(file);
      const result      = await blurFace(objectUrl);
      URL.revokeObjectURL(objectUrl);
      const blurredFile = dataUrlToFile(result.dataUrl, `blurred_${file.name}`);
      setBlurStatus("Uploading...");
      const form = new FormData();
      form.append("image",    blurredFile);
      form.append("original", file);
      const res  = await fetch("/api/model/gallery", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGallery((prev) => [...prev, data.item]);
      toast({ title: "Photo added!" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingGallery(false);
      setBlurStatus(null);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  async function handleDeleteGallery(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/model/gallery?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setGallery((prev) => prev.filter((g) => g.id !== id).map((g, idx) => ({ ...g, order: idx })));
      toast({ title: "Photo removed" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  const MEET_CONFIG = [
    { type: "SHORT"     as const, label: "Short Meet", limit: MEET_LIMITS.SHORT     },
    { type: "OVERNIGHT" as const, label: "Overnight",  limit: MEET_LIMITS.OVERNIGHT },
    { type: "WEEKEND"   as const, label: "Weekend",    limit: MEET_LIMITS.WEEKEND   },
  ];

  // ── Shared input class ────────────────────────────────────────────────────
  const inputCls = "bg-secondary border-border focus:border-gold h-11 rounded-xl";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader
        title="My Profile"
        description="Manage all your account details and settings."
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

      {/* ── PROFILE PICTURE ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="h-0.5 -mt-5 -mx-5 mb-5 rounded-t-xl bg-gold-gradient" />
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 group">
            <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-gold/30 bg-secondary">
              <Image src={currentPicUrl} alt="Profile" width={80} height={80} className="object-cover w-full h-full" />
            </div>
            <label htmlFor="profilePicUpload" className={cn(
              "absolute inset-0 flex flex-col items-center justify-center rounded-full cursor-pointer",
              "bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
              uploadingPic && "opacity-100 pointer-events-none"
            )}>
              {uploadingPic ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
              {!uploadingPic && <span className="text-[9px] text-white font-bold mt-0.5">Change</span>}
            </label>
            <input id="profilePicUpload" ref={profilePicInputRef} type="file"
              accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={handleProfilePicChange} disabled={uploadingPic} />
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="font-semibold text-foreground">{user.fullName}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-sm text-muted-foreground">{user.whatsappNumber}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1 flex items-center gap-1">
              <Upload className="h-3 w-3" />Hover photo to change · Face auto-blurs
            </p>
          </div>
        </div>
        {blurStatus && uploadingPic && (
          <div className="flex items-center gap-2 mt-3 rounded-xl bg-gold/10 border border-gold/20 px-3 py-2">
            <Loader2 className="h-3.5 w-3.5 text-gold animate-spin shrink-0" />
            <p className="text-xs text-gold font-bold">{blurStatus}</p>
          </div>
        )}
      </div>

      {/* ── ACCOUNT SETTINGS ─────────────────────────────────────────────── */}
      <form onSubmit={accountForm.handleSubmit(onAccountSubmit)}>
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <div className="h-0.5 -mt-5 -mx-5 mb-5 rounded-t-xl bg-gold-gradient" />
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-gold" />Account Settings
          </h2>

          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input {...accountForm.register("fullName")} className={inputCls} placeholder="Your full name" />
            {accountForm.formState.errors.fullName && (
              <p className="text-xs text-destructive">{accountForm.formState.errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Nickname <span className="text-muted-foreground text-xs font-normal">(shown to clients)</span></Label>
            <Input {...accountForm.register("nickname")} className={inputCls} placeholder="e.g. Queen Zara" />
            {accountForm.formState.errors.nickname && (
              <p className="text-xs text-destructive">{accountForm.formState.errors.nickname.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-gold" />WhatsApp Number</Label>
            <Input {...accountForm.register("whatsappNumber")} className={inputCls} placeholder="+234 800 000 0000" />
            {accountForm.formState.errors.whatsappNumber && (
              <p className="text-xs text-destructive">{accountForm.formState.errors.whatsappNumber.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Email Address</Label>
            <Input value={user.email} disabled className={cn(inputCls, "opacity-60 cursor-not-allowed")} />
            <p className="text-[11px] text-muted-foreground">Email cannot be changed. Contact support if needed.</p>
          </div>
        </div>

        <Button type="submit" disabled={savingAccount} className="w-full h-11 bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 gold-glow mt-4">
          {savingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save Account</>}
        </Button>
      </form>

      {/* ── CHANGE PASSWORD ───────────────────────────────────────────────── */}
      <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <div className="h-0.5 -mt-5 -mx-5 mb-5 rounded-t-xl bg-gold-gradient" />
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-gold" />Change Password
          </h2>

          {[
            { name: "currentPassword" as const, label: "Current Password", show: showCurrent, toggle: () => setShowCurrent(p => !p) },
            { name: "newPassword"     as const, label: "New Password",     show: showNew,     toggle: () => setShowNew(p => !p) },
            { name: "confirmPassword" as const, label: "Confirm New Password", show: showConfirm, toggle: () => setShowConfirm(p => !p) },
          ].map(({ name, label, show, toggle }) => (
            <div key={name} className="space-y-1.5">
              <Label>{label}</Label>
              <div className="relative">
                <Input
                  {...passwordForm.register(name)}
                  type={show ? "text" : "password"}
                  className={cn(inputCls, "pr-11")}
                  placeholder="••••••••"
                />
                <button type="button" onClick={toggle}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.formState.errors[name] && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors[name]?.message}</p>
              )}
            </div>
          ))}
        </div>

        <Button type="submit" disabled={savingPassword} className="w-full h-11 bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 gold-glow mt-4">
          {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Lock className="mr-2 h-4 w-4" />Change Password</>}
        </Button>
      </form>

      {/* ── PROFILE INFO ─────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onProfileSubmit)} className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <div className="h-0.5 -mt-5 -mx-5 mb-5 rounded-t-xl bg-gold-gradient" />
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-gold" />Profile Info
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Age</Label>
              <Input type="number" min={18} max={60} {...register("age", { valueAsNumber: true })} className={inputCls} />
              {errors.age && <p className="text-xs text-destructive">{errors.age.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Height</Label>
              <Input placeholder={`5'7"`} {...register("height")} className={inputCls} />
              {errors.height && <p className="text-xs text-destructive">{errors.height.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Body Type</Label>
              <Select defaultValue={profile.bodyType} onValueChange={(v) => setValue("bodyType", v as any)}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{BODY_TYPE_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Complexion</Label>
              <Select defaultValue={profile.complexion} onValueChange={(v) => setValue("complexion", v as any)}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{COMPLEXION_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-gold" />State</Label>
              <Select defaultValue={profile.state} onValueChange={(v) => { setValue("state", v); setValue("city", ""); }}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="Select state" /></SelectTrigger>
                <SelectContent className="max-h-56">{NIGERIA_STATES.map((s) => (<SelectItem key={s.state} value={s.state}>{s.state}</SelectItem>))}</SelectContent>
              </Select>
              {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Select defaultValue={profile.city} onValueChange={(v) => setValue("city", v)}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent className="max-h-56">{getCitiesForState(watchedState).map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
              </Select>
              {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>About Me</Label>
              <span className="text-xs text-muted-foreground">{aboutValue.length}/500</span>
            </div>
            <textarea {...register("about")} rows={4} placeholder="Tell clients about yourself..."
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none resize-none" />
            {errors.about && <p className="text-xs text-destructive">{errors.about.message}</p>}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                {allowReveal ? <Eye className="h-4 w-4 text-gold" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                Allow Face Reveal
              </p>
              <p className="text-xs text-muted-foreground">Clients pay 1,000 DC to reveal your face. You earn 500 DC per reveal.</p>
            </div>
            <button type="button" onClick={() => setAllowReveal((p) => !p)}
              className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200",
                allowReveal ? "bg-gold" : "bg-secondary border border-border")}>
              <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200",
                allowReveal ? "translate-x-6" : "translate-x-1")} />
            </button>
          </div>
        </div>

        <Button type="submit" disabled={savingProfile} className="w-full h-11 bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 gold-glow">
          {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save Profile</>}
        </Button>
      </form>

      {/* ── GALLERY ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="h-0.5 -mt-5 -mx-5 mb-5 rounded-t-xl bg-gold-gradient" />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Images className="h-4 w-4 text-gold" />Gallery
            </h2>
            <p className="text-xs text-muted-foreground">Up to 6 photos. Your face auto-blurs on every upload.</p>
          </div>
          <span className="text-xs text-muted-foreground">{gallery.length}/6</span>
        </div>

        {gallery.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {gallery.map((item) => (
              <div key={item.id} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border bg-secondary group">
                <Image src={item.imageUrl} alt="Gallery" fill className="object-cover" sizes="(max-width: 640px) 33vw, 200px" />
                <button onClick={() => handleDeleteGallery(item.id)} disabled={deletingId === item.id}
                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive">
                  {deletingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
              </div>
            ))}
          </div>
        )}

        {blurStatus && uploadingGallery && (
          <div className="flex items-center gap-2 rounded-xl bg-gold/10 border border-gold/20 px-3 py-2">
            <Loader2 className="h-3.5 w-3.5 text-gold animate-spin shrink-0" />
            <p className="text-xs text-gold font-bold">{blurStatus}</p>
          </div>
        )}

        {gallery.length < 6 && (
          <label htmlFor="galleryUpload" className={cn(
            "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gold/30 bg-gold/5 p-6 cursor-pointer hover:border-gold/60 hover:bg-gold/10 transition-all",
            uploadingGallery && "pointer-events-none opacity-60"
          )}>
            {uploadingGallery ? <Loader2 className="h-6 w-6 text-gold animate-spin" /> : <Plus className="h-6 w-6 text-gold/60" />}
            <p className="text-xs text-muted-foreground text-center">
              {uploadingGallery ? "Processing..." : "Add photo · Face auto-blurs before upload"}
              <br /><span className="text-[10px]">JPG, PNG, WebP · Max 8MB</span>
            </p>
            <input id="galleryUpload" ref={galleryInputRef} type="file" accept="image/*" className="hidden"
              onChange={handleGalleryUpload} disabled={uploadingGallery} />
          </label>
        )}
      </div>

      {/* ── CHARGES ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="h-0.5 -mt-5 -mx-5 mb-5 rounded-t-xl bg-gold-gradient" />
        <div className="space-y-1">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Coins className="h-4 w-4 text-gold" />My Charges
          </h2>
          <p className="text-xs text-muted-foreground">Maximum is shown to clients. They offer between min and max.</p>
        </div>

        <div className="space-y-4">
          {MEET_CONFIG.map(({ type, label, limit }) => (
            <div key={type} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{label}</p>
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
                    className={inputCls} />
                  <p className="text-[10px] text-muted-foreground">≈ {coinsToNairaFormatted(charges[`${type}_min`])}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Maximum (shown)</Label>
                  <Input type="number" min={limit.min} max={limit.max}
                    value={charges[`${type}_max`]}
                    onChange={(e) => setCharges((p) => ({ ...p, [`${type}_max`]: parseInt(e.target.value) || 0 }))}
                    className={inputCls} />
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