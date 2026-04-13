"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Shield, MapPin, Coins, Star } from "lucide-react";

// ── Custom sexy model silhouette icon ─────────
function ModelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 130"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Head */}
      <ellipse cx="40" cy="13" rx="11" ry="11.5" />
      {/* Neck */}
      <path d="M35.5 24 Q37 28 40 28.5 Q43 28 44.5 24 L44.5 31 Q42.5 32.5 40 32.5 Q37.5 32.5 35.5 31 Z" />
      {/* Shoulders — gently curved, feminine slope */}
      <path d="M10 34 Q18 30 40 29.5 Q62 30 70 34 L66 58 Q54 54.5 40 54.5 Q26 54.5 14 58 Z" />
      {/* Waist — narrow pinch */}
      <path d="M14 58 Q26 54.5 40 54.5 Q54 54.5 66 58 L67.5 72 Q55 68.5 40 68.5 Q25 68.5 12.5 72 Z" />
      {/* Hips — wide & curvy */}
      <path d="M12.5 72 Q25 68.5 40 68.5 Q55 68.5 67.5 72 L65 95 Q52 103 40 103 Q28 103 15 95 Z" />
      {/* Left leg */}
      <path d="M15 95 Q28 103 40 103 L36.5 128 L26 128 Z" />
      {/* Right leg */}
      <path d="M65 95 Q52 103 40 103 L43.5 128 L54 128 Z" />
    </svg>
  );
}

// ── Error code → toast map ─────────────────────
const ERROR_TOASTS: Record<
  string,
  { title: string; description: string; duration?: number }
> = {
  NO_ACCOUNT: {
    title: "No account found",
    description: "We couldn't find an account with that email address.",
    duration: 5000,
  },
  INVALID_PASSWORD: {
    title: "Wrong password",
    description: "The password you entered is incorrect. Try again.",
    duration: 5000,
  },
  PENDING_APPROVAL: {
    title: "Account pending approval",
    description:
      "Your model profile is under review. You'll be notified once approved.",
    duration: 7000,
  },
  REJECTED: {
    title: "Account rejected",
    description:
      "Your application was not approved. Contact support for more information.",
    duration: 7000,
  },
  SUSPENDED: {
    title: "Account suspended",
    description:
      "Your account has been suspended. Contact support to appeal.",
    duration: 7000,
  },
  GENERIC: {
    title: "Sign in failed",
    description: "Something went wrong. Please try again.",
    duration: 5000,
  },
};

function showAuthError(code: keyof typeof ERROR_TOASTS) {
  const t = ERROR_TOASTS[code] ?? ERROR_TOASTS.GENERIC;
  toast.error(t.title, { description: t.description, duration: t.duration });
}

// ─────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const ROLE_REDIRECTS: Record<string, string> = {
  CLIENT: "/client/dashboard",
  MODEL: "/model/dashboard",
  ADMIN: "/admin/dashboard",
};

const FEATURES = [
  { icon: Shield, text: "ID-verified models only" },
  { icon: MapPin, text: "Auto-detects models near you" },
  { icon: Coins, text: "Secure coin-based payments" },
  { icon: Star, text: "Premium private experience" },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginFormData) {
    setLoading(true);
    try {
      // ── 1. Pre-check: surface specific errors before NextAuth ──
      const preCheckRes = await fetch("/api/auth/pre-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      const preCheck = await preCheckRes.json();

      if (preCheck.code !== "OK") {
        showAuthError(preCheck.code);
        return;
      }

      // ── 2. Attempt sign-in ──────────────────────────────────
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        showAuthError("INVALID_PASSWORD");
        return;
      }

      // ── 3. Redirect by role ─────────────────────────────────
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const role = session?.user?.role;

      if (callbackUrl) {
        router.push(callbackUrl);
      } else if (role && ROLE_REDIRECTS[role]) {
        router.push(ROLE_REDIRECTS[role]);
      } else {
        router.push("/");
      }
      router.refresh();
    } catch {
      showAuthError("GENERIC");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── LEFT PANEL (desktop only) ─────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 bg-card border-r border-border p-10 relative overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 100% 60% at 20% 50%, hsl(43 62% 52% / 0.06) 0%, transparent 70%)",
          }}
        />

        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 border border-gold/30">
            <ModelIcon className="h-5 w-5 text-gold" />
          </div>
          <span className="text-2xl font-black text-gold-gradient font-playfair">
            Dony&apos;s World
          </span>
        </Link>

        {/* Center content */}
        <div className="relative space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-foreground leading-tight font-playfair">
              Welcome
              <br />
              <span className="text-gold-gradient">back.</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Sign in to your account and pick up where you left off. Your
              models are waiting.
            </p>
          </div>

          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 border border-gold/20">
                  <Icon className="h-3.5 w-3.5 text-gold" />
                </div>
                <span className="text-sm text-muted-foreground">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <p className="relative text-xs text-muted-foreground/40">
          &copy; {new Date().getFullYear()} Dony&apos;s World — 18+ only
        </p>
      </div>

      {/* ── RIGHT PANEL: Form ────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm animate-fade-in">

          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 border border-gold/30">
                <ModelIcon className="h-4.5 w-4.5 text-gold" />
              </div>
              <span className="text-xl font-black text-gold-gradient font-playfair">
                Dony&apos;s World
              </span>
            </Link>
          </div>

          <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-black text-foreground font-playfair">
              Sign In
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to continue
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Email */}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-semibold text-foreground"
              >
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
                className="h-12 bg-secondary border-border focus:border-gold focus:ring-1 focus:ring-gold/20 rounded-xl text-sm"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-sm font-semibold text-foreground"
                >
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-gold hover:text-gold/80 transition-colors font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  {...register("password")}
                  className="h-12 bg-secondary border-border focus:border-gold focus:ring-1 focus:ring-gold/20 rounded-xl text-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gold-gradient text-black font-black hover:opacity-90 gold-glow rounded-xl text-sm mt-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">
              New to Dony&apos;s World?
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Register link */}
          <Button
            asChild
            variant="outline"
            className="w-full h-12 border-border text-foreground hover:border-gold/40 hover:bg-gold/5 rounded-xl font-semibold"
          >
            <Link href="/register">Create an Account</Link>
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-6">
            For adults 18+ only. By signing in you agree to our terms.
          </p>
        </div>
      </div>
    </div>
  );
}