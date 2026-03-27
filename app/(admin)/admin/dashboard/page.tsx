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
  Users,
  Clock,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Coins,
  XCircle,
} from "lucide-react";
import { formatCoins, coinsToNairaFormatted } from "@/lib/coins";
import { cn } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [
    wallet,
    totalClients,
    totalModels,
    pendingModels,
    recentPendingModels,
    totalOffers,
    totalRevenue,
  ] = await Promise.all([
    prisma.wallet.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.user.count({
      where: { role: "MODEL", modelProfile: { status: "ACTIVE" } },
    }),
    prisma.modelProfile.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.modelProfile.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { id: "desc" },
      take: 5,
      include: {
        user: {
          select: { fullName: true, email: true, createdAt: true },
        },
        documents: { select: { documentType: true } },
      },
    }),
    prisma.offer.count(),
    prisma.transaction.aggregate({
      where: {
        type: { in: ["CONNECTION_FEE", "FACE_REVEAL_CREDIT"] },
        status: "COMPLETED",
      },
      _sum: { amount: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      {/* ── HEADER ────────────────────────────── */}
      <PageHeader
        title="Admin Dashboard"
        description="Platform overview and pending approvals."
        action={
          <Button
            asChild
            className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90"
          >
            <Link href="/admin/models">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Manage Models
            </Link>
          </Button>
        }
      />

      {/* ── PENDING APPROVAL BANNER ───────────── */}
      {pendingModels > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {pendingModels} model{pendingModels > 1 ? "s" : ""} awaiting
              approval
            </p>
            <p className="text-xs text-muted-foreground">
              Review and approve model applications to activate their
              accounts.
            </p>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <Link href="/admin/models?filter=pending">Review Now</Link>
          </Button>
        </div>
      )}

      {/* ── STATS ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatsCard
          title="Admin Wallet"
          value={formatCoins(wallet?.balance ?? 0)}
          sub={coinsToNairaFormatted(wallet?.balance ?? 0)}
          icon={Wallet}
          trend="up"
        />
        <StatsCard
          title="Total Clients"
          value={totalClients.toString()}
          sub="Registered clients"
          icon={Users}
          trend="neutral"
        />
        <StatsCard
          title="Active Models"
          value={totalModels.toString()}
          sub="Approved models"
          icon={ShieldCheck}
          trend="neutral"
        />
        <StatsCard
          title="Total Offers"
          value={totalOffers.toString()}
          sub="Platform-wide"
          icon={CheckCircle2}
          trend="up"
        />
      </div>

      {/* ── REVENUE CARD ──────────────────────── */}
      <div className="rounded-xl border border-gold/20 bg-card overflow-hidden">
        <div className="h-0.5 bg-gold-gradient" />
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground font-medium">
                Total Platform Revenue
              </p>
              <p className="text-4xl font-bold text-gold-gradient">
                {formatCoins(totalRevenue._sum.amount ?? 0)}
              </p>
              <p className="text-sm text-muted-foreground">
                ≈{" "}
                {coinsToNairaFormatted(totalRevenue._sum.amount ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                Connection fees + face reveal earnings
              </p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10 border border-gold/20">
              <Coins className="h-8 w-8 text-gold" />
            </div>
          </div>
          <div className="mt-4">
            <Button
              asChild
              className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90"
            >
              <Link href="/admin/wallet">
                <Wallet className="mr-2 h-4 w-4" />
                View Wallet
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── PENDING MODELS ────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Pending Model Approvals
          </h2>
          {recentPendingModels.length > 0 && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-gold hover:text-gold-light gap-1"
            >
              <Link href="/admin/models?filter=pending">
                View all
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>

        {recentPendingModels.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No pending approvals"
            description="All model applications have been reviewed."
          />
        ) : (
          <div className="space-y-3">
            {recentPendingModels.map((model) => (
              <div
                key={model.id}
                className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 card-hover"
              >
                {/* Avatar */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/10 border border-gold/20 text-sm font-bold text-gold">
                  {model.user.fullName[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="font-medium text-foreground text-sm truncate">
                    {model.user.fullName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {model.user.email}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {model.documents.map((doc) => (
                      <Badge
                        key={doc.documentType}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 border-gold/20 text-gold"
                      >
                        {doc.documentType.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Action */}
                <Button
                  asChild
                  size="sm"
                  className="shrink-0 bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 text-xs"
                >
                  <Link href={`/admin/models?filter=pending`}>
                    Review
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}