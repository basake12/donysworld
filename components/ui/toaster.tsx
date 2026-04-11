"use client";

import * as React from "react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2 p-0"
      )}
    >
      {toasts.map(({ id, title, description, action, variant, open }) =>
        open !== false ? (
          <div
            key={id}
            data-variant={variant}
            className={cn(
              "group relative flex w-full items-start gap-3 overflow-hidden rounded-xl p-4 text-sm shadow-lg ring-1 transition-all",
              "animate-in slide-in-from-bottom-4 fade-in-0",
              variant === "destructive"
                ? "bg-destructive/10 text-destructive ring-destructive/20 dark:bg-destructive/20 dark:ring-destructive/30"
                : "bg-popover text-popover-foreground ring-foreground/10"
            )}
          >
            <div className="flex-1 grid gap-1">
              {title && (
                <p className="font-medium leading-snug">{title}</p>
              )}
              {description && (
                <p className="text-xs text-muted-foreground leading-snug">
                  {description}
                </p>
              )}
              {action && <div className="mt-2">{action}</div>}
            </div>
            <button
              onClick={() => dismiss(id)}
              className={cn(
                "shrink-0 rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                variant === "destructive"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        ) : null
      )}
    </div>
  );
}