import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  CheckCircle2, Clock, XCircle, Phone, Coins,
  ShieldCheck, ListOrdered, Users, ArrowLeft,
} from "lucide-react";
import { formatCoins } from "@/lib/coins";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  PENDING:   "text-amber-400   bg-amber-400/10   border-amber-400/20",
  ACCEPTED:  "text-blue-400    bg-blue-400/10    border-blue-400/20",
  COMPLETED: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  REJECTED:  "text-red-400     bg-red-400/10     border-red-400/20",
  CANCELLED: "text-zinc-400    bg-zinc-400/10    border-zinc-400/20",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  PENDING:   Clock,
  ACCEPTED:  ShieldCheck,
  COMPLETED: CheckCircle2,
  REJECTED:  XCircle,
  CANCELLED: XCircle,
};

const MEET_STYLE: Record<string, string> = {
  SHORT:     "text-violet-400 bg-violet-400/10 border-violet-400/20",
  OVERNIGHT: "text-sky-400    bg-sky-400/10    border-sky-400/20",
  WEEKEND:   "text-rose-400   bg-rose-400/10   border-rose-400/20",
};

const MEET_LABEL: Record<string, string> = {
  SHORT: "Short", OVERNIGHT: "Overnight", WEEKEND: "Weekend",
};

const VALID = new Set(["PENDING", "ACCEPTED", "COMPLETED", "REJECTED", "CANCELLED"]);

export default async function AdminOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const { status: statusFilter } = await searchParams;

  const statusWhere =
    statusFilter && VALID.has(statusFilter.toUpperCase())
      ? { status: statusFilter.toUpperCase() as any }
      : {};

  const [offers, counts] = await Promise.all([
    prisma.offer.findMany({
      where: statusWhere,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        client: { select: { fullName: true, whatsappNumber: true, email: true } },
        model: {
          select: {
            fullName: true,
            whatsappNumber: true,
            modelProfile: { select: { city: true, state: true } },
          },
        },
        receipt: { select: { couponCode: true, isRedeemed: true } },
      },
    }),
    prisma.offer.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countMap = counts.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = c._count._all;
    return acc;
  }, {});

  const total      = Object.values(countMap).reduce((s, v) => s + v, 0);
  const totalCoins = offers.reduce((s, o) => s + o.coinsAmount, 0);
  const activeFilter = statusFilter?.toUpperCase() ?? "";

  const filters = [
    { label: "All",       value: "",          count: total,                    icon: ListOrdered },
    { label: "Pending",   value: "PENDING",   count: countMap.PENDING   ?? 0, icon: Clock },
    { label: "Accepted",  value: "ACCEPTED",  count: countMap.ACCEPTED  ?? 0, icon: ShieldCheck },
    { label: "Completed", value: "COMPLETED", count: countMap.COMPLETED ?? 0, icon: CheckCircle2 },
    { label: "Rejected",  value: "REJECTED",  count: countMap.REJECTED  ?? 0, icon: XCircle },
  ];

  return (
    // Inner max-w keeps content comfortable on wide monitors
    <div className="max-w-2xl mx-auto space-y-5">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-foreground font-playfair">All Offers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Every offer made on the platform</p>
        </div>
        <Button asChild variant="outline"
          className="h-9 px-3 border-border text-muted-foreground hover:text-foreground hover:border-gold/30 rounded-xl shrink-0 text-xs font-semibold">
          <Link href="/admin/dashboard">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Back
          </Link>
        </Button>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: "Total Offers",  value: String(total),            icon: ListOrdered,  color: "text-gold",         bg: "bg-gold/10 border-gold/20" },
          { label: "Pending",       value: String(countMap.PENDING ?? 0), icon: Clock,   color: "text-amber-400",    bg: "bg-amber-400/10 border-amber-400/20" },
          { label: "Completed",     value: String(countMap.COMPLETED ?? 0), icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
          { label: "Volume",        value: formatCoins(totalCoins),  icon: Coins,        color: "text-violet-400",   bg: "bg-violet-400/10 border-violet-400/20" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", bg, color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-black text-foreground leading-none">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── FILTER TABS ── */}
      <div className="flex gap-1.5 flex-wrap">
        {filters.map(({ label, value, count, icon: Icon }) => {
          const active = activeFilter === value;
          const href   = value ? `/admin/offers?status=${value}` : "/admin/offers";
          return (
            <a key={value} href={href} className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
              active
                ? "bg-gold/15 border-gold/30 text-gold"
                : "bg-secondary border-border text-muted-foreground hover:border-gold/20 hover:text-foreground"
            )}>
              <Icon className="h-3 w-3" />
              {label}
              <span className={cn(
                "text-[10px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center",
                active ? "bg-gold/20 text-gold" : "bg-border/80 text-muted-foreground"
              )}>
                {count}
              </span>
            </a>
          );
        })}
      </div>

      {/* ── OFFERS ── */}
      {offers.length === 0 ? (
        <EmptyState icon={ListOrdered} title="No offers found" description="No offers match the selected filter." />
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => {
            const StatusIcon = STATUS_ICON[offer.status] ?? Clock;
            return (
              <div key={offer.id}
                className="rounded-2xl border border-border bg-card overflow-hidden hover:border-gold/20 transition-all">

                {/* Top bar */}
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-secondary/50 border-b border-border/60 flex-wrap gap-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border",
                      STATUS_STYLE[offer.status]
                    )}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      {offer.status}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                      MEET_STYLE[offer.meetType] ?? "text-muted-foreground bg-secondary border-border"
                    )}>
                      {MEET_LABEL[offer.meetType]}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-black text-gold">
                      <Coins className="h-2.5 w-2.5" />
                      {formatCoins(offer.coinsAmount)} DC
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 shrink-0">
                    {new Date(offer.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Client + Model */}
                <div className="p-4 grid grid-cols-2 gap-3">
                  {/* Client */}
                  <div className="space-y-2.5">
                    <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest flex items-center gap-1">
                      <Users className="h-2.5 w-2.5" />Client
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-black text-blue-400">
                        {offer.client.fullName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-foreground truncate">{offer.client.fullName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{offer.client.email}</p>
                      </div>
                    </div>
                    <a
                      href={`https://wa.me/${offer.client.whatsappNumber.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-400/8 border border-emerald-400/20 rounded-lg px-2 py-1 w-fit"
                    >
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{offer.client.whatsappNumber}</span>
                    </a>
                  </div>

                  {/* Model */}
                  <div className="space-y-2.5">
                    <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest flex items-center gap-1">
                      <ShieldCheck className="h-2.5 w-2.5" />Model
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 border border-gold/20 text-xs font-black text-gold">
                        {offer.model.fullName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-foreground truncate">{offer.model.fullName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {offer.model.modelProfile?.city}, {offer.model.modelProfile?.state}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`https://wa.me/${offer.model.whatsappNumber.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-400/8 border border-emerald-400/20 rounded-lg px-2 py-1 w-fit"
                    >
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{offer.model.whatsappNumber}</span>
                    </a>
                  </div>
                </div>

                {/* Coupon footer */}
                {offer.receipt && (
                  <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border/60 bg-gold/3">
                    <ShieldCheck className="h-3.5 w-3.5 text-gold shrink-0" />
                    <span className="text-xs font-black text-gold tracking-widest flex-1">
                      {offer.receipt.couponCode}
                    </span>
                    <span className={cn(
                      "text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0",
                      offer.receipt.isRedeemed
                        ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                        : "text-amber-400 bg-amber-400/10 border-amber-400/20"
                    )}>
                      {offer.receipt.isRedeemed ? "Redeemed" : "Pending"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}