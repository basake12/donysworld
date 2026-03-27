"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Coins, ArrowDownLeft, ArrowUpRight, Clock, Wallet,
  Plus, Loader2, Building2, Star, StarOff, CheckCircle2,
  XCircle, Info, Lock, Banknote,
} from "lucide-react";
import { formatCoins, coinsToNairaFormatted, coinsToNaira } from "@/lib/coins";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface Transaction {
  id: string; type: string; status: string;
  amount: number; description: string; createdAt: string;
}

interface BankAccount {
  id: string; bankName: string; accountNumber: string;
  accountName: string; isPreferred: boolean; isLocked: boolean; createdAt: string;
}

interface WithdrawalRequest {
  id: string; coinsAmount: number; nairaAmount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null; createdAt: string;
  bankAccount: { bankName: string; accountNumber: string; accountName: string };
}

interface WalletProps {
  wallet: { id: string; balance: number; pendingCoins: number };
  transactions: Transaction[];
  bankAccounts: BankAccount[];
  withdrawalRequests: WithdrawalRequest[];
  fullName: string;
}

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const TX_CONFIG: Record<string, { label: string; direction: "in" | "out" }> = {
  OFFER_CREDIT: { label: "Offer Earned", direction: "in" },
  FACE_REVEAL_CREDIT: { label: "Face Reveal Earning", direction: "in" },
  REDEMPTION: { label: "Redemption", direction: "in" },
  CONNECTION_FEE: { label: "Platform Fee", direction: "out" },
  WITHDRAWAL: { label: "Withdrawal", direction: "out" },
};

