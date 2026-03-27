"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Wallet,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Loader2,
  Info,
  Copy,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Image as ImageIcon,
} from "lucide-react";
import {
  formatCoins,
  coinsToNairaFormatted,
  nairaToCoins,
} from "@/lib/coins";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface Transaction {
  id: string;
  type: string;
  status: string;
  amount: number;
  description: string;
  createdAt: string;
}

interface FundingRequest {
  id: string;
  nairaAmount: number;
  coinsAmount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null;
  createdAt: string;
}

interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

interface WalletProps {
  wallet: { id: string; balance: number; pendingCoins: number };
  transactions: Transaction[];
  fundingRequests: FundingRequest[];
  bankAccount: BankAccount | null;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

interface TxConfig { label: string; color: string; direction: "in" | "out" }
interface TxTypeMap { [key: string]: TxConfig }

const TX_TYPE_CONFIG: TxTypeMap = {
  FUND_WALLET: { label: "Wallet Funded", color: "text-emerald-400", direction: "in" },
  OFFER_DEBIT: { label: "Offer Sent", color: "text-destructive", direction: "out" },
  OFFER_CREDIT: { label: "Offer Refund", color: "text-emerald-400", direction: "in" },
  FACE_REVEAL_DEBIT: { label: "Face Reveal", color: "text-destructive", direction: "out" },
  FACE_REVEAL_CREDIT: { label: "Reveal Earning", color: "text-emerald-400", direction: "in" },
  CONNECTION_FEE: { label: "Connection Fee", color: "text-destructive", direction: "out" },
  REDEMPTION: { label: "Redemption", color: "text-emerald-400", direction: "in" },
};

const REQUEST_STATUS_CONFIG = {
  PENDING: {
    label: "Under Review",
    icon: Clock,
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  APPROVED: {
    label: "Approved",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
} as const;

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000, 100000];

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export function ClientWalletClient({
  wallet,
  transactions,
  fundingRequests,
  bankAccount,
}: WalletProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fundOpen, setFundOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [nairaAmount, setNairaAmount] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"transactions" | "requests">(
    "transactions"
  );

  const nairaValue = parseInt(nairaAmount) || 0;
  const coinValue = nairaToCoins(nairaValue);
  const hasPending = fundingRequests.some((r) => r.status === "PENDING");

  function handleProofFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Max 5MB",
        variant: "destructive",
      });
      return;
    }
    setProofFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function copyAccountNumber() {
    if (!bankAccount) return;
    navigator.clipboard.writeText(bankAccount.accountNumber);
    toast({ title: "Account number copied!" });
  }

  function resetModal() {
    setStep(1);
    setNairaAmount("");
    setProofFile(null);
    setProofPreview(null);
    setFundOpen(false);
  }

  async function handleSubmitProof() {
    if (!proofFile || nairaValue < 1000) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("nairaAmount", nairaValue.toString());
      formData.append("proof", proofFile);

      const res = await fetch("/api/wallet/fund-request", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      toast({
        title: "Request submitted!",
        description: "Admin will review your payment and credit your wallet shortly.",
      });
      resetModal();
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        {/* ── HEADER ────────────────────────────── */}
        <PageHeader
          title="My Wallet"
          description="Manage your Dony's Coins balance"
          action={
            <Button
              onClick={() => setFundOpen(true)}
              disabled={hasPending}
              className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="mr-2 h-4 w-4" />
              {hasPending ? "Request Pending..." : "Fund Wallet"}
            </Button>
          }
        />

        {/* ── PENDING REQUEST BANNER ────────────── */}
        {hasPending && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Funding request under review
              </p>
              <p className="text-xs text-muted-foreground">
                Your payment proof has been submitted. Admin will approve
                and credit your wallet shortly.
              </p>
            </div>
          </div>
        )}

        {/* ── BALANCE CARD ──────────────────────── */}
        <div className="rounded-xl border border-gold/20 bg-card overflow-hidden">
          <div className="h-0.5 bg-gold-gradient" />
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Available Balance
                </p>
                <p className="text-4xl font-bold text-gold-gradient">
                  {formatCoins(wallet.balance)}
                </p>
                <p className="text-sm text-muted-foreground">
                  ≈ {coinsToNairaFormatted(wallet.balance)}
                </p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10 border border-gold/20">
                <Coins className="h-8 w-8 text-gold" />
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-gold/10 bg-gold/5 p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-gold shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                1 Dony&apos;s Coin = ₦10. Fund your wallet via bank
                transfer. Coins are credited after admin confirms payment.
              </p>
            </div>
          </div>
        </div>

        {/* ── TABS ──────────────────────────────── */}
        <div className="flex rounded-xl border border-border bg-card p-1">
          {(
            [
              { key: "transactions", label: "Transactions" },
              { key: "requests", label: "Funding Requests" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex-1 rounded-lg py-2 text-sm font-medium transition-all",
                activeTab === key
                  ? "bg-gold-gradient text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {key === "requests" &&
                fundingRequests.filter((r) => r.status === "PENDING")
                  .length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                    {
                      fundingRequests.filter((r) => r.status === "PENDING")
                        .length
                    }
                  </span>
                )}
            </button>
          ))}
        </div>

        {/* ── TRANSACTIONS ──────────────────────── */}
        {activeTab === "transactions" && (
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 py-12 text-center">
                <Wallet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No transactions yet
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {transactions.map((tx) => {
                  const config = TX_TYPE_CONFIG[tx.type] ?? {
                    label: tx.type,
                    color: "text-muted-foreground",
                    direction: "out",
                  };
                  const isIn = config.direction === "in";
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                          isIn
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-destructive/10 text-destructive"
                        )}
                      >
                        {isIn ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {config.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {tx.description}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn("text-sm font-semibold", config.color)}>
                          {isIn ? "+" : "−"}
                          {formatCoins(tx.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
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

        {/* ── FUNDING REQUESTS ──────────────────── */}
        {activeTab === "requests" && (
          <div className="space-y-3">
            {fundingRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 py-12 text-center">
                <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No funding requests yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {fundingRequests.map((req) => {
                  const config = REQUEST_STATUS_CONFIG[req.status];
                  const StatusIcon = config.icon;
                  return (
                    <div
                      key={req.id}
                      className="rounded-xl border border-border bg-card overflow-hidden"
                    >
                      <div
                        className={cn(
                          "h-0.5",
                          req.status === "APPROVED"
                            ? "bg-gold-gradient"
                            : req.status === "PENDING"
                            ? "bg-amber-500"
                            : "bg-destructive"
                        )}
                      />
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-foreground">
                              ₦{req.nairaAmount.toLocaleString()}
                            </p>
                            <p className="text-xs text-gold">
                              = {formatCoins(req.coinsAmount)}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("gap-1 text-xs", config.className)}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </div>
                        {req.adminNote && (
                          <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
                            Admin note: {req.adminNote}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.createdAt).toLocaleDateString(
                            "en-NG",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
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

      {/* ── FUND WALLET MODAL ─────────────────── */}
      <Dialog open={fundOpen} onOpenChange={resetModal}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gold" />
              Fund Wallet via Bank Transfer
            </DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={cn(
                  "flex-1 h-1 rounded-full transition-all",
                  step >= s ? "bg-gold" : "bg-border"
                )}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground -mt-1">
            <span>Enter Amount</span>
            <span>Upload Proof</span>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              {/* Bank details */}
              {bankAccount ? (
                <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 space-y-3">
                  <p className="text-xs font-semibold text-gold uppercase tracking-wider">
                    Transfer to this account
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Bank</span>
                      <span className="text-foreground font-semibold">
                        {bankAccount.bankName}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">
                        Account Number
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-mono font-bold text-base tracking-widest">
                          {bankAccount.accountNumber}
                        </span>
                        <button
                          onClick={copyAccountNumber}
                          className="text-gold hover:text-gold-light"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Account Name
                      </span>
                      <span className="text-foreground font-semibold">
                        {bankAccount.accountName}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
                  <p className="text-sm text-destructive">
                    Bank account not configured yet. Contact support.
                  </p>
                </div>
              )}

              {/* Amount */}
              <div className="space-y-1.5">
                <Label>Amount to Transfer (₦)</Label>
                <Input
                  type="number"
                  placeholder="Minimum ₦1,000"
                  value={nairaAmount}
                  onChange={(e) => setNairaAmount(e.target.value)}
                  className="bg-secondary border-border focus:border-gold"
                />
                {coinValue > 0 && (
                  <p className="text-xs text-gold font-medium">
                    You will receive {formatCoins(coinValue)}
                  </p>
                )}
              </div>

              {/* Quick amounts */}
              <div className="grid grid-cols-5 gap-1.5">
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setNairaAmount(amount.toString())}
                    className={cn(
                      "rounded-lg border px-1.5 py-1.5 text-xs font-medium transition-all",
                      nairaValue === amount
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border text-muted-foreground hover:border-gold/40"
                    )}
                  >
                    ₦{amount >= 1000 ? `${amount / 1000}k` : amount}
                  </button>
                ))}
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={nairaValue < 1000 || !bankAccount}
                className="w-full bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-40"
              >
                I've Made the Transfer →
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-secondary p-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-foreground font-semibold">
                  ₦{nairaValue.toLocaleString()} = {formatCoins(coinValue)}
                </span>
              </div>

              {/* Proof upload */}
              <div className="space-y-2">
                <Label>Upload Payment Proof</Label>
                <p className="text-xs text-muted-foreground">
                  Upload a screenshot of your bank transfer receipt or
                  confirmation.
                </p>

                {proofPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-gold/20 bg-secondary">
                    <img
                      src={proofPreview}
                      alt="Proof preview"
                      className="w-full max-h-48 object-contain"
                    />
                    <button
                      onClick={() => {
                        setProofFile(null);
                        setProofPreview(null);
                      }}
                      className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="proofUpload"
                    className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gold/30 bg-gold/5 p-6 cursor-pointer hover:border-gold/60 hover:bg-gold/10 transition-all"
                  >
                    <ImageIcon className="h-8 w-8 text-gold/60" />
                    <p className="text-sm text-muted-foreground text-center">
                      Click to upload screenshot
                      <br />
                      <span className="text-xs">JPG, PNG or WebP · Max 5MB</span>
                    </p>
                    <input
                      id="proofUpload"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleProofFile}
                    />
                  </label>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 border-border"
                >
                  ← Back
                </Button>
                <Button
                  onClick={handleSubmitProof}
                  disabled={!proofFile || loading}
                  className="flex-1 bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-40"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Submit Proof
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}