"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/shared/stats-card";
import {
  Coins,
  ArrowDownLeft,
  Wallet,
  TrendingUp,
  Eye,
} from "lucide-react";
import {
  formatCoins,
  coinsToNairaFormatted,
} from "@/lib/coins";
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

export function AdminWalletClient({ wallet, transactions }: WalletProps) {
  const connectionFees = transactions
    .filter((t) => t.type === "CONNECTION_FEE" && t.status === "COMPLETED")
    .reduce((sum, t) => sum + t.amount, 0);

  const revealEarnings = transactions
    .filter(
      (t) => t.type === "FACE_REVEAL_CREDIT" && t.status === "COMPLETED"
    )
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Admin Wallet"
        description="Platform revenue from connection fees and face reveals"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Total Balance"
          value={formatCoins(wallet.balance)}
          sub={coinsToNairaFormatted(wallet.balance)}
          icon={Coins}
          trend="up"
        />
        <StatsCard
          title="Connection Fees"
          value={formatCoins(connectionFees)}
          sub="From offer transactions"
          icon={TrendingUp}
          trend="up"
        />
        <StatsCard
          title="Reveal Earnings"
          value={formatCoins(revealEarnings)}
          sub="From face reveals"
          icon={Eye}
          trend="up"
        />
      </div>

      {/* Transactions */}
      <div className="space-y-3">
        <h2 className="font-semibold text-foreground">
          Revenue Transactions
        </h2>
        {transactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 py-12 text-center">
            <Wallet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No revenue yet
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <ArrowDownLeft className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {tx.type === "CONNECTION_FEE"
                      ? "Connection Fee"
                      : "Face Reveal Cut"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {tx.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-emerald-400">
                    +{formatCoins(tx.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}