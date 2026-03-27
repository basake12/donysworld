"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Store event at module level so it persists across re-renders
let _savedPrompt: BeforeInstallPromptEvent | null = null;

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [prompted, setPrompted] = useState(false);

  useEffect(() => {
    // Already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check cooldown (8 hours)
    const dismissed = localStorage.getItem("pwa-dismissed");
    if (dismissed && Date.now() - parseInt(dismissed) < 8 * 3600 * 1000) return;

    const ua = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) && !(navigator as any).standalone;
    setIsIOS(ios);

    if (ios) {
      // iOS: show after 2s always (can't auto-install)
      const t = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(t);
    }

    // Android/Desktop: listen for the event
    function onPrompt(e: Event) {
      e.preventDefault();
      _savedPrompt = e as BeforeInstallPromptEvent;
      setTimeout(() => setShow(true), 1500);
    }

    // If event already fired before component mounted (fast page)
    if (_savedPrompt) {
      setTimeout(() => setShow(true), 1500);
    }

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
      // prompt() can only be called once — clear
      _savedPrompt = null;
      setShow(false);
    }
  }

  if (isInstalled || !show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9998] md:left-auto md:right-6 md:w-96 animate-fade-in">
      <div className="h-0.5 w-full rounded-t-2xl bg-gold-gradient" />
      <div className="rounded-b-2xl border border-t-0 border-border bg-card/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/50">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 border border-gold/20">
            <Smartphone className="h-5 w-5 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm">
              Add Dony&apos;s World to Home Screen
            </p>
            {isIOS ? (
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Tap <span className="text-gold">Share</span> → <span className="text-gold">Add to Home Screen</span> for the best experience.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Fast, full-screen experience — works offline too.
              </p>
            )}
          </div>
          <button onClick={dismiss}
            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!isIOS && _savedPrompt && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={dismiss} variant="ghost" size="sm"
              className="text-muted-foreground hover:text-foreground">
              Later
            </Button>
            <Button onClick={install} size="sm"
              className="bg-gold-gradient text-primary-foreground font-bold hover:opacity-90 rounded-xl">
              Add to Home Screen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}