"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  BellOff,
  CheckCheck,
  Loader2,
  HandCoins,
  Wallet,
  ShieldCheck,
  User,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

interface NotificationsClientProps {
  notifications: Notification[];
}

// ─────────────────────────────────────────────
// ICON RESOLVER
// ─────────────────────────────────────────────

function getNotificationIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("offer")) return HandCoins;
  if (t.includes("coin") || t.includes("wallet") || t.includes("redeem"))
    return Wallet;
  if (
    t.includes("approved") ||
    t.includes("rejected") ||
    t.includes("suspended") ||
    t.includes("reinstated")
  )
    return ShieldCheck;
  if (t.includes("face") || t.includes("reveal")) return User;
  return Info;
}

function getNotificationColor(title: string, isRead: boolean) {
  if (isRead) return "text-muted-foreground bg-muted/50";
  const t = title.toLowerCase();
  if (t.includes("approved") || t.includes("accepted") || t.includes("coin"))
    return "text-emerald-400 bg-emerald-500/10";
  if (t.includes("rejected") || t.includes("suspended"))
    return "text-destructive bg-destructive/10";
  if (t.includes("offer")) return "text-gold bg-gold/10";
  return "text-blue-400 bg-blue-500/10";
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export function NotificationsClient({
  notifications,
}: NotificationsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [localNotifications, setLocalNotifications] =
    useState<Notification[]>(notifications);

  const unreadCount = localNotifications.filter((n) => !n.isRead).length;

  async function markAllRead() {
    if (unreadCount === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (!res.ok) throw new Error("Failed");
      setLocalNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
      router.refresh();
    } catch {
      toast({
        title: "Failed to mark notifications as read",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function markOneRead(id: string) {
    setLocalNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    router.refresh();
  }

  // Group by date
  const grouped = localNotifications.reduce(
    (acc, notification) => {
      const date = new Date(notification.createdAt).toLocaleDateString(
        "en-NG",
        { day: "numeric", month: "long", year: "numeric" }
      );
      if (!acc[date]) acc[date] = [];
      acc[date].push(notification);
      return acc;
    },
    {} as Record<string, Notification[]>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── HEADER ────────────────────────────── */}
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
            : "You're all caught up"
        }
        action={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              disabled={loading}
              className="border-gold/30 text-gold hover:bg-gold/10 gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {/* ── UNREAD BADGE ──────────────────────── */}
      {unreadCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge className="bg-gold/10 text-gold border border-gold/20 gap-1.5">
            <Bell className="h-3 w-3" />
            {unreadCount} unread
          </Badge>
        </div>
      )}

      {/* ── EMPTY STATE ───────────────────────── */}
      {localNotifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No notifications yet"
          description="You'll be notified here about offers, wallet activity, and account updates."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="space-y-2">
              {/* Date label */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                {date}
              </p>

              {/* Notifications */}
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {items.map((notification) => {
                  const Icon = getNotificationIcon(notification.title);
                  const colorClass = getNotificationColor(
                    notification.title,
                    notification.isRead
                  );

                  const content = (
                    <div
                      key={notification.id}
                      onClick={() =>
                        !notification.isRead && markOneRead(notification.id)
                      }
                      className={cn(
                        "flex items-start gap-3 px-4 py-3.5 transition-colors",
                        !notification.isRead
                          ? "bg-gold/[0.03] hover:bg-gold/5 cursor-pointer"
                          : "hover:bg-secondary/50"
                      )}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full mt-0.5",
                          colorClass
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-sm font-semibold leading-snug",
                              notification.isRead
                                ? "text-muted-foreground"
                                : "text-foreground"
                            )}
                          >
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!notification.isRead && (
                              <div className="h-2 w-2 rounded-full bg-gold shrink-0" />
                            )}
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(
                                notification.createdAt
                              ).toLocaleTimeString("en-NG", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                        <p
                          className={cn(
                            "text-xs leading-relaxed",
                            notification.isRead
                              ? "text-muted-foreground/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  );

                  return notification.link ? (
                    <Link
                      key={notification.id}
                      href={notification.link}
                      onClick={() =>
                        !notification.isRead && markOneRead(notification.id)
                      }
                      className="block"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={notification.id}>{content}</div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}