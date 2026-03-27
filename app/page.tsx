import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { AgeGate } from "@/components/shared/age-gate";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { Shield, Star, MapPin, Coins, Crown, Eye } from "lucide-react";

const ROLE_REDIRECTS: Record<Role, string> = {
  CLIENT: "/client/dashboard",
  MODEL:  "/model/dashboard",
  ADMIN:  "/admin/dashboard",
};

export const revalidate = 60;

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect(ROLE_REDIRECTS[session.user.role]);

  // Fetch a sample of active models for the showcase
  const showcaseModels = await prisma.modelProfile.findMany({
    where: {
      status: "ACTIVE",
      age: { gt: 0 },
      city: { not: "" },
    },
    orderBy: { id: "desc" },
    take: 12,
    select: {
      id: true,
      profilePictureUrl: true,
      city: true,
      state: true,
      age: true,
      bodyType: true,
      user: {
        select: { nickname: true, fullName: true },
      },
    },
  });

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
        <section className="flex flex-col items-center justify-center text-center px-5 pt-16 pb-10 space-y-6">
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

        {/* ── MODEL SHOWCASE ─────────────────────────── */}
        {showcaseModels.length > 0 && (
          <section className="px-5 pb-16 space-y-6">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-gold fill-gold" />
                <h2 className="text-xl font-bold text-foreground">
                  Top Verified Models
                </h2>
              </div>
              <Link href="/register"
                className="text-xs text-gold hover:text-gold-light font-medium transition-colors">
                Sign up to view all →
              </Link>
            </div>

            {/* Model grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {showcaseModels.map((model) => (
                <Link
                  key={model.id}
                  href="/register"
                  className="group flex flex-col rounded-2xl border border-border bg-card overflow-hidden hover:border-gold/40 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/40 transition-all duration-200"
                >
                  {/* Photo */}
                  <div className="relative aspect-[3/4] bg-secondary overflow-hidden">
                    <Image
                      src={model.profilePictureUrl}
                      alt="Model"
                      fill
                      className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
                    />

                    {/* Dark gradient */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

                    {/* Premium badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-gold px-2 py-0.5">
                      <Crown className="h-2.5 w-2.5 text-primary-foreground" />
                      <span className="text-[9px] font-bold text-primary-foreground uppercase tracking-wide">
                        Verified
                      </span>
                    </div>

                    {/* Location bottom */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5 text-gold shrink-0" />
                      <span className="text-[10px] text-white/90 font-medium truncate">
                        {model.city}, {model.state}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-2.5">
                    <div>
                      <p className="font-semibold text-foreground text-sm truncate">
                        {model.user.nickname || model.user.fullName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {model.age > 0 ? `${model.age} yrs` : ""}{model.age > 0 && model.bodyType ? " · " : ""}{model.bodyType?.replace("_", " ")}
                      </p>
                    </div>

                    {/* View Profile button */}
                    <div className="rounded-xl bg-gold-gradient px-3 py-1.5 text-center">
                      <span className="text-[11px] font-bold text-primary-foreground">
                        View Profile
                      </span>
                    </div>

                    {/* Sign in hint */}
                    <p className="text-[10px] text-muted-foreground text-center">
                      Sign in to connect
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {/* See more CTA */}
            <div className="flex justify-center pt-4">
              <Button asChild
                className="bg-gold-gradient text-primary-foreground font-bold hover:opacity-90 rounded-xl px-8 h-11 gold-glow">
                <Link href="/register">
                  <Eye className="mr-2 h-4 w-4" />
                  Sign Up to See All Models
                </Link>
              </Button>
            </div>
          </section>
        )}

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
        <footer className="border-t border-border px-5 py-6 text-center mt-auto">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Dony&apos;s World &mdash; Adults only (18+). All rights reserved.
          </p>
        </footer>

      </main>
    </>
  );
}