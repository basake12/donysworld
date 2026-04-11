"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Eye, EyeOff, Upload, Loader2, User, Camera, FileText,
  CheckCircle2, Crown, Shield, Star, Lock, Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── SCHEMAS ────────────────────────────────────

const clientSchema = z.object({
  fullName:           z.string().min(3, "At least 3 characters"),
  email:              z.string().email("Enter a valid email"),
  password:           z.string().min(8, "At least 8 characters"),
  confirmPassword:    z.string(),
  gender:             z.enum(["MALE", "FEMALE", "OTHER"], { error: "Select your gender" }),
  genderInterestedIn: z.enum(["MALE", "FEMALE", "OTHER"], { error: "Select preferred gender" }),
  whatsappNumber:     z.string().min(10, "Enter a valid number")
                       .regex(/^\+?[0-9\s\-()]+$/, "Invalid phone number"),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match", path: ["confirmPassword"],
});

const modelSchema = z.object({
  fullName:       z.string().min(3, "At least 3 characters"),
  nickname:       z.string().min(2, "At least 2 characters"),
  email:          z.string().email("Enter a valid email"),
  password:       z.string().min(8, "At least 8 characters"),
  confirmPassword: z.string(),
  gender:         z.enum(["MALE", "FEMALE", "OTHER"], { error: "Select your gender" }),
  whatsappNumber: z.string().min(10, "Enter a valid number")
                   .regex(/^\+?[0-9\s\-()]+$/, "Invalid phone number"),
  documentType:   z.enum(["NIN", "DRIVERS_LICENSE", "VOTERS_CARD", "INTERNATIONAL_PASSPORT"], {
    error: "Select document type",
  }),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match", path: ["confirmPassword"],
});

type ClientFormData = z.infer<typeof clientSchema>;
type ModelFormData  = z.infer<typeof modelSchema>;

const GENDER_OPTIONS = [
  { value: "MALE",   label: "Male"   },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER",  label: "Other"  },
];

const DOCUMENT_OPTIONS = [
  { value: "NIN",                    label: "NIN (National Identity Number)" },
  { value: "DRIVERS_LICENSE",        label: "Driver's License"               },
  { value: "VOTERS_CARD",            label: "Voter's Card"                   },
  { value: "INTERNATIONAL_PASSPORT", label: "International Passport"         },
];

// ─── REUSABLE COMPONENTS ────────────────────────

function Field({
  label, sublabel, error, children,
}: {
  label: string | React.ReactNode;
  sublabel?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold text-foreground">{label}</Label>
      {sublabel && (
        <p className="text-[11px] text-muted-foreground leading-relaxed -mt-0.5">{sublabel}</p>
      )}
      {children}
      {error && (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          <span className="inline-block h-1 w-1 rounded-full bg-destructive shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

function FieldInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        "h-11 bg-secondary border-border focus:border-gold focus:ring-1 focus:ring-gold/20 rounded-xl text-sm placeholder:text-muted-foreground/60",
        className
      )}
      {...props}
    />
  );
}

