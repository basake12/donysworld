"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle } from "lucide-react";

export function AgeGate() {
  const [show, setShow] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const verified = sessionStorage.getItem("age-verified");
    if (!verified) setShow(true);
  }, []);

  function handleConfirm() {
    sessionStorage.setItem("age-verified", "true");
    setShow(false);
  }

  function handleDeny() {
    setDenied(true);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md">
      {denied ? (
        // ── DENIED STATE ──────────────────────────────────
        <div className="flex flex-col items-center gap-6 px-8 text-center animate-fade-in">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              Access Denied
            </h2>
            <p className="text-muted-foreground max-w-sm">
              You must be 18 years or older to access Dony&apos;s World.
              Please close this tab.
            </p>
          </div>
        </div>
      ) : (
        // ── VERIFICATION STATE ────────────────────────────
        <div className="w-full max-w-md mx-4 animate-fade-in">
          {/* Gold top border */}
          <div className="h-1 w-full rounded-t-2xl bg-gold-gradient" />

          <div className="rounded-b-2xl border border-t-0 border-border bg-card p-8 shadow-2xl space-y-8">
            {/* Logo area */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold bg-gold/10 gold-glow">
                <Shield className="h-10 w-10 text-gold" />
              </div>
              <div className="text-center space-y-1">
                <h1 className="text-3xl font-bold text-gold-gradient">
                  Dony&apos;s World
                </h1>
                <p className="text-sm text-muted-foreground tracking-widest uppercase">
                  Adults Only Platform
                </p>
              </div>
            </div>

            {/* Warning */}
            <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 space-y-2">
              <p className="text-center text-sm font-medium text-foreground">
                This platform contains adult content and services.
              </p>
              <p className="text-center text-sm text-muted-foreground">
                By entering, you confirm that you are{" "}
                <span className="text-gold font-semibold">18 years or older</span>{" "}
                and legally permitted to view such content in your jurisdiction.
              </p>
            </div>

            {/* Age question */}
            <div className="space-y-3">
              <p className="text-center font-semibold text-foreground text-lg">
                Are you 18 years or older?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleDeny}
                  variant="outline"
                  className="h-12 text-base border-border hover:border-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
                >
                  No, I&apos;m not
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="h-12 text-base bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 transition-all gold-glow"
                >
                  Yes, I&apos;m 18+
                </Button>
              </div>
            </div>

            {/* Footer note */}
            <p className="text-center text-xs text-muted-foreground">
              By entering you agree to our Terms of Service and confirm you
              are of legal age in your country.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}