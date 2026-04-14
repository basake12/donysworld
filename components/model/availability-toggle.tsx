"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface AvailabilityToggleProps {
  initialValue: boolean;
}

export function AvailabilityToggle({ initialValue }: AvailabilityToggleProps) {
  const router = useRouter();
  const [available, setAvailable] = useState(initialValue);
  const [loading, setLoading]     = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/model/availability", { method: "PATCH" });
      const data = await res.json();

      if (!res.ok) {
        toast.error("Could not update availability", {
          description: data.error ?? "Please try again.",
          duration: 4000,
        });
        return;
      }

      setAvailable(data.isAvailable);
      toast.success(
        data.isAvailable ? "You are now Available" : "You are now Unavailable",
        {
          description: data.isAvailable
            ? "Clients can now see and send you offers."
            : "You are hidden from client browsing.",
          duration: 4000,
        }
      );
      router.refresh();
    } catch {
      toast.error("Something went wrong", { description: "Please try again.", duration: 4000 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-foreground">Availability</p>
        <p className="text-xs text-muted-foreground">
          {available
            ? "Clients can find and send you offers"
            : "You are hidden from client browsing"}
        </p>
      </div>

      <button
        onClick={toggle}
        disabled={loading}
        aria-label={available ? "Go unavailable" : "Go available"}
        className={[
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 disabled:cursor-not-allowed",
          available
            ? "border-gold bg-gold"
            : "border-border bg-secondary",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-200",
            available ? "translate-x-5" : "translate-x-0.5",
          ].join(" ")}
        >
          {loading && (
            <Loader2 className="h-3 w-3 animate-spin text-gold" />
          )}
        </span>
      </button>
    </div>
  );
}