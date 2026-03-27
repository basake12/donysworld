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
  Eye, EyeOff, Upload, Loader2, User, Camera, FileText, CheckCircle2,
} from "lucide-react";

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

const clientSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], { error: "Select your gender" }),
  genderInterestedIn: z.enum(["MALE", "FEMALE", "OTHER"], { error: "Select gender you are interested in" }),
  whatsappNumber: z.string().min(10, "Enter a valid WhatsApp number")
    .regex(/^\+?[0-9\s\-()]+$/, "Enter a valid phone number"),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match", path: ["confirmPassword"],
});

const modelSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters"),
  nickname: z.string().min(2, "Nickname must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], { error: "Select your gender" }),
  whatsappNumber: z.string().min(10, "Enter a valid WhatsApp number")
    .regex(/^\+?[0-9\s\-()]+$/, "Enter a valid phone number"),
  documentType: z.enum(["NIN", "DRIVERS_LICENSE", "VOTERS_CARD", "INTERNATIONAL_PASSPORT"], {
    error: "Select document type",
  }),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match", path: ["confirmPassword"],
});

type ClientFormData = z.infer<typeof clientSchema>;
type ModelFormData = z.infer<typeof modelSchema>;

const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const DOCUMENT_OPTIONS = [
  { value: "NIN", label: "NIN (National Identity Number)" },
  { value: "DRIVERS_LICENSE", label: "Driver's License" },
  { value: "VOTERS_CARD", label: "Voter's Card" },
  { value: "INTERNATIONAL_PASSPORT", label: "International Passport" },
];

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [role, setRole] = useState<"CLIENT" | "MODEL">(
    searchParams.get("role") === "model" ? "MODEL" : "CLIENT"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [success, setSuccess] = useState(false);

  const clientForm = useForm<ClientFormData>({ resolver: zodResolver(clientSchema) });
  const modelForm = useForm<ModelFormData>({ resolver: zodResolver(modelSchema) });

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
      const res = await fetch("/api/auth/register", {
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
      toast({ title: "Profile picture required", description: "Please upload a clear profile picture", variant: "destructive" });
      return;
    }
    if (!documentFile) {
      toast({ title: "Document required", description: "Please upload your legal document", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, val]) => formData.append(key, val as string));
      formData.append("role", "MODEL");
      formData.append("profilePicture", profilePicture);
      formData.append("document", documentFile);

      const res = await fetch("/api/auth/register", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Registration failed");
      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="w-full max-w-md text-center space-y-6 animate-fade-in">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-500/10 p-4 border border-emerald-500/20">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              {role === "CLIENT" ? "Welcome aboard!" : "Application submitted!"}
            </h2>
            <p className="text-muted-foreground">
              {role === "CLIENT"
                ? "Your account has been created. Redirecting to login..."
                : "Your application is under review. We'll notify you within 24–48 hours."}
            </p>
          </div>
          {role === "MODEL" && (
            <Button onClick={() => router.push("/login")} className="bg-gold-gradient text-primary-foreground">
              Go to Login
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / Title */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Create Account</h1>
          <p className="text-muted-foreground text-sm">Join Dony's World today</p>
        </div>

        {/* Role Toggle */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-secondary p-1">
          {(["CLIENT", "MODEL"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                role === r
                  ? "bg-gold-gradient text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "CLIENT" ? <User className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {r === "CLIENT" ? "I'm a Client" : "I'm a Model"}
            </button>
          ))}
        </div>

        {/* CLIENT FORM */}
        {role === "CLIENT" && (
          <form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" placeholder="John Doe" {...clientForm.register("fullName")}
                className="bg-secondary border-border focus:border-gold" />
              {clientForm.formState.errors.fullName && (
                <p className="text-xs text-destructive">{clientForm.formState.errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" placeholder="john@example.com" {...clientForm.register("email")}
                className="bg-secondary border-border focus:border-gold" />
              {clientForm.formState.errors.email && (
                <p className="text-xs text-destructive">{clientForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp Number</Label>
              <Input id="whatsapp" placeholder="+234 800 000 0000" {...clientForm.register("whatsappNumber")}
                className="bg-secondary border-border focus:border-gold" />
              {clientForm.formState.errors.whatsappNumber && (
                <p className="text-xs text-destructive">{clientForm.formState.errors.whatsappNumber.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Your Gender</Label>
              <Select onValueChange={(v) => clientForm.setValue("gender", v as any)}>
                <SelectTrigger className="bg-secondary border-border focus:border-gold">
                  <SelectValue placeholder="Select your gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientForm.formState.errors.gender && (
                <p className="text-xs text-destructive">{clientForm.formState.errors.gender.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Interested In</Label>
              <Select onValueChange={(v) => clientForm.setValue("genderInterestedIn", v as any)}>
                <SelectTrigger className="bg-secondary border-border focus:border-gold">
                  <SelectValue placeholder="Select gender interested in" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientForm.formState.errors.genderInterestedIn && (
                <p className="text-xs text-destructive">{clientForm.formState.errors.genderInterestedIn.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="Min 8 characters"
                  {...clientForm.register("password")} className="bg-secondary border-border focus:border-gold pr-10" />
                <button type="button" onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {clientForm.formState.errors.password && (
                <p className="text-xs text-destructive">{clientForm.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input id="confirmPassword" type={showConfirm ? "text" : "password"} placeholder="Repeat password"
                  {...clientForm.register("confirmPassword")} className="bg-secondary border-border focus:border-gold pr-10" />
                <button type="button" onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {clientForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{clientForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" disabled={loading}
              className="w-full h-11 bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 gold-glow">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Client Account"}
            </Button>
          </form>
        )}

        {/* MODEL FORM */}
        {role === "MODEL" && (
          <form onSubmit={modelForm.handleSubmit(onModelSubmit)} className="space-y-4">
            {/* Profile Picture */}
            <div className="space-y-1.5">
              <Label>Profile Picture</Label>
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden border border-border bg-secondary flex items-center justify-center">
                  {profilePicturePreview ? (
                    <img src={profilePicturePreview} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <label htmlFor="profilePic"
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground hover:border-gold hover:text-foreground transition-colors">
                    <Upload className="h-4 w-4" />
                    {profilePicture ? profilePicture.name : "Upload clear photo"}
                  </label>
                  <input id="profilePic" type="file" accept="image/*" className="hidden" onChange={handleProfilePicture} />
                  <p className="text-xs text-muted-foreground">JPG or PNG, max 5MB.</p>
                </div>
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="modelFullName">Full Name</Label>
              <p className="text-xs text-muted-foreground">
                Must match your bank account name exactly for withdrawals.
              </p>
              <Input id="modelFullName" placeholder="Jane Doe" {...modelForm.register("fullName")}
                className="bg-secondary border-border focus:border-gold" />
              {modelForm.formState.errors.fullName && (
                <p className="text-xs text-destructive">{modelForm.formState.errors.fullName.message}</p>
              )}
            </div>

            {/* Nickname */}
            <div className="space-y-1.5">
              <Label htmlFor="nickname">Nickname <span className="text-gold">(shown to clients)</span></Label>
              <p className="text-xs text-muted-foreground">
                This is what clients see. Your real name stays private.
              </p>
              <Input id="nickname" placeholder="e.g. Queen Zara" {...modelForm.register("nickname")}
                className="bg-secondary border-border focus:border-gold" />
              {modelForm.formState.errors.nickname && (
                <p className="text-xs text-destructive">{modelForm.formState.errors.nickname.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="modelEmail">Email Address</Label>
              <Input id="modelEmail" type="email" placeholder="jane@example.com" {...modelForm.register("email")}
                className="bg-secondary border-border focus:border-gold" />
              {modelForm.formState.errors.email && (
                <p className="text-xs text-destructive">{modelForm.formState.errors.email.message}</p>
              )}
            </div>

            {/* WhatsApp */}
            <div className="space-y-1.5">
              <Label htmlFor="modelWhatsapp">WhatsApp Number</Label>
              <Input id="modelWhatsapp" placeholder="+234 800 000 0000" {...modelForm.register("whatsappNumber")}
                className="bg-secondary border-border focus:border-gold" />
              {modelForm.formState.errors.whatsappNumber && (
                <p className="text-xs text-destructive">{modelForm.formState.errors.whatsappNumber.message}</p>
              )}
            </div>

            {/* Gender */}
            <div className="space-y-1.5">
              <Label>Your Gender</Label>
              <Select onValueChange={(v) => modelForm.setValue("gender", v as any)}>
                <SelectTrigger className="bg-secondary border-border focus:border-gold">
                  <SelectValue placeholder="Select your gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {modelForm.formState.errors.gender && (
                <p className="text-xs text-destructive">{modelForm.formState.errors.gender.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="modelPassword">Password</Label>
              <div className="relative">
                <Input id="modelPassword" type={showPassword ? "text" : "password"} placeholder="Min 8 characters"
                  {...modelForm.register("password")} className="bg-secondary border-border focus:border-gold pr-10" />
                <button type="button" onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {modelForm.formState.errors.password && (
                <p className="text-xs text-destructive">{modelForm.formState.errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="modelConfirm">Confirm Password</Label>
              <div className="relative">
                <Input id="modelConfirm" type={showConfirm ? "text" : "password"} placeholder="Repeat password"
                  {...modelForm.register("confirmPassword")} className="bg-secondary border-border focus:border-gold pr-10" />
                <button type="button" onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {modelForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{modelForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Legal Document */}
            <div className="space-y-1.5">
              <Label>Legal Document</Label>
              <Select onValueChange={(v) => modelForm.setValue("documentType", v as any)}>
                <SelectTrigger className="bg-secondary border-border focus:border-gold">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {modelForm.formState.errors.documentType && (
                <p className="text-xs text-destructive">{modelForm.formState.errors.documentType.message}</p>
              )}
              <label htmlFor="docFile"
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-muted-foreground hover:border-gold hover:text-foreground transition-colors mt-2">
                <FileText className="h-4 w-4" />
                {documentFile ? documentFile.name : "Upload document file"}
              </label>
              <input id="docFile" type="file" accept="image/*,.pdf" className="hidden" onChange={handleDocumentFile} />
              <p className="text-xs text-muted-foreground">Image or PDF, max 10MB. Only visible to admin.</p>
            </div>

            <div className="rounded-lg border border-gold/20 bg-gold/5 p-3">
              <p className="text-xs text-muted-foreground text-center">
                Your application will be reviewed by admin before activation. Usually 24–48 hours.
              </p>
            </div>

            <Button type="submit" disabled={loading}
              className="w-full h-11 bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 gold-glow">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Model Application"}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-gold hover:text-gold-light font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}