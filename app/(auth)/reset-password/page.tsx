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
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { ModelIcon } from "@/components/shared/model-icon";

// ─────────────────────────────────────────────

const schema = z
  .object({
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

type PageState = "form" | "success" | "invalid_token";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [pageState, setPageState] = useState<PageState>(
    token ? "form" : "invalid_token"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });

      if (res.ok) {
        setPageState("success");
        return;
      }

      const body = await res.json();

      if (res.status === 400 && body.error === "TOKEN_INVALID_OR_EXPIRED") {
        setPageState("invalid_token");
        return;
      }

      toast.error("Reset failed", {
        description: body.message ?? "Please try again.",
        duration: 5000,
      });
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again.",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }

  // ── Shell ──────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex">

      {/* ── LEFT PANEL (desktop) ─────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 bg-card border-r border-border p-10 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 100% 60% at 20% 50%, hsl(43 62% 52% / 0.06) 0%, transparent 70%)",
          }}
        />
        <Link href="/" className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 border border-gold/30">
            <ModelIcon className="h-5 w-5 text-gold" />
          </div>
          <span className="text-2xl font-black text-gold-gradient font-playfair">
            Dony&apos;s World
          </span>
        </Link>

        <div className="relative space-y-4">
          <h2 className="text-4xl font-black text-foreground leading-tight font-playfair">
            Create a new
            <br />
            <span className="text-gold-gradient">password.</span>
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            Choose a strong password you haven&apos;t used before. It must be
            at least 8 characters, include an uppercase letter and a number.
          </p>
        </div>

        <p className="relative text-xs text-muted-foreground/40">
          &copy; {new Date().getFullYear()} Dony&apos;s World — 18+ only
        </p>
      </div>

      {/* ── RIGHT PANEL ────────────────────────── */}
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

          {/* ── FORM STATE ── */}
          {pageState === "form" && (
            <>
              <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-black text-foreground font-playfair">
                  New Password
                </h1>
                <p className="text-sm text-muted-foreground">
                  Enter and confirm your new password below.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                {/* New password */}
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-sm font-semibold text-foreground"
                  >
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      {...register("password")}
                      className="h-12 bg-secondary border-border focus:border-gold focus:ring-1 focus:ring-gold/20 rounded-xl text-sm pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password.message}</p>
                  )}
                </div>

                {/* Confirm password */}
                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-sm font-semibold text-foreground"
                  >
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repeat your password"
                      {...register("confirmPassword")}
                      className="h-12 bg-secondary border-border focus:border-gold focus:ring-1 focus:ring-gold/20 rounded-xl text-sm pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((p) => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gold-gradient text-black font-black hover:opacity-90 gold-glow rounded-xl text-sm mt-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Set New Password"
                  )}
                </Button>
              </form>
            </>
          )}

          {/* ── SUCCESS STATE ── */}
          {pageState === "success" && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10 border border-gold/20">
                  <CheckCircle2 className="h-8 w-8 text-gold" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-foreground font-playfair">
                  Password updated!
                </h1>
                <p className="text-sm text-muted-foreground">
                  Your password has been changed successfully. You can now sign
                  in with your new credentials.
                </p>
              </div>
              <Button
                className="w-full h-12 bg-gold-gradient text-black font-black hover:opacity-90 gold-glow rounded-xl text-sm"
                onClick={() => router.push("/login")}
              >
                Sign In
              </Button>
            </div>
          )}

          {/* ── INVALID TOKEN STATE ── */}
          {pageState === "invalid_token" && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-foreground font-playfair">
                  Link expired
                </h1>
                <p className="text-sm text-muted-foreground">
                  This reset link is invalid or has expired. Reset links are
                  valid for 30 minutes.
                </p>
              </div>
              <Button
                asChild
                className="w-full h-12 bg-gold-gradient text-black font-black hover:opacity-90 gold-glow rounded-xl text-sm"
              >
                <Link href="/forgot-password">Request a new link</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full h-12 border-border text-foreground hover:border-gold/40 hover:bg-gold/5 rounded-xl font-semibold"
              >
                <Link href="/login">Back to Sign In</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}