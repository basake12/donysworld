"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/shared/stats-card";
import { Coins, ArrowDownLeft, Wallet, TrendingUp, Eye } from "lucide-react";
import { formatCoins, coinsToNairaFormatted } from "@/lib/coins";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: string;
  status: string;
  amount: number;
  description: string;
  createdAt: string;
}

interface WalletProps {
  wallet: { id: string; balance: number; pendingCoins: number };
  transactions: Transaction[];
}

const TX_LABELS: Record<string, string> = {
  CONNECTION_FEE:    "Connection Fee",
  FACE_REVEAL_CREDIT: "Face Reveal Cut",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export function AdminWalletClient({ wallet, transactions }: WalletProps) {
  const connectionFees = transactions
    .filter((t) => t.type === "CONNECTION_FEE" && t.status === "COMPLETED")
    .reduce((sum, t) => sum + t.amount, 0);

  const revealEarnings = transactions
    .filter((t) => t.type === "FACE_REVEAL_CREDIT" && t.status === "COMPLETED")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-5 max-w-2xl">

      <PageHeader
        title="Admin Wallet"
        description="Platform revenue from connection fees and face reveals"
      />

      {/* ── BALANCE HERO ─────────────────────── */}
      <div className="rounded-2xl border border-gold/20 bg-card overflow-hidden relative">
        <div className="h-1 bg-gold-gradient" />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 80% at 0% 50%, hsl(43 62% 52% / 0.04) 0%, transparent 70%)" }} />
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Balance</p>
              <p className="text-4xl font-black text-gold-gradient font-playfair">{formatCoins(wallet.balance)}</p>
              <p className="text-sm text-muted-foreground">≈ {coinsToNairaFormatted(wallet.balance)}</p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold/10 border border-gold/20">
              <Coins className="h-7 w-7 text-gold" />
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatsCard title="Total Balance"    value={formatCoins(wallet.balance)}   sub={coinsToNairaFormatted(wallet.balance)} icon={Coins}      trend="up" />
        <StatsCard title="Connection Fees"  value={formatCoins(connectionFees)}   sub="From offers"                           icon={TrendingUp} trend="up" />
        <StatsCard title="Reveal Earnings"  value={formatCoins(revealEarnings)}   sub="From face reveals"                     icon={Eye}        trend="up" />
      </div>

      {/* ── TRANSACTIONS ─────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">Revenue Transactions</h2>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-border">
            <Wallet className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No revenue yet</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/30 transition-colors">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <ArrowDownLeft className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{TX_LABELS[tx.type] ?? tx.type}</p>
                  <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-emerald-400">+{formatCoins(tx.amount)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(tx.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}