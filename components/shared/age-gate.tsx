"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield } from "lucide-react";
import { ModelIcon } from "@/components/shared/model-icon";

export function AgeGate() {
  const [show, setShow]     = useState(false);
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/98 backdrop-blur-md">
      {denied ? (
        <div className="flex flex-col items-center gap-6 px-8 text-center animate-fade-in">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-foreground font-playfair">Access Denied</h2>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              You must be 18 years or older to access Dony&apos;s World. Please close this tab.
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-sm mx-4 animate-fade-in">
          <div className="h-1 w-full rounded-t-2xl bg-gold-gradient" />
          <div className="rounded-b-2xl border border-t-0 border-border bg-card shadow-2xl shadow-black/80">

            {/* Logo section */}
            <div className="flex flex-col items-center gap-4 pt-8 pb-6 px-8">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gold/10 border-2 border-gold/30 pulse-glow">
                  <ModelIcon className="h-9 w-9 text-gold" />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-gold/15 border border-gold/30">
                  <Shield className="h-3.5 w-3.5 text-gold" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <h1 className="text-3xl font-black text-gold-gradient font-playfair">
                  Dony&apos;s World
                </h1>
                <p className="text-xs text-muted-foreground tracking-widest uppercase font-medium">
                  Adults Only · 18+
                </p>
              </div>
            </div>

            {/* Notice box */}
            <div className="mx-6 mb-6 rounded-xl border border-gold/15 bg-gold/5 p-4 space-y-1.5">
              <p className="text-center text-sm font-bold text-foreground">
                This platform contains adult content
              </p>
              <p className="text-center text-xs text-muted-foreground leading-relaxed">
                By entering you confirm you are{" "}
                <span className="text-gold font-bold">18 years or older</span>{" "}
                and legally permitted to view this content in your jurisdiction.
              </p>
            </div>

            {/* CTA */}
            <div className="px-6 pb-8 space-y-3">
              <p className="text-center text-sm font-bold text-foreground">
                Are you 18 years or older?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleDeny}
                  variant="outline"
                  className="h-12 text-sm border-border hover:border-destructive/50 hover:text-destructive hover:bg-destructive/5 transition-all rounded-xl"
                >
                  No, exit
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="h-12 text-sm bg-gold-gradient text-black font-black hover:opacity-90 rounded-xl gold-glow"
                >
                  Yes, I&apos;m 18+
                </Button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground leading-relaxed">
                By entering you agree to our Terms of Service and confirm legal age.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}