function PasswordInput({
  show, onToggle, ...props
}: React.ComponentProps<typeof Input> & { show: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <FieldInput type={show ? "text" : "password"} className="pr-12" {...props} />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────

export default function RegisterPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { toast }    = useToast();

  const [role, setRole]                             = useState<"CLIENT" | "MODEL">(
    searchParams.get("role") === "model" ? "MODEL" : "CLIENT"
  );
  const [showPassword, setShowPassword]             = useState(false);
  const [showConfirm, setShowConfirm]               = useState(false);
  const [loading, setLoading]                       = useState(false);
  const [profilePicture, setProfilePicture]         = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [documentFile, setDocumentFile]             = useState<File | null>(null);
  const [success, setSuccess]                       = useState(false);

  const clientForm = useForm<ClientFormData>({ resolver: zodResolver(clientSchema) });
  const modelForm  = useForm<ModelFormData>({ resolver: zodResolver(modelSchema) });

  function handleProfilePicture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Profile picture must be under 5MB", variant: "destructive" });
      return;
    }
    setProfilePicture(file);
    const reader = new FileReader();
    reader.onloadend = () => setProfilePicturePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleDocumentFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Document must be under 10MB", variant: "destructive" });
      return;
    }
    setDocumentFile(file);
  }

  async function onClientSubmit(data: ClientFormData) {
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, role: "CLIENT" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Registration failed");
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function onModelSubmit(data: ModelFormData) {
    if (!profilePicture) {
      toast({ title: "Profile picture required", description: "Upload a clear profile photo", variant: "destructive" });
      return;
    }
    if (!documentFile) {
      toast({ title: "Document required", description: "Upload your legal document", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([k, v]) => formData.append(k, v as string));
      formData.append("role", "MODEL");
      formData.append("profilePicture", profilePicture);
      formData.append("document", documentFile);

      const res  = await fetch("/api/auth/register", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Registration failed");
      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // ── SUCCESS STATE ────────────────────────────

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5 bg-background">
        <div className="w-full max-w-sm text-center space-y-6 animate-fade-in">
          <div className="flex justify-center">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 border-2 border-emerald-500/30">
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              </div>
              <div className="absolute inset-0 rounded-full bg-emerald-500/5 blur-xl -z-10" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-foreground font-playfair">
              {role === "CLIENT" ? "You're in! 🎉" : "Application Submitted!"}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {role === "CLIENT"
                ? "Account created. Redirecting you to login..."
                : "Your application is under review. We'll notify you within 24–48 hours."}
            </p>
          </div>
          {role === "MODEL" && (
            <Button onClick={() => router.push("/login")}
              className="bg-gold-gradient text-black font-black px-10 h-11 rounded-xl">
              Go to Login
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── MAIN LAYOUT ─────────────────────────────

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── LEFT PANEL (desktop only) ─────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-card border-r border-border p-10 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 100% 60% at 20% 50%, hsl(43 62% 52% / 0.06) 0%, transparent 70%)" }} />

        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 border border-gold/30">
            <Crown className="h-5 w-5 text-gold" />
          </div>
          <span className="text-2xl font-black text-gold-gradient font-playfair">Dony&apos;s World</span>
        </Link>

        {/* Center content */}
        <div className="relative space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-foreground font-playfair leading-tight">
              {role === "CLIENT" ? (
                <>Join the<br /><span className="text-gold-gradient">Community</span></>
              ) : (
                <>Become a<br /><span className="text-gold-gradient">Model</span></>
              )}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {role === "CLIENT"
                ? "Connect with verified models near you. Private, fast, and secured."
                : "Earn income on your own terms. Set your rates, manage your schedule."}
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-3">
            {(role === "CLIENT" ? [
              { icon: Shield,  text: "All models ID-verified by admin" },
              { icon: Lock,    text: "Private & secure transactions" },
              { icon: Coins,   text: "Coin-based — no direct transfers" },
              { icon: Star,    text: "Find models in your exact city" },
            ] : [
              { icon: Coins,   text: "Earn for every accepted offer" },
              { icon: Shield,  text: "Your real name stays private" },
              { icon: Star,    text: "Set your own rates and availability" },
              { icon: Lock,    text: "Coupon-protected payments" },
            ]).map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold/10 border border-gold/20">
                  <Icon className="h-3.5 w-3.5 text-gold" />
                </div>
                <span className="text-sm text-muted-foreground">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-muted-foreground/30">
          &copy; {new Date().getFullYear()} Dony&apos;s World — 18+ only
        </p>
      </div>

      {/* ── RIGHT PANEL: Form ────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto px-5 py-10">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-7">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 border border-gold/30">
                <Crown className="h-4 w-4 text-gold" />
              </div>
              <span className="text-xl font-black text-gold-gradient font-playfair">Dony&apos;s World</span>
            </Link>
          </div>

          {/* Heading */}
          <div className="space-y-1 mb-6 text-center">
            <h1 className="text-2xl font-black text-foreground font-playfair">Create Account</h1>
            <p className="text-xs text-muted-foreground">Join Nigeria&apos;s most exclusive platform</p>
          </div>

          {/* ── ROLE TOGGLE ─────────────────── */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border bg-secondary p-1.5 mb-6">
            {(["CLIENT", "MODEL"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition-all duration-200",
                  role === r
                    ? "bg-gold-gradient text-black shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r === "CLIENT" ? <User className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                {r === "CLIENT" ? "I'm a Client" : "I'm a Model"}
              </button>
            ))}
          </div>

          {/* ══ CLIENT FORM ══════════════════════ */}
          {role === "CLIENT" && (
            <form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-4">

              <Field label="Full Name" error={clientForm.formState.errors.fullName?.message}>
                <FieldInput placeholder="John Doe" {...clientForm.register("fullName")} />
              </Field>

              <Field label="Email Address" error={clientForm.formState.errors.email?.message}>
                <FieldInput type="email" placeholder="john@example.com" {...clientForm.register("email")} />
              </Field>

              <Field label="WhatsApp Number" error={clientForm.formState.errors.whatsappNumber?.message}>
                <FieldInput placeholder="+234 800 000 0000" {...clientForm.register("whatsappNumber")} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Your Gender" error={clientForm.formState.errors.gender?.message}>
                  <Select onValueChange={(v) => clientForm.setValue("gender", v as any)}>
                    <SelectTrigger className="h-11 bg-secondary border-border focus:border-gold rounded-xl text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {GENDER_OPTIONS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Interested In" error={clientForm.formState.errors.genderInterestedIn?.message}>
                  <Select onValueChange={(v) => clientForm.setValue("genderInterestedIn", v as any)}>
                    <SelectTrigger className="h-11 bg-secondary border-border focus:border-gold rounded-xl text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {GENDER_OPTIONS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Password" error={clientForm.formState.errors.password?.message}>
                <PasswordInput
                  placeholder="Min 8 characters"
                  show={showPassword}
                  onToggle={() => setShowPassword((p) => !p)}
                  {...clientForm.register("password")}
                />
              </Field>

              <Field label="Confirm Password" error={clientForm.formState.errors.confirmPassword?.message}>
                <PasswordInput
                  placeholder="Repeat password"
                  show={showConfirm}
                  onToggle={() => setShowConfirm((p) => !p)}
                  {...clientForm.register("confirmPassword")}
                />
              </Field>

              {/* Terms notice */}
              <div className="rounded-xl border border-border bg-secondary px-4 py-3">
                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  By creating an account you confirm you are{" "}
                  <span className="text-gold font-bold">18+</span> and agree to our terms.
                </p>
              </div>

              <Button type="submit" disabled={loading}
                className="w-full h-12 bg-gold-gradient text-black font-black hover:opacity-90 gold-glow rounded-xl">
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : "Create Client Account"}
              </Button>
            </form>
          )}

          {/* ══ MODEL FORM ═══════════════════════ */}
          {role === "MODEL" && (
            <form onSubmit={modelForm.handleSubmit(onModelSubmit)} className="space-y-4">

              {/* ── Profile Picture ── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Profile Picture</Label>
                <label htmlFor="profilePic" className="block cursor-pointer">
                  <div className={cn(
                    "relative flex items-center gap-3 rounded-2xl border-2 border-dashed p-3.5 transition-all duration-200",
                    profilePicture
                      ? "border-gold/50 bg-gold/5"
                      : "border-border hover:border-gold/30 hover:bg-secondary/80"
                  )}>
                    {/* Preview / placeholder */}
                    <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden border border-border bg-secondary flex items-center justify-center">
                      {profilePicturePreview ? (
                        <img src={profilePicturePreview} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <Camera className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">
                        {profilePicture ? profilePicture.name : "Upload your photo"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">JPG or PNG · Max 5MB</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Upload className="h-3 w-3 text-gold" />
                        <span className="text-[11px] text-gold font-bold">
                          {profilePicture ? "Change photo" : "Browse files"}
                        </span>
                      </div>
                    </div>
                    {profilePicture && (
                      <div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                    )}
                  </div>
                  <input id="profilePic" type="file" accept="image/*" className="hidden" onChange={handleProfilePicture} />
                </label>
              </div>

              <Field
                label="Full Name"
                sublabel="Must match your bank account name exactly."
                error={modelForm.formState.errors.fullName?.message}
              >
                <FieldInput placeholder="Jane Doe" {...modelForm.register("fullName")} />
              </Field>

              <Field
                label={<>Nickname <span className="text-gold/80 font-normal">(shown to clients)</span></>}
                sublabel="Your real name stays private."
                error={modelForm.formState.errors.nickname?.message}
              >
                <FieldInput placeholder="e.g. Queen Zara" {...modelForm.register("nickname")} />
              </Field>

              <Field label="Email Address" error={modelForm.formState.errors.email?.message}>
                <FieldInput type="email" placeholder="jane@example.com" {...modelForm.register("email")} />
              </Field>

              <Field label="WhatsApp Number" error={modelForm.formState.errors.whatsappNumber?.message}>
                <FieldInput placeholder="+234 800 000 0000" {...modelForm.register("whatsappNumber")} />
              </Field>

              <Field label="Your Gender" error={modelForm.formState.errors.gender?.message}>
                <Select onValueChange={(v) => modelForm.setValue("gender", v as any)}>
                  <SelectTrigger className="h-11 bg-secondary border-border focus:border-gold rounded-xl text-sm">
                    <SelectValue placeholder="Select your gender" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {GENDER_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Password" error={modelForm.formState.errors.password?.message}>
                <PasswordInput
                  placeholder="Min 8 characters"
                  show={showPassword}
                  onToggle={() => setShowPassword((p) => !p)}
                  {...modelForm.register("password")}
                />
              </Field>

              <Field label="Confirm Password" error={modelForm.formState.errors.confirmPassword?.message}>
                <PasswordInput
                  placeholder="Repeat password"
                  show={showConfirm}
                  onToggle={() => setShowConfirm((p) => !p)}
                  {...modelForm.register("confirmPassword")}
                />
              </Field>

              {/* ── Legal Document ── */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Legal Document</Label>

                <Select onValueChange={(v) => modelForm.setValue("documentType", v as any)}>
                  <SelectTrigger className="h-11 bg-secondary border-border focus:border-gold rounded-xl text-sm">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {DOCUMENT_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {modelForm.formState.errors.documentType && (
                  <p className="text-[11px] text-destructive">{modelForm.formState.errors.documentType.message}</p>
                )}

                <label htmlFor="docFile" className="block cursor-pointer">
                  <div className={cn(
                    "flex items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3 transition-all duration-200",
                    documentFile
                      ? "border-gold/50 bg-gold/5"
                      : "border-border hover:border-gold/30 hover:bg-secondary/80"
                  )}>
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground truncate flex-1">
                      {documentFile ? documentFile.name : "Upload document file"}
                    </span>
                    {documentFile ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="text-xs text-gold font-bold shrink-0">Browse</span>
                    )}
                  </div>
                  <input id="docFile" type="file" accept="image/*,.pdf" className="hidden" onChange={handleDocumentFile} />
                </label>
                <p className="text-[11px] text-muted-foreground">Image or PDF · Max 10MB · Only visible to admin</p>
              </div>

              {/* ── Review notice ── */}
              <div className="rounded-2xl border border-gold/15 bg-gold/5 p-4 flex items-start gap-3">
                <Shield className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-gold mb-0.5">Under Review</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Your application is reviewed by admin before activation. This usually takes 24–48 hours.
                  </p>
                </div>
              </div>

              <Button type="submit" disabled={loading}
                className="w-full h-12 bg-gold-gradient text-black font-black hover:opacity-90 gold-glow rounded-xl">
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : "Submit Application"}
              </Button>
            </form>
          )}

          {/* ── Sign-in link ─────────────────── */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-gold hover:text-gold-light font-bold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}