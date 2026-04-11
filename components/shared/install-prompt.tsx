"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Crown, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let _savedPrompt: BeforeInstallPromptEvent | null = null;

export function InstallPrompt() {
  const [show, setShow]           = useState(false);
  const [isIOS, setIsIOS]         = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const dismissed = localStorage.getItem("pwa-dismissed");
    if (dismissed && Date.now() - parseInt(dismissed) < 8 * 3600 * 1000) return;

    const ua  = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) && !(navigator as any).standalone;
    setIsIOS(ios);

    if (ios) {
      const t = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(t);
    }

    function onPrompt(e: Event) {
      e.preventDefault();
      _savedPrompt = e as BeforeInstallPromptEvent;
      setTimeout(() => setShow(true), 1500);
    }

    if (_savedPrompt) setTimeout(() => setShow(true), 1500);

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem("pwa-dismissed", Date.now().toString());
    setShow(false);
  }

  async function install() {
    if (!_savedPrompt) return;
    try {
      await _savedPrompt.prompt();
      const result = await _savedPrompt.userChoice;
      if (result.outcome === "accepted") {
        setShow(false);
        _savedPrompt = null;
      }
    } catch {
      _savedPrompt = null;
      setShow(false);
    }
  }

  if (isInstalled || !show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9998] md:left-auto md:right-6 md:w-[360px] animate-slide-up">
      <div className="rounded-2xl border border-border bg-card/98 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">
        <div className="h-0.5 bg-gold-gradient" />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 border border-gold/20">
              <Crown className="h-5 w-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground text-sm">
                Add to Home Screen
              </p>
              {isIOS ? (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Tap <span className="text-gold font-semibold">Share</span> →{" "}
                  <span className="text-gold font-semibold">Add to Home Screen</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Full-screen experience — works offline too
                </p>
              )}
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {!isIOS && _savedPrompt && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button onClick={dismiss} variant="ghost" size="sm"
                className="text-muted-foreground hover:text-foreground rounded-xl">
                Later
              </Button>
              <Button onClick={install} size="sm"
                className="bg-gold-gradient text-black font-black hover:opacity-90 rounded-xl gap-1.5">
                <Smartphone className="h-3.5 w-3.5" />
                Install
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}