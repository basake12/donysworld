import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatsCard } from "@/components/shared/stats-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Wallet, Users, Clock, CheckCircle2, ShieldCheck,
  ArrowRight, Coins, TrendingUp, Sparkles, ListOrdered,
} from "lucide-react";
import { formatCoins, coinsToNairaFormatted } from "@/lib/coins";
import { cn } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [
    wallet, totalClients, totalModels, pendingModels,
    recentPendingModels, totalOffers, pendingOffers, totalRevenue,
  ] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: session.user.id } }),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.user.count({ where: { role: "MODEL", modelProfile: { status: "ACTIVE" } } }),
    prisma.modelProfile.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.modelProfile.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { id: "desc" },
      take: 5,
      include: {
        user: { select: { fullName: true, email: true, createdAt: true } },
        documents: { select: { documentType: true } },
      },
    }),
    prisma.offer.count(),
    prisma.offer.count({ where: { status: "PENDING" } }),
    prisma.transaction.aggregate({
      where: { type: { in: ["CONNECTION_FEE", "FACE_REVEAL_CREDIT"] }, status: "COMPLETED" },
      _sum: { amount: true },
    }),
  ]);

  const balance = wallet?.balance ?? 0;

  return (
    <div className="space-y-5">

      {/* ── HEADER ───────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-foreground font-playfair">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Platform overview and controls</p>
        </div>
        <Button asChild className="h-9 px-4 bg-gold-gradient text-black font-bold hover:opacity-90 rounded-xl shrink-0 text-xs">
          <Link href="/admin/models"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Manage Models</Link>
        </Button>
      </div>

      {/* ── PENDING APPROVAL BANNER ───────────── */}
      {pendingModels > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5">
          <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            <p className="text-xs font-bold text-amber-400">
              {pendingModels} model{pendingModels > 1 ? "s" : ""} awaiting approval
            </p>
            <p className="text-[11px] text-muted-foreground">Review and approve to activate accounts.</p>
          </div>
          <Button asChild size="sm" variant="outline"
            className="shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-xl text-[11px] h-8 px-3">
            <Link href="/admin/models?filter=pending">Review Now</Link>
          </Button>
        </div>
      )}

      {/* ── PENDING OFFERS BANNER ─────────────── */}
      {pendingOffers > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3.5">
          <ListOrdered className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            <p className="text-xs font-bold text-blue-400">
              {pendingOffers} pending offer{pendingOffers > 1 ? "s" : ""}
            </p>
            <p className="text-[11px] text-muted-foreground">Offers awaiting model response.</p>
          </div>
          <Button asChild size="sm" variant="outline"
            className="shrink-0 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded-xl text-[11px] h-8 px-3">
            <Link href="/admin/offers?status=PENDING">View</Link>
          </Button>
        </div>
      )}

      {/* ── REVENUE HERO ─────────────────────── */}
      <div className="rounded-2xl border border-gold/20 bg-card overflow-hidden relative">
        <div className="h-1 bg-gold-gradient" />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 50% 80% at 100% 50%, hsl(43 62% 52% / 0.05) 0%, transparent 70%)" }} />
        <div className="relative p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Platform Revenue</p>
              <p className="text-3xl font-black text-gold-gradient font-playfair">
                {formatCoins(totalRevenue._sum.amount ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">≈ {coinsToNairaFormatted(totalRevenue._sum.amount ?? 0)}</p>
              <p className="text-[10px] text-muted-foreground/60">Connection fees + face reveal earnings</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/10 border border-gold/20">
              <TrendingUp className="h-6 w-6 text-gold" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button asChild className="h-9 bg-gold-gradient text-black font-bold hover:opacity-90 rounded-xl text-xs px-4">
              <Link href="/admin/wallet"><Wallet className="mr-1.5 h-3 w-3" />Wallet ({formatCoins(balance)})</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── STATS GRID ───────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatsCard title="Clients"  value={String(totalClients)}  sub="Registered"    icon={Users}         trend="neutral" />
        <StatsCard title="Models"   value={String(totalModels)}   sub="Active"        icon={ShieldCheck}   trend="neutral" />
        <StatsCard title="Offers"   value={String(totalOffers)}   sub="Platform-wide" icon={CheckCircle2}  trend="up" />
        <StatsCard title="Pending"  value={String(pendingModels)} sub="Need review"   icon={Clock}         trend={pendingModels > 0 ? "up" : "neutral"} />
      </div>

      {/* ── PENDING APPROVALS ────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Pending Approvals</h2>
          {recentPendingModels.length > 0 && (
            <Button asChild variant="ghost" size="sm" className="text-gold h-7 gap-1 px-2 text-xs">
              <Link href="/admin/models?filter=pending">View all <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          )}
        </div>

        {recentPendingModels.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No pending approvals" description="All applications reviewed." />
        ) : (
          <div className="space-y-2">
            {recentPendingModels.map((model) => (
              <div key={model.id}
                className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3 hover:border-gold/20 transition-all">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 border border-gold/20 text-sm font-black text-gold">
                  {model.user.fullName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-xs truncate">{model.user.fullName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{model.user.email}</p>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {model.documents.map((doc) => (
                      <Badge key={doc.documentType} variant="outline"
                        className="text-[9px] px-1.5 py-0 border-gold/20 text-gold rounded-full">
                        {doc.documentType.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button asChild size="sm"
                  className="shrink-0 bg-gold-gradient text-black font-black hover:opacity-90 rounded-xl text-[11px] h-8 px-3">
                  <Link href="/admin/models?filter=pending">Review</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── QUICK ACCESS ─────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-xs font-black text-foreground flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-gold" />Quick Access
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: "/admin/models",        label: "All Models",    icon: ShieldCheck },
            { href: "/admin/offers",        label: "All Offers",    icon: ListOrdered },
            { href: "/admin/fund-requests", label: "Fund Requests", icon: Wallet },
            { href: "/admin/withdrawals",   label: "Withdrawals",   icon: Coins },
            { href: "/admin/wallet",        label: "Admin Wallet",  icon: TrendingUp },
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