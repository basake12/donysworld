"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";

// ── Custom model silhouette icon (same as login page) ─
function ModelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 130"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="40" cy="13" rx="11" ry="11.5" />
      <path d="M35.5 24 Q37 28 40 28.5 Q43 28 44.5 24 L44.5 31 Q42.5 32.5 40 32.5 Q37.5 32.5 35.5 31 Z" />
      <path d="M10 34 Q18 30 40 29.5 Q62 30 70 34 L66 58 Q54 54.5 40 54.5 Q26 54.5 14 58 Z" />
      <path d="M14 58 Q26 54.5 40 54.5 Q54 54.5 66 58 L67.5 72 Q55 68.5 40 68.5 Q25 68.5 12.5 72 Z" />
      <path d="M12.5 72 Q25 68.5 40 68.5 Q55 68.5 67.5 72 L65 95 Q52 103 40 103 Q28 103 15 95 Z" />
      <path d="M15 95 Q28 103 40 103 L36.5 128 L26 128 Z" />
      <path d="M65 95 Q52 103 40 103 L43.5 128 L54 128 Z" />
    </svg>
  );
}

// ─────────────────────────────────────────────

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });

      // We always show success — prevents email enumeration
      if (res.ok || res.status === 404) {
        setSentEmail(data.email);
        setSent(true);
      } else {
        toast.error("Something went wrong", {
          description: "Please try again in a moment.",
          duration: 5000,
        });
      }
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again in a moment.",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── LEFT PANEL (desktop only) ─────────── */}
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
            Forgot your
            <br />
            <span className="text-gold-gradient">password?</span>
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            No worries. Enter the email address linked to your account and
            we&apos;ll send you a reset link within seconds.
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

          {/* Back link */}
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>

          {!sent ? (
            <>
              <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-black text-foreground font-playfair">
                  Reset Password
                </h1>
                <p className="text-sm text-muted-foreground">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
                    <p className="text-xs text-destructive">
                      {errors.email.message}
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
                    "Send Reset Link"
                  )}
                </Button>
              </form>
            </>
          ) : (
            /* ── Success state ── */
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10 border border-gold/20">
                  <MailCheck className="h-8 w-8 text-gold" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-foreground font-playfair">
                  Check your inbox
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If an account exists for{" "}
                  <span className="text-foreground font-medium">{sentEmail}</span>
                  , a reset link has been sent. It expires in{" "}
                  <span className="text-gold font-semibold">30 minutes</span>.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Didn&apos;t receive it? Check your spam folder, or{" "}
                <button
                  onClick={() => setSent(false)}
                  className="text-gold hover:text-gold/80 transition-colors font-medium underline underline-offset-2"
                >
                  try again
                </button>
                .
              </p>
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