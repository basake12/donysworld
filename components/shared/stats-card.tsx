import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

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
  const TrendIcon =
    trend === "up" ? TrendingUp :
    trend === "down" ? TrendingDown :
    Minus;

  const trendColor =
    trend === "up"   ? "text-emerald-400" :
    trend === "down" ? "text-destructive" :
    "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 space-y-3 hover:border-gold/20 transition-all duration-200",
        className
      )}
    >
      {/* Top row: icon */}
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/8 border border-gold/15">
          <Icon className="h-4 w-4 text-gold" />
        </div>
        {trend && (
          <TrendIcon className={cn("h-3.5 w-3.5 mt-0.5", trendColor)} />
        )}
      </div>

      {/* Value */}
      <div className="space-y-0.5">
        <p className="text-2xl font-black text-foreground leading-none">{value}</p>
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {sub && (
          <p className={cn("text-[11px] font-medium mt-1", trendColor)}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}