const WITHDRAWAL_STATUS_CONFIG = {
  PENDING: { label: "Pending", icon: Clock, className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  APPROVED: { label: "Approved", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  REJECTED: { label: "Rejected", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
} as const;

const MIN_WITHDRAWAL = 1000;

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export function ModelWalletClient({
  wallet, transactions, bankAccounts, withdrawalRequests, fullName,
}: WalletProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"transactions" | "accounts" | "withdrawals">("transactions");

  // Add bank account modal
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ bankName: "", accountNumber: "", accountName: "" });
  const [savingAccount, setSavingAccount] = useState(false);

  // Withdraw modal
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState(
    bankAccounts.find((a) => a.isPreferred)?.id ?? bankAccounts[0]?.id ?? ""
  );
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // Preferred confirm
  const [setPreferredId, setSetPreferredId] = useState<string | null>(null);
  const [settingPreferred, setSettingPreferred] = useState(false);

  const preferredAccount = bankAccounts.find((a) => a.isPreferred);
  const hasPendingWithdrawal = withdrawalRequests.some((r) => r.status === "PENDING");
  const withdrawCoins = parseInt(withdrawAmount) || 0;

  // ── ADD ACCOUNT ──────────────────────────────
  async function handleAddAccount() {
    if (!accountForm.bankName || !accountForm.accountNumber || !accountForm.accountName) return;
    setSavingAccount(true);
    try {
      const res = await fetch("/api/model/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Bank account added!" });
      setAddAccountOpen(false);
      setAccountForm({ bankName: "", accountNumber: "", accountName: "" });
      router.refresh();
    } catch (err: any) {
      toast({ title: "Failed to add account", description: err.message, variant: "destructive" });
    } finally {
      setSavingAccount(false);
    }
  }

  // ── SET PREFERRED ─────────────────────────────
  async function handleSetPreferred() {
    if (!setPreferredId) return;
    setSettingPreferred(true);
    try {
      const res = await fetch("/api/model/bank-accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: setPreferredId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Preferred account updated!" });
      setSetPreferredId(null);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSettingPreferred(false);
    }
  }

  // ── WITHDRAW ──────────────────────────────────
  async function handleWithdraw() {
    if (withdrawCoins < MIN_WITHDRAWAL || !selectedAccountId) return;
    setWithdrawLoading(true);
    try {
      const res = await fetch("/api/model/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coinsAmount: withdrawCoins, bankAccountId: selectedAccountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Withdrawal requested!", description: "Admin will process your payout shortly." });
      setWithdrawOpen(false);
      setWithdrawAmount("");
      router.refresh();
    } catch (err: any) {
      toast({ title: "Withdrawal failed", description: err.message, variant: "destructive" });
    } finally {
      setWithdrawLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        <PageHeader
          title="My Wallet"
          description="Earnings, withdrawals and bank accounts"
          action={
            wallet.balance >= MIN_WITHDRAWAL && bankAccounts.length > 0 ? (
              <Button
                onClick={() => setWithdrawOpen(true)}
                disabled={hasPendingWithdrawal}
                className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
              >
                <Banknote className="mr-2 h-4 w-4" />
                {hasPendingWithdrawal ? "Withdrawal Pending..." : "Withdraw"}
              </Button>
            ) : undefined
          }
        />

        {/* Pending withdrawal banner */}
        {hasPendingWithdrawal && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Withdrawal under review</p>
              <p className="text-xs text-muted-foreground">
                Your withdrawal request is pending admin approval.
              </p>
            </div>
          </div>
        )}

        {/* Balance cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-gold/20 bg-card overflow-hidden">
            <div className="h-0.5 bg-gold-gradient" />
            <div className="p-5 space-y-1">
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-2xl font-bold text-gold-gradient">{formatCoins(wallet.balance)}</p>
              <p className="text-xs text-muted-foreground">≈ {coinsToNairaFormatted(wallet.balance)}</p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-card overflow-hidden">
            <div className="h-0.5 bg-amber-500" />
            <div className="p-5 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />Pending
              </p>
              <p className="text-2xl font-bold text-amber-400">{formatCoins(wallet.pendingCoins)}</p>
              <p className="text-xs text-muted-foreground">Awaiting redemption</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl border border-border bg-card p-1">
          {(
            [
              { key: "transactions", label: "Transactions" },
              { key: "accounts", label: "Bank Accounts" },
              { key: "withdrawals", label: "Withdrawals" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-medium transition-all",
                activeTab === key
                  ? "bg-gold-gradient text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* TRANSACTIONS */}
        {activeTab === "transactions" && (
          <div className="space-y-1">
            {transactions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 py-12 text-center">
                <Wallet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {transactions.map((tx) => {
                  const config = TX_CONFIG[tx.type] ?? { label: tx.type, direction: "out" };
                  const isPending = tx.status === "PENDING";
                  const isIn = config.direction === "in";
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        isPending ? "bg-amber-500/10 text-amber-400"
                          : isIn ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-destructive/10 text-destructive"
                      )}>
                        {isPending ? <Clock className="h-4 w-4" />
                          : isIn ? <ArrowDownLeft className="h-4 w-4" />
                          : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{config.label}</p>
                          {isPending && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/20 text-amber-400">
                              Pending
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn("text-sm font-semibold",
                          isPending ? "text-amber-400" : isIn ? "text-emerald-400" : "text-destructive")}>
                          {isIn ? "+" : "−"}{formatCoins(tx.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* BANK ACCOUNTS */}
        {activeTab === "accounts" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-gold shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-foreground">Account name must match your full name</p>
                <p className="text-xs text-muted-foreground">
                  Your registered name is <span className="text-gold font-semibold">{fullName}</span>.
                  The account name you enter must match this exactly. Once added, accounts are locked — only admin can remove them.
                </p>
              </div>
            </div>

            {bankAccounts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 py-12 text-center space-y-3">
                <Building2 className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">No bank accounts added yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bankAccounts.map((account) => (
                  <div key={account.id}
                    className={cn(
                      "rounded-xl border bg-card overflow-hidden",
                      account.isPreferred ? "border-gold/30" : "border-border"
                    )}
                  >
                    <div className={cn("h-0.5", account.isPreferred ? "bg-gold-gradient" : "bg-border")} />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground">{account.bankName}</p>
                            {account.isPreferred && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gold/20 text-gold">
                                Preferred
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground gap-1">
                              <Lock className="h-2.5 w-2.5" />Locked
                            </Badge>
                          </div>
                          <p className="font-mono text-sm text-foreground tracking-widest">
                            {account.accountNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">{account.accountName}</p>
                        </div>
                        {!account.isPreferred && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSetPreferredId(account.id)}
                            className="shrink-0 border-gold/30 text-gold hover:bg-gold/10 gap-1.5 h-8 text-xs"
                          >
                            <Star className="h-3 w-3" />
                            Set Preferred
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {bankAccounts.length < 2 && (
              <Button
                onClick={() => setAddAccountOpen(true)}
                variant="outline"
                className="w-full border-dashed border-gold/30 text-gold hover:bg-gold/10 gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Bank Account ({bankAccounts.length}/2)
              </Button>
            )}
          </div>
        )}

        {/* WITHDRAWALS */}
        {activeTab === "withdrawals" && (
          <div className="space-y-3">
            {withdrawalRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 py-12 text-center">
                <Banknote className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No withdrawal requests yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {withdrawalRequests.map((req) => {
                  const config = WITHDRAWAL_STATUS_CONFIG[req.status];
                  const StatusIcon = config.icon;
                  return (
                    <div key={req.id} className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className={cn("h-0.5",
                        req.status === "APPROVED" ? "bg-gold-gradient"
                          : req.status === "PENDING" ? "bg-amber-500" : "bg-destructive")} />
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-foreground">₦{req.nairaAmount.toLocaleString()}</p>
                            <p className="text-xs text-gold">{formatCoins(req.coinsAmount)}</p>
                          </div>
                          <Badge variant="outline" className={cn("gap-1 text-xs", config.className)}>
                            <StatusIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {req.bankAccount.bankName} — {req.bankAccount.accountNumber}
                        </div>
                        {req.adminNote && (
                          <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
                            Admin: {req.adminNote}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.createdAt).toLocaleDateString("en-NG", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ADD ACCOUNT MODAL */}
      <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gold" />
              Add Bank Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Account name must exactly match your registered name:{" "}
                <span className="text-amber-400 font-semibold">{fullName}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Bank Name</Label>
              <Input placeholder="e.g. First Bank" value={accountForm.bankName}
                onChange={(e) => setAccountForm((p) => ({ ...p, bankName: e.target.value }))}
                className="bg-secondary border-border focus:border-gold" />
            </div>

            <div className="space-y-1.5">
              <Label>Account Number</Label>
              <Input placeholder="10-digit number" value={accountForm.accountNumber} maxLength={10}
                onChange={(e) => setAccountForm((p) => ({ ...p, accountNumber: e.target.value.replace(/\D/g, "") }))}
                className="bg-secondary border-border focus:border-gold font-mono tracking-widest" />
            </div>

            <div className="space-y-1.5">
              <Label>Account Name</Label>
              <Input placeholder={fullName} value={accountForm.accountName}
                onChange={(e) => setAccountForm((p) => ({ ...p, accountName: e.target.value }))}
                className="bg-secondary border-border focus:border-gold" />
              <p className="text-xs text-muted-foreground">
                Must match exactly: <span className="text-gold">{fullName}</span>
              </p>
            </div>

            <Button
              onClick={handleAddAccount}
              disabled={
                savingAccount ||
                !accountForm.bankName ||
                accountForm.accountNumber.length !== 10 ||
                !accountForm.accountName
              }
              className="w-full bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-40"
            >
              {savingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* WITHDRAW MODAL */}
      <Dialog open={withdrawOpen} onOpenChange={(o) => { setWithdrawOpen(o); setWithdrawAmount(""); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-gold" />
              Request Withdrawal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-border bg-secondary p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Available balance</p>
              <p className="text-xl font-bold text-gold-gradient">{formatCoins(wallet.balance)}</p>
              <p className="text-xs text-muted-foreground">≈ {coinsToNairaFormatted(wallet.balance)}</p>
            </div>

            {/* Select account */}
            <div className="space-y-2">
              <Label>Payout Account</Label>
              <div className="space-y-2">
                {bankAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => setSelectedAccountId(account.id)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg border p-3 text-left transition-all",
                      selectedAccountId === account.id
                        ? "border-gold bg-gold/10"
                        : "border-border bg-secondary hover:border-gold/40"
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{account.bankName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{account.accountNumber}</p>
                    </div>
                    {account.isPreferred && (
                      <Badge variant="outline" className="text-[10px] border-gold/20 text-gold">Preferred</Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Amount (DC)</Label>
              <Input type="number" placeholder={`Min ${MIN_WITHDRAWAL.toLocaleString()} DC`}
                value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                className="bg-secondary border-border focus:border-gold" />
              {withdrawCoins > 0 && (
                <p className="text-xs text-gold font-medium">
                  = ₦{coinsToNaira(withdrawCoins).toLocaleString()}
                </p>
              )}
              {withdrawCoins > 0 && withdrawCoins > wallet.balance && (
                <p className="text-xs text-destructive">Exceeds available balance</p>
              )}
            </div>

            <Button
              onClick={handleWithdraw}
              disabled={
                withdrawLoading ||
                withdrawCoins < MIN_WITHDRAWAL ||
                withdrawCoins > wallet.balance ||
                !selectedAccountId
              }
              className="w-full bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-40"
            >
              {withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Withdrawal"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Coins are held pending admin approval. Rejected requests are fully refunded.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* SET PREFERRED CONFIRM */}
      <AlertDialog open={!!setPreferredId} onOpenChange={(o) => !o && setSetPreferredId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Set as Preferred Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This account will be used by default for all future withdrawal requests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSetPreferred}
              disabled={settingPreferred}
              className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90"
            >
              {settingPreferred ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, Set Preferred"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}