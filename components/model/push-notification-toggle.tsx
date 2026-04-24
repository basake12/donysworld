"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { cn } from "@/lib/utils";

/**
 * PushNotificationToggle
 *
 * Matches the visual style of AvailabilityToggle — a rounded card with a
 * toggle switch. Shows contextual messaging based on permission state.
 *
 * Drop this anywhere in the model dashboard or profile page.
 */
export function PushNotificationToggle() {
  const { status, subscribe, unsubscribe } = usePushNotifications();

  // Hide entirely on unsupported browsers (old Safari, Firefox Android, etc.)
  if (status === "unsupported") return null;

  const isGranted  = status === "granted";
  const isLoading  = status === "loading";
  const isDenied   = status === "denied";

  function handleToggle() {
    if (isGranted) {
      unsubscribe();
    } else if (!isDenied && !isLoading) {
      subscribe();
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
            isGranted
              ? "bg-gold/10 border-gold/20"
              : "bg-secondary border-border"
          )}>
            {isGranted
              ? <BellRing className="h-4 w-4 text-gold" />
              : isDenied
              ? <BellOff className="h-4 w-4 text-muted-foreground" />
              : <Bell className="h-4 w-4 text-muted-foreground" />
            }
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">
              Offer Notifications
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {isGranted
                ? "Your phone pings when a new offer arrives"
                : isDenied
                ? "Blocked in browser — enable in your device settings"
                : "Get notified instantly when clients send offers"}
            </p>
          </div>
        </div>

        {/* Toggle — hidden if browser blocked permission */}
        {!isDenied && (
          <button
            type="button"
            disabled={isLoading}
            onClick={handleToggle}
            aria-label={isGranted ? "Disable offer notifications" : "Enable offer notifications"}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50",
              isGranted ? "bg-gold" : "bg-secondary border border-border"
            )}
          >
            <span className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200",
              isGranted ? "translate-x-6" : "translate-x-1"
            )} />
          </button>
        )}

        {/* Blocked state — show a small label instead of toggle */}
        {isDenied && (
          <span className="shrink-0 text-[10px] font-bold text-destructive/70 bg-destructive/10 border border-destructive/20 rounded-full px-2 py-0.5">
            Blocked
          </span>
        )}
      </div>
    </div>
  );
}