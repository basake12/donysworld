"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Bell, BellOff, CheckCheck, Loader2,
  HandCoins, Wallet, ShieldCheck, User, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// ─── TYPES ──────────────────────────────────────

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

// ─── HELPERS ────────────────────────────────────

function getIconConfig(title: string, isRead: boolean): {
  Icon: React.ElementType;
  bg: string;
  text: string;
} {
  const t = title.toLowerCase();

  if (!isRead) {
    if (t.includes("offer"))
      return { Icon: HandCoins, bg: "bg-gold/15 border-gold/20", text: "text-gold" };
    if (t.includes("approved") || t.includes("accepted") || t.includes("coin"))
      return { Icon: ShieldCheck, bg: "bg-emerald-500/15 border-emerald-500/20", text: "text-emerald-400" };
    if (t.includes("rejected") || t.includes("suspended"))
      return { Icon: ShieldCheck, bg: "bg-destructive/15 border-destructive/20", text: "text-destructive" };
    if (t.includes("wallet") || t.includes("redeem"))
      return { Icon: Wallet, bg: "bg-blue-500/15 border-blue-500/20", text: "text-blue-400" };
    if (t.includes("face") || t.includes("reveal"))
      return { Icon: User, bg: "bg-violet-500/15 border-violet-500/20", text: "text-violet-400" };
  }

  return { Icon: Info, bg: "bg-secondary border-border", text: "text-muted-foreground" };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

// ─── COMPONENT ──────────────────────────────────

export function NotificationsClient({ notifications }: NotificationsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading]                   = useState(false);
  const [localNotifications, setLocalNotifications] = useState<Notification[]>(notifications);

  const unreadCount = localNotifications.filter((n) => !n.isRead).length;

  async function markAllRead() {
    if (unreadCount === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (!res.ok) throw new Error("Failed");
      setLocalNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      router.refresh();
    } catch {
      toast({ title: "Failed to mark notifications as read", variant: "destructive" });
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

  // Group by date label
  const grouped = localNotifications.reduce((acc, n) => {
    const label = formatDateLabel(n.createdAt);
    if (!acc[label]) acc[label] = [];
    acc[label].push(n);
    return acc;
  }, {} as Record<string, Notification[]>);

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── HEADER ──────────────────────────── */}
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} unread`
            : "You're all caught up"
        }
        action={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              disabled={loading}
              className="border-gold/30 text-gold hover:bg-gold/10 rounded-xl gap-2 h-9"
            >
              {loading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {/* ── UNREAD COUNT PILL ───────────────── */}
      {unreadCount > 0 && (
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/8 px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-gold animate-pulse" />
          <span className="text-xs font-bold text-gold">
            {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* ── EMPTY STATE ─────────────────────── */}
      {localNotifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No notifications yet"
          description="You'll be notified here about offers, wallet activity, and account updates."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel} className="space-y-2">

              {/* Date label */}
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest shrink-0">
                  {dateLabel}
                </p>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Notification list */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                {items.map((notification) => {
                  const { Icon, bg, text } = getIconConfig(notification.title, notification.isRead);

                  const inner = (
                    <div
                      key={notification.id}
                      onClick={() => !notification.isRead && markOneRead(notification.id)}
                      className={cn(
                        "flex items-start gap-3 px-4 py-4 transition-colors",
                        !notification.isRead
                          ? "bg-gold/[0.025] hover:bg-gold/5 cursor-pointer"
                          : "hover:bg-secondary/40"
                      )}
                    >
                      {/* Icon */}
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border mt-0.5",
                        bg
                      )}>
                        <Icon className={cn("h-4 w-4", text)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <p className={cn(
                            "text-sm font-bold leading-snug",
                            notification.isRead ? "text-muted-foreground" : "text-foreground"
                          )}>
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!notification.isRead && (
                              <div className="h-2 w-2 rounded-full bg-gold shrink-0 mt-0.5" />
                            )}
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatTime(notification.createdAt)}
                            </span>
                          </div>
                        </div>
                        <p className={cn(
                          "text-xs leading-relaxed",
                          notification.isRead
                            ? "text-muted-foreground/60"
                            : "text-muted-foreground"
                        )}>
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  );

                  return notification.link ? (
                    <Link
                      key={notification.id}
                      href={notification.link}
                      onClick={() => !notification.isRead && markOneRead(notification.id)}
                      className="block"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={notification.id}>{inner}</div>
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