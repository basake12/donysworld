import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AgeGate } from "@/components/shared/age-gate";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { ModelIcon } from "@/components/shared/model-icon";
import { prisma } from "@/lib/prisma";
import {
  Shield, MapPin, Coins, ChevronRight,
  Users, Lock, Zap, CheckCircle2, Star, TrendingUp,
} from "lucide-react";

const ROLE_REDIRECTS: Record<Role, string> = {
  CLIENT: "/client/dashboard",
  MODEL:  "/model/dashboard",
  ADMIN:  "/admin/dashboard",
};

export const revalidate = 60;

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect(ROLE_REDIRECTS[session.user.role]);

  const offerCount = await prisma.offer
    .count({ where: { status: { in: ["COMPLETED", "ACCEPTED"] } } })
    .catch(() => 2400);

  const STATS = [
    { value: "500+",  label: "Verified Models",  icon: Users },
    { value: "36+",   label: "States Covered",   icon: MapPin },
    { value: `${Math.max(offerCount, 1000).toLocaleString()}+`, label: "Successful Meets", icon: TrendingUp },
    { value: "100%",  label: "ID Verified",       icon: Shield },
  ];

  return (
    <>
      <AgeGate />
      <InstallPrompt />

      <div className="min-h-screen bg-background overflow-x-hidden">

        {/* ── NAVBAR ──────────────────────────────────────────────────── */}
        <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 bg-black/50 backdrop-blur-xl border-b border-white/5">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-gold/15 border border-gold/30">
              <ModelIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gold" />
            </div>
            <span className="text-base sm:text-lg font-black text-gold-gradient font-playfair whitespace-nowrap">
              Dony&apos;s World
            </span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button asChild variant="ghost" size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10 text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild size="sm"
              className="bg-gold-gradient text-black font-black hover:opacity-90 rounded-xl text-xs sm:text-sm h-8 sm:h-9 px-4 sm:px-5">
              <Link href="/register">Join Now</Link>
            </Button>
          </div>
        </nav>

        {/* ── HERO ────────────────────────────────────────────────────── */}
        <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-20 pb-12 overflow-hidden">

          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 90% 70% at 50% 40%, hsl(43 62% 52% / 0.10) 0%, transparent 65%)" }} />

          <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(hsl(43 62% 52%) 1px, transparent 1px), linear-gradient(90deg, hsl(43 62% 52%) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }} />

          <div className="relative inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/8 px-3 sm:px-4 py-1.5 text-[10px] sm:text-[11px] text-gold font-black tracking-wider sm:tracking-widest uppercase mb-6 sm:mb-7 animate-fade-in max-w-[90vw] text-center">
            <div className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse shrink-0" />
            Nigeria&apos;s #1 Verified Model Platform
          </div>

          <h1 className="relative font-black leading-[0.88] tracking-tight mb-5 animate-slide-up font-playfair
                         text-5xl xs:text-6xl sm:text-7xl md:text-8xl">
            <span className="text-gold-gradient">Dony&apos;s</span>
            <br />
            <span className="text-foreground">World</span>
          </h1>

          <p className="relative text-sm sm:text-base text-white/50 max-w-[280px] sm:max-w-sm mb-8 leading-relaxed animate-fade-in"
            style={{ animationDelay: "0.1s" }}>
            Connect with verified models near you — private, fast, and secured.
          </p>

          <div className="relative flex flex-col sm:flex-row gap-3 mb-10 sm:mb-12 animate-fade-in w-full max-w-[320px] sm:max-w-none sm:w-auto"
            style={{ animationDelay: "0.15s" }}>
            <Button asChild size="lg"
              className="h-12 px-8 bg-gold-gradient text-black font-black hover:opacity-90 gold-glow rounded-xl text-sm gap-2 w-full sm:w-auto">
              <Link href="/register">
                Join as Client
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline"
              className="h-12 px-8 border-white/10 text-white/70 hover:bg-white/5 hover:text-white hover:border-gold/30 rounded-xl text-sm w-full sm:w-auto">
              <Link href="/register?role=model">Become a Model</Link>
            </Button>
          </div>

          <div className="relative w-full max-w-sm sm:max-w-lg animate-fade-in px-1"
            style={{ animationDelay: "0.2s" }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {STATS.map(({ value, label, icon: Icon }) => (
                <div key={label}
                  className="rounded-2xl border border-white/5 bg-white/3 backdrop-blur-sm p-3 sm:p-4 text-center space-y-1.5">
                  <div className="flex justify-center">
                    <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-gold/10">
                      <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gold" />
                    </div>
                  </div>
                  <p className="text-lg sm:text-xl md:text-2xl font-black text-gold-gradient">{value}</p>
                  <p className="text-[9px] sm:text-[10px] text-white/40 font-medium leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SAFETY BANNER ───────────────────────────────────────────── */}
        <section className="px-4 sm:px-6 py-14 sm:py-16 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-3xl overflow-hidden border border-gold/15 relative">
              <div className="absolute inset-y-0 left-0 w-1.5 bg-gold-gradient" />

              <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 p-6 sm:p-8 md:p-10 bg-card">
                <div className="flex-1 space-y-5 w-full">
                  <div>
                    <p className="text-[10px] font-black text-gold tracking-widest uppercase mb-2">Trust & Safety</p>
                    <h2 className="text-2xl sm:text-3xl sm:text-4xl font-black text-foreground font-playfair leading-tight">
                      Your Safety<br />
                      <span className="text-gold-gradient">Comes First</span>
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {[
                      { icon: CheckCircle2, text: "All models submit legal ID before approval" },
                      { icon: Lock,         text: "No direct bank transfers — coins only" },
                      { icon: Shield,       text: "Coupon code protects every transaction" },
                      { icon: Star,         text: "Admin-verified before going live" },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15">
                          <Icon className="h-3 w-3 text-gold" />
                        </div>
                        <span className="text-xs sm:text-sm text-muted-foreground">{text}</span>
                      </div>
                    ))}
                  </div>

                  <Button asChild
                    className="bg-gold-gradient text-black font-black hover:opacity-90 rounded-xl h-11 px-7 w-full sm:w-auto">
                    <Link href="/register">Get Started Free</Link>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full md:w-64 shrink-0">
                  {[
                    { value: "500+", label: "Active Models", color: "border-gold/20 bg-gold/5" },
                    { value: "24/7", label: "Available",     color: "border-emerald-500/20 bg-emerald-500/5" },
                    { value: "36+",  label: "States",        color: "border-blue-500/20 bg-blue-500/5" },
                    { value: "0",    label: "Scam Reports",  color: "border-violet-500/20 bg-violet-500/5" },
                  ].map(({ value, label, color }) => (
                    <div key={label} className={`rounded-2xl border p-3 sm:p-4 text-center ${color}`}>
                      <p className="text-xl sm:text-2xl font-black text-foreground">{value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
        <section className="px-4 sm:px-6 py-14 sm:py-16 border-t border-white/5">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8 sm:mb-10">
              <p className="text-[10px] font-black text-gold tracking-widest uppercase mb-2">Simple Process</p>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground font-playfair">How It Works</h2>
            </div>

            <div className="space-y-3">
              {[
                { step: "01", icon: Users,  title: "Create Your Account", desc: "Sign up as a client in seconds. Age verification required." },
                { step: "02", icon: Coins,  title: "Fund Your Wallet",    desc: "1 Dony's Coin = ₦1. Fund securely via bank transfer." },
                { step: "03", icon: MapPin, title: "Browse Local Models", desc: "We detect your location and show verified models near you." },
                { step: "04", icon: Zap,    title: "Make an Offer",       desc: "Send a coin offer. Model accepts → you get a coupon receipt." },
              ].map(({ step, icon: Icon, title, desc }) => (
                <div key={step}
                  className="flex gap-3 sm:gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5 hover:border-gold/20 transition-colors group">
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gold/10 border border-gold/20 group-hover:bg-gold/15 transition-colors">
                      <Icon className="h-4 w-4 text-gold" />
                    </div>
                    <span className="text-[10px] font-black text-gold/30">{step}</span>
                  </div>
                  <div className="pt-1 min-w-0">
                    <h3 className="font-bold text-foreground text-sm">{title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CONNECT BANNER ──────────────────────────────────────────── */}
        <section className="px-4 sm:px-6 py-14 sm:py-16 border-t border-white/5">
          <div className="max-w-2xl mx-auto">
            <div className="rounded-3xl border border-gold/20 bg-card overflow-hidden">
              <div className="h-1 bg-gold-gradient" />
              <div className="p-6 sm:p-8 md:p-10 text-center space-y-5">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground font-playfair">
                  Connect with Verified Models<br />
                  <span className="text-gold-gradient">In Your City</span>
                </h2>
                <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-xs sm:max-w-sm mx-auto">
                  {[
                    { icon: Shield,       label: "No Scams" },
                    { icon: Lock,         label: "Private" },
                    { icon: CheckCircle2, label: "Verified" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label}
                      className="rounded-xl bg-secondary border border-border py-3 px-2 text-center space-y-1.5">
                      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gold mx-auto" />
                      <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button asChild
                    className="h-11 px-8 bg-gold-gradient text-black font-black hover:opacity-90 rounded-xl gold-glow w-full sm:w-auto">
                    <Link href="/register">Join as Client</Link>
                  </Button>
                  <Button asChild variant="outline"
                    className="h-11 px-8 border-gold/30 text-gold hover:bg-gold/8 rounded-xl w-full sm:w-auto">
                    <Link href="/register?role=model">Register as Model</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────── */}
        <footer className="border-t border-white/5 px-4 sm:px-6 py-8">
          <div className="max-w-2xl mx-auto flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <ModelIcon className="h-4 w-4 text-gold/60" />
              <span className="text-sm font-black text-gold-gradient font-playfair">Dony&apos;s World</span>
            </div>
            <p className="text-[11px] text-white/20 text-center">
              &copy; {new Date().getFullYear()} Dony&apos;s World — For adults 18+ only. All rights reserved.
            </p>
            <div className="flex gap-4 text-[10px] text-white/15">
              <span>Private</span><span>·</span><span>Secure</span><span>·</span><span>Verified</span>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}