import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border bg-card/30 py-16 px-6 text-center",
        className
      )}
    >
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/8 border border-gold/15">
          <Icon className="h-7 w-7 text-gold/70" />
        </div>
        {/* Subtle glow ring */}
        <div className="absolute inset-0 rounded-2xl bg-gold/5 blur-xl -z-10" />
      </div>

      <div className="space-y-1.5 max-w-xs">
        <p className="font-bold text-foreground">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}