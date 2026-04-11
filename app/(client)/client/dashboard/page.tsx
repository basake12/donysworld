import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Wallet, HandCoins, Users, Clock, CheckCircle2, XCircle,
  ArrowRight, Coins, Sparkles, TrendingUp, Crown,
} from "lucide-react";
import {
  formatCoins, coinsToNairaFormatted, calculateConnectionFees,
} from "@/lib/coins";
import { cn } from "@/lib/utils";

const OFFER_STATUS_CONFIG = {
  PENDING:   { label: "Pending",   icon: Clock,        className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  ACCEPTED:  { label: "Accepted",  icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  REJECTED:  { label: "Rejected",  icon: XCircle,      className: "bg-destructive/10 text-destructive border-destructive/20" },
  COMPLETED: { label: "Completed", icon: CheckCircle2, className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  CANCELLED: { label: "Cancelled", icon: XCircle,      className: "bg-muted text-muted-foreground border-border" },
} as const;

// No hour indicators
const MEET_LABELS = { SHORT: "Short Meet", OVERNIGHT: "Overnight", WEEKEND: "Weekend" } as const;

export default async function ClientDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [wallet, recentOffers, totalModels] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: session.user.id } }),
    prisma.offer.findMany({
      where: { clientId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        model: {
          select: {
            fullName: true, nickname: true,
            modelProfile: { select: { profilePictureUrl: true, city: true, state: true } },
          },
        },
        receipt: true,
      },
    }),
    prisma.modelProfile.count({ where: { status: "ACTIVE" } }),
  ]);

  const pendingOffers  = recentOffers.filter((o) => o.status === "PENDING").length;
  const acceptedOffers = recentOffers.filter((o) => ["ACCEPTED", "COMPLETED"].includes(o.status)).length;
  const firstName      = session.user.name?.split(" ")[0] ?? "there";
  const balance        = wallet?.balance ?? 0;

  return (
    <div className="space-y-5">

      {/* ── GREETING ─────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-foreground font-playfair">Hey, {firstName} 👋</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Here&apos;s your account overview</p>
        </div>
        <Button asChild className="h-9 px-4 bg-gold-gradient text-black font-bold hover:opacity-90 rounded-xl shrink-0 text-xs">
          <Link href="/client/models">
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Browse
          </Link>
        </Button>
      </div>

      {/* ── WALLET HERO ──────────────────────── */}
      <div className="rounded-2xl border border-gold/20 bg-card overflow-hidden relative">
        <div className="h-1 bg-gold-gradient" />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 80% at 0% 50%, hsl(43 62% 52% / 0.04) 0%, transparent 70%)" }} />
        <div className="relative p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Dony&apos;s Coins Balance
              </p>
              <p className="text-3xl sm:text-4xl font-black text-gold-gradient font-playfair">{formatCoins(balance)}</p>
              <p className="text-xs text-muted-foreground">≈ {coinsToNairaFormatted(balance)}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/10 border border-gold/20">
              <Coins className="h-6 w-6 text-gold" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button asChild className="flex-1 h-9 bg-gold-gradient text-black font-bold hover:opacity-90 rounded-xl text-xs">
              <Link href="/client/wallet"><Wallet className="mr-1.5 h-3 w-3" />Fund Wallet</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 h-9 border-gold/20 text-gold hover:bg-gold/8 rounded-xl text-xs">
              <Link href="/client/offers"><HandCoins className="mr-1.5 h-3 w-3" />My Offers</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── STATS ROW ────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Models",   value: totalModels,    icon: Users,       sub: "Active" },
          { label: "Pending",  value: pendingOffers,  icon: Clock,       sub: "Offers" },
          { label: "Accepted", value: acceptedOffers, icon: TrendingUp,  sub: "Offers" },
        ].map(({ label, value, icon: Icon, sub }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gold/8 border border-gold/15">
              <Icon className="h-3.5 w-3.5 text-gold" />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-black text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── RECENT OFFERS ────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Recent Offers</h2>
          {recentOffers.length > 0 && (
            <Button asChild variant="ghost" size="sm" className="text-gold h-7 gap-1 px-2 text-xs">
              <Link href="/client/offers">View all <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          )}
        </div>

        {recentOffers.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="No offers yet"
            description="Browse models and make your first offer."
            action={
              <Button asChild className="bg-gold-gradient text-black font-bold hover:opacity-90 text-xs h-9">
                <Link href="/client/models">Browse Models</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {recentOffers.map((offer) => {
              const config     = OFFER_STATUS_CONFIG[offer.status];
              const StatusIcon = config.icon;
              const fees       = calculateConnectionFees(offer.coinsAmount);
              const modelName  = offer.model.nickname || offer.model.fullName;

              return (
                <div key={offer.id}
                  className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3 hover:border-gold/20 transition-all duration-200">
                  <div className="relative h-10 w-10 shrink-0 rounded-xl overflow-hidden border border-border bg-secondary">
                    {offer.model.modelProfile?.profilePictureUrl ? (
                      <img src={offer.model.modelProfile.profilePictureUrl} alt={modelName}
                        className="h-full w-full object-cover object-top"
                        style={{ filter: "blur(6px)", transform: "scale(1.1)" }} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm font-bold bg-secondary">
                        {modelName[0]}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-xs truncate">{modelName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {MEET_LABELS[offer.meetType]} · {offer.model.modelProfile?.city}, {offer.model.modelProfile?.state}
                    </p>
                    <p className="text-[10px] text-gold font-semibold">{formatCoins(fees.clientTotal)} DC</p>
                  </div>

                  <Badge variant="outline" className={cn("shrink-0 gap-1 text-[10px] rounded-lg px-2 py-0.5", config.className)}>
                    <StatusIcon className="h-2.5 w-2.5" />
                    {config.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── QUICK ACTIONS ────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-xs font-black text-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-gold" />Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: "/client/models",        label: "Browse Models",  icon: Users },
            { href: "/client/wallet",        label: "Fund Wallet",   icon: Wallet },
            { href: "/client/offers",        label: "My Offers",     icon: HandCoins },
            { href: "/client/notifications", label: "Notifications", icon: Crown },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-2 rounded-xl border border-border bg-secondary p-2.5 hover:border-gold/30 hover:bg-gold/5 transition-all group">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold/8 border border-gold/15 group-hover:bg-gold/15 transition-colors">
                <Icon className="h-3.5 w-3.5 text-gold" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}