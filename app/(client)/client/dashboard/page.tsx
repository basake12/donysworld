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
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Coins,
} from "lucide-react";
import {
  formatCoins,
  coinsToNairaFormatted,
  calculateConnectionFees,
} from "@/lib/coins";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// OFFER STATUS CONFIG
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────

export default async function ClientDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Fetch wallet + recent offers in parallel
  const [wallet, recentOffers, totalModels] = await Promise.all([
    prisma.wallet.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.offer.findMany({
      where: { clientId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        model: {
          select: {
            fullName: true,
            modelProfile: {
              select: {
                profilePictureUrl: true,
                city: true,
                state: true,
              },
            },
          },
        },
        receipt: true,
      },
    }),
    prisma.modelProfile.count({
      where: { status: "ACTIVE" },
    }),
  ]);

  const pendingOffers = recentOffers.filter(
    (o) => o.status === "PENDING"
  ).length;
  const acceptedOffers = recentOffers.filter(
    (o) => o.status === "ACCEPTED" || o.status === "COMPLETED"
  ).length;

  const firstName = session.user.name?.split(" ")[0];

  return (
    <div className="space-y-8">
      {/* ── HEADER ────────────────────────────── */}
      <PageHeader
        title={`Welcome back, ${firstName} 👋`}
        description="Here's what's happening with your account today."
        action={
          <Button
            asChild
            className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90"
          >
            <Link href="/client/models">
              <Users className="mr-2 h-4 w-4" />
              Browse Models
            </Link>
          </Button>
        }
      />

      {/* ── STATS ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatsCard
          title="Wallet Balance"
          value={formatCoins(wallet?.balance ?? 0)}
          sub={coinsToNairaFormatted(wallet?.balance ?? 0)}
          icon={Wallet}
          trend="neutral"
        />
        <StatsCard
          title="Active Models"
          value={totalModels.toString()}
          sub="Available to book"
          icon={Users}
          trend="neutral"
        />
        <StatsCard
          title="Pending Offers"
          value={pendingOffers.toString()}
          sub="Awaiting model response"
          icon={Clock}
          trend={pendingOffers > 0 ? "neutral" : "neutral"}
        />
        <StatsCard
          title="Accepted Offers"
          value={acceptedOffers.toString()}
          sub="Total bookings"
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
                Dony&apos;s Coins Balance
              </p>
              <p className="text-4xl font-bold text-gold-gradient">
                {formatCoins(wallet?.balance ?? 0)}
              </p>
              <p className="text-sm text-muted-foreground">
                ≈ {coinsToNairaFormatted(wallet?.balance ?? 0)}
              </p>
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
              <Link href="/client/wallet">
                <Wallet className="mr-2 h-4 w-4" />
                Fund Wallet
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="flex-1 border-gold/30 text-gold hover:bg-gold/10"
            >
              <Link href="/client/offers">
                <HandCoins className="mr-2 h-4 w-4" />
                My Offers
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
              <Link href="/client/offers">
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
            description="Browse models and make your first offer to get started."
            action={
              <Button
                asChild
                className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90"
              >
                <Link href="/client/models">Browse Models</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {recentOffers.map((offer) => {
              const config = OFFER_STATUS_CONFIG[offer.status];
              const StatusIcon = config.icon;
              const fees = calculateConnectionFees(offer.coinsAmount);

              return (
                <div
                  key={offer.id}
                  className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 card-hover"
                >
                  {/* Avatar */}
                  <div className="relative h-12 w-12 shrink-0 rounded-full overflow-hidden border border-border bg-secondary">
                    {offer.model.modelProfile?.profilePictureUrl ? (
                      <img
                        src={offer.model.modelProfile.profilePictureUrl}
                        alt={offer.model.fullName}
                        className="h-full w-full object-cover face-blurred"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs font-bold">
                        {offer.model.fullName[0]}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="font-medium text-foreground text-sm truncate">
                      {offer.model.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {MEET_TYPE_LABELS[offer.meetType]} ·{" "}
                      {offer.model.modelProfile?.city},{" "}
                      {offer.model.modelProfile?.state}
                    </p>
                    <p className="text-xs text-gold font-medium">
                      {formatCoins(fees.clientTotal)} total
                    </p>
                  </div>

                  {/* Status */}
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 gap-1 text-xs", config.className)}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}