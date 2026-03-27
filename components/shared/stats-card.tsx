import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatsCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 space-y-3 card-hover",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10 border border-gold/20">
          <Icon className="h-4 w-4 text-gold" />
        </div>
      </div>
      <div className="space-y-0.5">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && (
          <p
            className={cn(
              "text-xs font-medium",
              trend === "up" && "text-emerald-400",
              trend === "down" && "text-destructive",
              trend === "neutral" && "text-muted-foreground",
              !trend && "text-muted-foreground"
            )}
          >
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}