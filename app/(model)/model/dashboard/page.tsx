import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/shared/empty-state";
import { StatsCard } from "@/components/shared/stats-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Wallet, HandCoins, Clock, CheckCircle2, XCircle,
  ArrowRight, Coins, UserCircle, AlertTriangle,
  TrendingUp, Sparkles, ShieldX,
} from "lucide-react";
import { formatCoins, coinsToNairaFormatted } from "@/lib/coins";
import { cn } from "@/lib/utils";
import { AvailabilityToggle } from "@/components/model/availability-toggle";
import { PushNotificationToggle } from "@/components/model/push-notification-toggle";

const OFFER_STATUS_CONFIG = {
  PENDING:   { label: "Pending",   icon: Clock,        className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  ACCEPTED:  { label: "Accepted",  icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  REJECTED:  { label: "Rejected",  icon: XCircle,      className: "bg-destructive/10 text-destructive border-destructive/20" },
  COMPLETED: { label: "Completed", icon: CheckCircle2, className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  CANCELLED: { label: "Cancelled", icon: XCircle,      className: "bg-muted text-muted-foreground border-border" },
} as const;

const MEET_TYPE_LABELS = { SHORT: "Short Meet", OVERNIGHT: "Overnight", WEEKEND: "Weekend" } as const;

export default async function ModelDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [wallet, modelProfile, recentOffers] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: session.user.id } }),
    prisma.modelProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, age: true, height: true, city: true, state: true, about: true, isAvailable: true, status: true, charges: true },
    }),
    prisma.offer.findMany({
      where: { modelId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { client: { select: { fullName: true } } },
    }),
  ]);

  const pendingOffers   = recentOffers.filter((o) => o.status === "PENDING").length;
  const completedOffers = recentOffers.filter((o) => o.status === "COMPLETED").length;

  const isProfileIncomplete =
    !modelProfile?.age || !modelProfile?.height || !modelProfile?.city ||
    !modelProfile?.state || !modelProfile?.about || modelProfile?.charges.length === 0;

  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const balance     = wallet?.balance ?? 0;
  const pending     = wallet?.pendingCoins ?? 0;
  const isAvailable = modelProfile?.isAvailable ?? true;

  return (
    <div className="space-y-5">

      {/* ── GREETING ─────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-foreground font-playfair">Hey, {firstName} 👋</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your offers and profile</p>
        </div>
        <Button asChild className="h-9 px-4 bg-gold-gradient text-black font-bold hover:opacity-90 rounded-xl shrink-0 text-xs">
          <Link href="/model/offers"><HandCoins className="mr-1.5 h-3.5 w-3.5" />Offers</Link>
        </Button>
      </div>

      {/* ── INCOMPLETE PROFILE BANNER ─────────── */}
      {isProfileIncomplete && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            <p className="text-xs font-bold text-amber-400">Complete your profile</p>
            <p className="text-[11px] text-muted-foreground">Set your charges, age, height, city and bio.</p>
          </div>
          <Button asChild size="sm" variant="outline"
            className="shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-xl text-[11px] h-8 px-3">
            <Link href="/model/profile">Set Up</Link>
          </Button>
        </div>
      )}

      {/* ── WALLET HERO ──────────────────────── */}
      <div className="rounded-2xl border border-gold/20 bg-card overflow-hidden relative">
        <div className="h-1 bg-gold-gradient" />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 80% at 100% 50%, hsl(43 62% 52% / 0.05) 0%, transparent 70%)" }} />
        <div className="relative p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Available Balance</p>
              <p className="text-3xl font-black text-gold-gradient font-playfair">{formatCoins(balance)}</p>
              <p className="text-xs text-muted-foreground">≈ {coinsToNairaFormatted(balance)}</p>
              {pending > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 mt-1">
                  <Clock className="h-2.5 w-2.5 text-amber-400" />
                  <span className="text-[10px] text-amber-400 font-semibold">{formatCoins(pending)} pending</span>
                </div>
              )}
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/10 border border-gold/20">
              <Coins className="h-6 w-6 text-gold" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button asChild className="flex-1 h-9 bg-gold-gradient text-black font-bold hover:opacity-90 rounded-xl text-xs">
              <Link href="/model/wallet"><Wallet className="mr-1.5 h-3 w-3" />My Wallet</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 h-9 border-gold/20 text-gold hover:bg-gold/8 rounded-xl text-xs">
              <Link href="/model/profile"><UserCircle className="mr-1.5 h-3 w-3" />Edit Profile</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── STATS ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatsCard title="Balance"   value={formatCoins(balance)}    sub={coinsToNairaFormatted(balance)} icon={Wallet}       trend="neutral" />
        <StatsCard title="Pending"   value={formatCoins(pending)}    sub="Awaiting redemption"            icon={Coins}        trend="neutral" />
        <StatsCard title="Offers"    value={String(pendingOffers)}   sub="Need response"                  icon={Clock}        trend={pendingOffers > 0 ? "up" : "neutral"} />
        <StatsCard title="Completed" value={String(completedOffers)} sub="Total meets"                    icon={CheckCircle2} trend="up" />
      </div>

      {/* ── RECENT OFFERS ────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Recent Offers</h2>
          {recentOffers.length > 0 && (
            <Button asChild variant="ghost" size="sm" className="text-gold h-7 gap-1 px-2 text-xs">
              <Link href="/model/offers">View all <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          )}
        </div>

        {recentOffers.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="No offers yet"
            description="Complete your profile and set charges so clients can book you."
            action={
              <Button asChild className="bg-gold-gradient text-black font-bold hover:opacity-90 text-xs h-9">
                <Link href="/model/profile">Complete Profile</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {recentOffers.map((offer) => {
              const config     = OFFER_STATUS_CONFIG[offer.status];
              const StatusIcon = config.icon;
              return (
                <div key={offer.id}
                  className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3 hover:border-gold/20 transition-all">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary border border-border text-sm font-black text-muted-foreground">
                    {offer.client.fullName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-xs truncate">{offer.client.fullName}</p>
                    <p className="text-[10px] text-muted-foreground">{MEET_TYPE_LABELS[offer.meetType]}</p>
                    <p className="text-[10px] text-gold font-semibold">{formatCoins(offer.coinsAmount)} DC</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge variant="outline" className={cn("gap-1 text-[10px] rounded-lg px-2 py-0.5", config.className)}>
                      <StatusIcon className="h-2.5 w-2.5" />{config.label}
                    </Badge>
                    {offer.status === "PENDING" && (
                      <Button asChild size="sm" variant="outline"
                        className="text-[10px] h-6 px-2 border-gold/30 text-gold hover:bg-gold/10 rounded-lg">
                        <Link href="/model/offers">Respond</Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── AVAILABILITY TOGGLE ──────────────── */}
      {modelProfile?.status === "ACTIVE" && (
        <AvailabilityToggle initialValue={isAvailable} />
      )}

      {/* ── PUSH NOTIFICATION TOGGLE ─────────── */}
      {modelProfile?.status === "ACTIVE" && (
        <PushNotificationToggle />
      )}

      {/* ── QUICK ACTIONS ────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-xs font-black text-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-gold" />Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: "/model/profile",   label: "Edit Profile", icon: UserCircle },
            { href: "/model/wallet",    label: "My Wallet",    icon: Wallet },
            { href: "/model/offers",    label: "All Offers",   icon: HandCoins },
            { href: "/model/blocklist", label: "Blocklist",    icon: ShieldX },
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