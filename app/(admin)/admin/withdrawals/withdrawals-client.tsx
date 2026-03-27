"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Banknote, CheckCircle2, XCircle, Clock, Loader2,
  Building2, User, Trash2, Lock,
} from "lucide-react";
import { formatCoins } from "@/lib/coins";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface WithdrawalRequest {
  id: string; coinsAmount: number; nairaAmount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null; reviewedAt: string | null; createdAt: string;
  user: { id: string; fullName: string; nickname: string | null; email: string };
  bankAccount: {
    id: string; bankName: string; accountNumber: string;
    accountName: string; isPreferred: boolean;
  };
}

interface ModelBankAccount {
  id: string; bankName: string; accountNumber: string;
  accountName: string; isPreferred: boolean; isLocked: boolean; createdAt: string;
  user: { id: string; fullName: string; nickname: string | null; email: string };
}

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const STATUS_CONFIG = {
  PENDING: { label: "Pending", icon: Clock, className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  APPROVED: { label: "Approved", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  REJECTED: { label: "Rejected", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
} as const;

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export function AdminWithdrawalsClient({
  requests, allModelAccounts,
}: {
  requests: WithdrawalRequest[];
  allModelAccounts: ModelBankAccount[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"requests" | "accounts">("requests");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionModal, setActionModal] = useState<{
    request: WithdrawalRequest;
    action: "approve" | "reject";
  } | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  const counts = useMemo(() => ({
    all: requests.length,
    PENDING: requests.filter((r) => r.status === "PENDING").length,
    APPROVED: requests.filter((r) => r.status === "APPROVED").length,
    REJECTED: requests.filter((r) => r.status === "REJECTED").length,
  }), [requests]);

  async function executeAction() {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: actionModal.request.id,
          action: actionModal.action,
          adminNote: adminNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({
        title: actionModal.action === "approve"
          ? "Withdrawal approved — model notified"
          : "Withdrawal rejected — coins refunded",
      });
      setActionModal(null);
      setAdminNote("");
      router.refresh();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deleteAccountId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(
        `/api/admin/model-bank-accounts?accountId=${deleteAccountId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Bank account removed — model can now re-add" });
      setDeleteAccountId(null);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Withdrawals"
          description="Process model payout requests and manage bank accounts"
        />

        {/* Tabs */}
        <div className="flex rounded-xl border border-border bg-card p-1">
          {(
            [
              { key: "requests", label: `Requests (${requests.length})` },
              { key: "accounts", label: `Model Bank Accounts (${allModelAccounts.length})` },
            ] as const
          ).map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={cn(
                "flex-1 rounded-lg py-2.5 text-sm font-medium transition-all",
                activeTab === key
                  ? "bg-gold-gradient text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}>
              {label}
              {key === "requests" && counts.PENDING > 0 && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  {counts.PENDING}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* WITHDRAWAL REQUESTS */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            {/* Status filter */}
            <div className="flex items-center gap-2 flex-wrap">
              {(["all", "PENDING", "APPROVED", "REJECTED"] as const).map((key) => (
                <button key={key} onClick={() => setStatusFilter(key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                    statusFilter === key
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-border text-muted-foreground hover:border-gold/30"
                  )}>
                  {key === "all" ? "All" : key.charAt(0) + key.slice(1).toLowerCase()}
                  <span className={cn(
                    "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    statusFilter === key ? "bg-gold text-primary-foreground" : "bg-secondary text-muted-foreground"
                  )}>
                    {counts[key === "all" ? "all" : key]}
                  </span>
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <EmptyState icon={Banknote} title="No withdrawal requests"
                description={statusFilter !== "all" ? `No ${statusFilter.toLowerCase()} requests.` : "No requests yet."} />
            ) : (
              <div className="space-y-3">
                {filtered.map((req) => {
                  const config = STATUS_CONFIG[req.status];
                  const StatusIcon = config.icon;
                  return (
                    <div key={req.id} className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className={cn("h-0.5",
                        req.status === "APPROVED" ? "bg-gold-gradient"
                          : req.status === "PENDING" ? "bg-amber-500" : "bg-destructive")} />
                      <div className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 border border-gold/20 text-sm font-bold text-gold">
                            {req.user.fullName[0]}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div>
                                {/* Admin sees full name + nickname */}
                                <p className="font-semibold text-foreground flex items-center gap-1.5">
                                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                                  {req.user.fullName}
                                  {req.user.nickname && (
                                    <span className="text-xs text-muted-foreground font-normal">
                                      ({req.user.nickname})
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">{req.user.email}</p>
                              </div>
                              <Badge variant="outline" className={cn("shrink-0 gap-1 text-xs", config.className)}>
                                <StatusIcon className="h-3 w-3" />
                                {config.label}
                              </Badge>
                            </div>

                            {/* Amounts */}
                            <div className="flex items-center gap-3 pt-1">
                              <div className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-1.5">
                                <p className="text-xs text-muted-foreground">Naira</p>
                                <p className="font-bold text-foreground">₦{req.nairaAmount.toLocaleString()}</p>
                              </div>
                              <div className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-1.5">
                                <p className="text-xs text-muted-foreground">Coins</p>
                                <p className="font-bold text-gold">{formatCoins(req.coinsAmount)}</p>
                              </div>
                            </div>

                            {/* Bank account */}
                            <div className="rounded-lg bg-secondary px-3 py-2 space-y-0.5">
                              <p className="text-xs font-medium text-foreground">{req.bankAccount.bankName}</p>
                              <p className="font-mono text-xs text-muted-foreground">{req.bankAccount.accountNumber}</p>
                              <p className="text-xs text-muted-foreground">{req.bankAccount.accountName}</p>
                            </div>

                            {req.adminNote && (
                              <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
                                Note: {req.adminNote}
                              </p>
                            )}

                            <p className="text-xs text-muted-foreground">
                              {new Date(req.createdAt).toLocaleDateString("en-NG", {
                                day: "numeric", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </p>
                          </div>

                          {/* Actions */}
                          {req.status === "PENDING" && (
                            <div className="flex flex-col gap-2 shrink-0">
                              <Button size="sm"
                                onClick={() => setActionModal({ request: req, action: "approve" })}
                                className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 h-8 text-xs">
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Approve
                              </Button>
                              <Button size="sm" variant="outline"
                                onClick={() => setActionModal({ request: req, action: "reject" })}
                                className="border-destructive/30 text-destructive hover:bg-destructive/10 h-8 text-xs">
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MODEL BANK ACCOUNTS */}
        {activeTab === "accounts" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 flex items-start gap-2">
              <Lock className="h-4 w-4 text-gold shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Bank accounts are locked after binding. Only admins can delete them, which allows the model to re-add a corrected account.
              </p>
            </div>

            {allModelAccounts.length === 0 ? (
              <EmptyState icon={Building2} title="No bank accounts" description="No models have added bank accounts yet." />
            ) : (
              <div className="space-y-3">
                {allModelAccounts.map((account) => (
                  <div key={account.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="h-0.5 bg-gold-gradient" />
                    <div className="p-4 flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary border border-border text-sm font-bold text-muted-foreground">
                        {account.user.fullName[0]}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        {/* Admin sees full name + nickname */}
                        <p className="font-semibold text-foreground text-sm">
                          {account.user.fullName}
                          {account.user.nickname && (
                            <span className="text-xs text-muted-foreground font-normal ml-1.5">
                              ({account.user.nickname})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{account.user.email}</p>
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{account.bankName}</p>
                          {account.isPreferred && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gold/20 text-gold">
                              Preferred
                            </Badge>
                          )}
                        </div>
                        <p className="font-mono text-xs text-muted-foreground tracking-widest">
                          {account.accountNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">{account.accountName}</p>
                      </div>
                      <Button size="sm" variant="outline"
                        onClick={() => setDeleteAccountId(account.id)}
                        className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 h-8 text-xs gap-1">
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* APPROVE / REJECT DIALOG */}
      <AlertDialog open={!!actionModal} onOpenChange={(o) => { if (!o) { setActionModal(null); setAdminNote(""); } }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionModal?.action === "approve" ? "Approve Withdrawal?" : "Reject Withdrawal?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionModal?.action === "approve"
                ? `Transfer ₦${actionModal?.request.nairaAmount.toLocaleString()} to ${actionModal?.request.bankAccount.bankName} — ${actionModal?.request.bankAccount.accountNumber} (${actionModal?.request.bankAccount.accountName}). Mark as approved once payment is sent.`
                : `${formatCoins(actionModal?.request.coinsAmount ?? 0)} will be refunded to the model's wallet.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 space-y-1.5">
            <Label className="text-sm">Admin Note {actionModal?.action === "reject" && "(recommended)"}</Label>
            <Input placeholder={actionModal?.action === "approve" ? "Optional note..." : "Reason for rejection..."}
              value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
              className="bg-secondary border-border focus:border-gold" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction} disabled={actionLoading}
              className={cn("font-semibold",
                actionModal?.action === "approve"
                  ? "bg-gold-gradient text-primary-foreground hover:opacity-90"
                  : "bg-destructive text-destructive-foreground")}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" />
                : actionModal?.action === "approve" ? "Confirm Approved" : "Reject & Refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DELETE ACCOUNT DIALOG */}
      <AlertDialog open={!!deleteAccountId} onOpenChange={(o) => !o && setDeleteAccountId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Bank Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the account and allow the model to add a new one. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground font-semibold">
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}