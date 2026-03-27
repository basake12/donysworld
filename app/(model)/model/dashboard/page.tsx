import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/shared/stats-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Wallet,
  HandCoins,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Coins,
  AlertTriangle,
  UserCircle,
} from "lucide-react";
import { formatCoins, coinsToNairaFormatted } from "@/lib/coins";
import { cn } from "@/lib/utils";

const OFFER_STATUS_CONFIG = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  ACCEPTED: {
    label: "Accepted",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-muted text-muted-foreground border-border",
  },
} as const;

const MEET_TYPE_LABELS = {
  SHORT: "Short Meet · 1hr",
  OVERNIGHT: "Overnight · 3hrs",
  WEEKEND: "Weekend · 48hrs",
} as const;

export default async function ModelDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [wallet, modelProfile, recentOffers] = await Promise.all([
    prisma.wallet.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.modelProfile.findUnique({
      where: { userId: session.user.id },
      include: { charges: true },
    }),
    prisma.offer.findMany({
      where: { modelId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        client: {
          select: { fullName: true },
        },
      },
    }),
  ]);

  const pendingOffers = recentOffers.filter(
    (o) => o.status === "PENDING"
  ).length;
  const completedOffers = recentOffers.filter(
    (o) => o.status === "COMPLETED"
  ).length;

  const isProfileIncomplete =
    !modelProfile?.age ||
    !modelProfile?.height ||
    !modelProfile?.city ||
    !modelProfile?.state ||
    !modelProfile?.about ||
    modelProfile?.charges.length === 0;

  const firstName = session.user.name?.split(" ")[0];

  return (
    <div className="space-y-8">
      {/* ── HEADER ────────────────────────────── */}
      <PageHeader
        title={`Welcome, ${firstName} 👋`}
        description="Manage your offers, wallet and profile from here."
        action={
          <Button
            asChild
            className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90"
          >
            <Link href="/model/offers">
              <HandCoins className="mr-2 h-4 w-4" />
              View Offers
            </Link>
          </Button>
        }
      />

      {/* ── PROFILE INCOMPLETE BANNER ─────────── */}
      {isProfileIncomplete && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-foreground">
              Complete your profile
            </p>
            <p className="text-xs text-muted-foreground">
              Your profile is incomplete. Set your charges, age, height, city
              and bio so clients can find and book you.
            </p>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <Link href="/model/profile">Set Up</Link>
          </Button>
        </div>
      )}

      {/* ── STATS ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatsCard
          title="Available Balance"
          value={formatCoins(wallet?.balance ?? 0)}
          sub={coinsToNairaFormatted(wallet?.balance ?? 0)}
          icon={Wallet}
          trend="neutral"
        />
        <StatsCard
          title="Pending Coins"
          value={formatCoins(wallet?.pendingCoins ?? 0)}
          sub="Awaiting redemption"
          icon={Coins}
          trend="neutral"
        />
        <StatsCard
          title="Pending Offers"
          value={pendingOffers.toString()}
          sub="Needs your response"
          icon={Clock}
          trend={pendingOffers > 0 ? "up" : "neutral"}
        />
        <StatsCard
          title="Completed"
          value={completedOffers.toString()}
          sub="Total completed meets"
          icon={CheckCircle2}
          trend="up"
        />
      </div>

      {/* ── WALLET CARD ───────────────────────── */}
      <div className="rounded-xl border border-gold/20 bg-card overflow-hidden">
        <div className="h-0.5 bg-gold-gradient" />
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground font-medium">
                Wallet Overview
              </p>
              <div className="space-y-0.5">
                <p className="text-3xl font-bold text-gold-gradient">
                  {formatCoins(wallet?.balance ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Available · {coinsToNairaFormatted(wallet?.balance ?? 0)}
                </p>
              </div>
              {(wallet?.pendingCoins ?? 0) > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 mt-1">
                  <Clock className="h-3 w-3 text-amber-400" />
                  <span className="text-xs text-amber-400 font-medium">
                    {formatCoins(wallet?.pendingCoins ?? 0)} pending
                    redemption
                  </span>
                </div>
              )}
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10 border border-gold/20">
              <Coins className="h-8 w-8 text-gold" />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Button
              asChild
              className="flex-1 bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90"
            >
              <Link href="/model/wallet">
                <Wallet className="mr-2 h-4 w-4" />
                My Wallet
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="flex-1 border-gold/30 text-gold hover:bg-gold/10"
            >
              <Link href="/model/profile">
                <UserCircle className="mr-2 h-4 w-4" />
                Edit Profile
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── RECENT OFFERS ─────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Recent Offers
          </h2>
          {recentOffers.length > 0 && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-gold hover:text-gold-light gap-1"
            >
              <Link href="/model/offers">
                View all
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>

        {recentOffers.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="No offers yet"
            description="Complete your profile and set your charges so clients can start booking you."
            action={
              <Button
                asChild
                className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90"
              >
                <Link href="/model/profile">Complete Profile</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {recentOffers.map((offer) => {
              const config = OFFER_STATUS_CONFIG[offer.status];
              const StatusIcon = config.icon;

              return (
                <div
                  key={offer.id}
                  className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 card-hover"
                >
                  {/* Client avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary border border-border text-sm font-bold text-muted-foreground">
                    {offer.client.fullName[0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="font-medium text-foreground text-sm truncate">
                      {offer.client.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {MEET_TYPE_LABELS[offer.meetType]}
                    </p>
                    <p className="text-xs text-gold font-medium">
                      {formatCoins(offer.coinsAmount)}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex flex-col items-end gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 gap-1 text-xs",
                        config.className
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                    {offer.status === "PENDING" && (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 border-gold/30 text-gold hover:bg-gold/10"
                      >
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
    </div>
  );
}