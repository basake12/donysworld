import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  CheckCircle2, Clock, XCircle, Phone,
  Coins, Calendar, ShieldCheck, Filter,
} from "lucide-react";
import { formatCoins } from "@/lib/coins";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  PENDING:   "text-amber-400  bg-amber-400/10  border-amber-400/20",
  ACCEPTED:  "text-blue-400   bg-blue-400/10   border-blue-400/20",
  COMPLETED: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  REJECTED:  "text-red-400    bg-red-400/10    border-red-400/20",
  CANCELLED: "text-zinc-400   bg-zinc-400/10   border-zinc-400/20",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  PENDING:   Clock,
  ACCEPTED:  ShieldCheck,
  COMPLETED: CheckCircle2,
  REJECTED:  XCircle,
  CANCELLED: XCircle,
};

const MEET_LABEL: Record<string, string> = {
  SHORT:     "Short",
  OVERNIGHT: "Overnight",
  WEEKEND:   "Weekend",
};

export default async function AdminOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const { status: statusFilter } = await searchParams;

  const VALID = new Set(["PENDING", "ACCEPTED", "COMPLETED", "REJECTED", "CANCELLED"]);
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
        model:  {
          select: {
            fullName: true,
            whatsappNumber: true,
            modelProfile: { select: { city: true, state: true } },
          },
        },
        receipt: { select: { couponCode: true, isRedeemed: true } },
      },
    }),
    prisma.offer.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const countMap = counts.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = c._count._all;
    return acc;
  }, {});
  const total = Object.values(countMap).reduce((s, v) => s + v, 0);

  const filters = [
    { label: "All",       value: "",          count: total },
    { label: "Pending",   value: "PENDING",   count: countMap.PENDING   ?? 0 },
    { label: "Accepted",  value: "ACCEPTED",  count: countMap.ACCEPTED  ?? 0 },
    { label: "Completed", value: "COMPLETED", count: countMap.COMPLETED ?? 0 },
    { label: "Rejected",  value: "REJECTED",  count: countMap.REJECTED  ?? 0 },
  ];

  return (
    <div className="space-y-5">

      {/* ── HEADER ── */}
      <div>
        <h1 className="text-xl font-black text-foreground font-playfair">All Offers</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Every offer made on the platform — with model and client contact info
        </p>
      </div>

      {/* ── STATUS FILTER TABS ── */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(({ label, value, count }) => {
          const active = (statusFilter ?? "") === value;
          const href = value ? `/admin/offers?status=${value}` : "/admin/offers";
          return (
            <a
              key={value}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                active
                  ? "bg-gold/15 border-gold/30 text-gold"
                  : "bg-secondary border-border text-muted-foreground hover:border-gold/20 hover:text-foreground"
              )}
            >
              {label}
              <span className={cn(
                "text-[10px] font-black rounded-full px-1.5 py-0.5",
                active ? "bg-gold/20 text-gold" : "bg-border text-muted-foreground"
              )}>
                {count}
              </span>
            </a>
          );
        })}
      </div>

      {/* ── OFFERS LIST ── */}
      {offers.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No offers found"
          description="No offers match the selected filter."
        />
      ) : (
        <div className="space-y-2.5">
          {offers.map((offer) => {
            const StatusIcon = STATUS_ICON[offer.status] ?? Clock;
            return (
              <div
                key={offer.id}
                className="rounded-2xl border border-border bg-card p-4 space-y-3 hover:border-gold/20 transition-all"
              >
                {/* ── TOP ROW: status + meet type + amount + date ── */}
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full border",
                      STATUS_STYLE[offer.status]
                    )}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      {offer.status}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground bg-secondary border border-border rounded-full px-2 py-1">
                      {MEET_LABEL[offer.meetType] ?? offer.meetType}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-black text-gold">
                      <Coins className="h-2.5 w-2.5" />
                      {formatCoins(offer.coinsAmount)} DC
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                    <Calendar className="h-2.5 w-2.5" />
                    {new Date(offer.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                </div>

                {/* ── PARTIES ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

                  {/* Client */}
                  <div className="rounded-xl bg-secondary/60 border border-border/60 p-3 space-y-1.5">
                    <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Client</p>
                    <p className="text-sm font-black text-foreground leading-tight">
                      {offer.client.fullName}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {offer.client.email}
                    </p>
                    <a
                      href={`https://wa.me/${offer.client.whatsappNumber.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <Phone className="h-3 w-3" />
                      {offer.client.whatsappNumber}
                    </a>
                  </div>

                  {/* Model */}
                  <div className="rounded-xl bg-secondary/60 border border-border/60 p-3 space-y-1.5">
                    <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Model</p>
                    <p className="text-sm font-black text-foreground leading-tight">
                      {offer.model.fullName}
                    </p>
                    {offer.model.modelProfile && (
                      <p className="text-[11px] text-muted-foreground">
                        {offer.model.modelProfile.city}, {offer.model.modelProfile.state}
                      </p>
                    )}
                    <a
                      href={`https://wa.me/${offer.model.whatsappNumber.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <Phone className="h-3 w-3" />
                      {offer.model.whatsappNumber}
                    </a>
                  </div>
                </div>

                {/* ── COUPON (if accepted/completed) ── */}
                {offer.receipt && (
                  <div className="flex items-center gap-2 rounded-xl bg-gold/5 border border-gold/15 px-3 py-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-gold shrink-0" />
                    <span className="text-xs font-black text-gold tracking-widest">
                      {offer.receipt.couponCode}
                    </span>
                    <span className={cn(
                      "ml-auto text-[10px] font-bold",
                      offer.receipt.isRedeemed ? "text-emerald-400" : "text-amber-400"
                    )}>
                      {offer.receipt.isRedeemed ? "Redeemed" : "Pending redemption"}
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