import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AgeGate } from "@/components/shared/age-gate";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { Shield, MapPin, Coins, Crown } from "lucide-react";

const ROLE_REDIRECTS: Record<Role, string> = {
  CLIENT: "/client/dashboard",
  MODEL:  "/model/dashboard",
  ADMIN:  "/admin/dashboard",
};

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect(ROLE_REDIRECTS[session.user.role]);

  return (
    <>
      <AgeGate />
      <InstallPrompt />

      <main className="min-h-screen flex flex-col bg-background">

        {/* ── NAVBAR ─────────────────────────────────── */}
        <nav className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-50">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 border border-gold/20">
              <Crown className="h-4 w-4 text-gold" />
            </div>
            <span className="text-xl font-bold text-gold-gradient tracking-wide">
              Dony&apos;s World
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild size="sm"
              className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 rounded-xl">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </nav>

        {/* ── HERO ───────────────────────────────────── */}
        <section className="flex-1 flex flex-col items-center justify-center text-center px-5 py-24 space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs text-gold font-medium tracking-wider uppercase">
            <Shield className="h-3 w-3" />
            Verified Models Only
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight">
            <span className="text-gold-gradient">Dony&apos;s</span>
            <br />
            <span className="text-foreground">World</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-md">
            Connect with verified models in your state. Private, secure, and
            powered by Dony&apos;s Coins.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg"
              className="h-12 px-8 bg-gold-gradient text-primary-foreground font-bold hover:opacity-90 gold-glow rounded-xl">
              <Link href="/register">Join as Client</Link>
            </Button>
            <Button asChild size="lg" variant="outline"
              className="h-12 px-8 border-gold/40 text-gold hover:bg-gold/10 rounded-xl">
              <Link href="/register?role=model">Become a Model</Link>
            </Button>
          </div>
        </section>

        {/* ── FEATURES ───────────────────────────────── */}
        <section className="px-5 py-14 border-t border-border">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: MapPin,
                title: "Find Models Near You",
                desc: "Auto-detects your location and shows verified models in your state first.",
              },
              {
                icon: Coins,
                title: "Dony's Coins",
                desc: "1 coin = ₦1. Fund your wallet and make secure offers to models.",
              },
              {
                icon: Shield,
                title: "Verified & Safe",
                desc: "Every model submits legal documents before admin approval. No fakes.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title}
                className="rounded-2xl border border-border bg-card p-6 space-y-3 hover:-translate-y-1 hover:border-gold/30 transition-all duration-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 border border-gold/20">
                  <Icon className="h-5 w-5 text-gold" />
                </div>
                <h3 className="font-bold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────── */}
        <footer className="border-t border-border px-5 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Dony&apos;s World &mdash; Adults only (18+). All rights reserved.
          </p>
        </footer>

      </main>
    </>
  );
}