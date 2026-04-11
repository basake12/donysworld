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
  Building2, User, Trash2, Lock, CreditCard,
} from "lucide-react";
import { formatCoins } from "@/lib/coins";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// ─── TYPES ──────────────────────────────────────

interface WithdrawalRequest {
  id: string; coinsAmount: number; nairaAmount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null; reviewedAt: string | null; createdAt: string;
  user: { id: string; fullName: string; nickname: string | null; email: string };
  bankAccount: { id: string; bankName: string; accountNumber: string; accountName: string; isPreferred: boolean };
}

interface ModelBankAccount {
  id: string; bankName: string; accountNumber: string;
  accountName: string; isPreferred: boolean; isLocked: boolean; createdAt: string;
  user: { id: string; fullName: string; nickname: string | null; email: string };
}

// ─── CONFIG ─────────────────────────────────────

const STATUS_CONFIG = {
  PENDING:  { label: "Pending",  icon: Clock,        bar: "bg-amber-500",   badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  APPROVED: { label: "Approved", icon: CheckCircle2, bar: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  REJECTED: { label: "Rejected", icon: XCircle,      bar: "bg-destructive", badge: "bg-destructive/10 text-destructive border-destructive/20" },
} as const;

// ─── COMPONENT ──────────────────────────────────

export function AdminWithdrawalsClient({
  requests, allModelAccounts,
}: {
  requests: WithdrawalRequest[];
  allModelAccounts: ModelBankAccount[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab]         = useState<"requests" | "accounts">("requests");
  const [statusFilter, setStatusFilter]   = useState("all");
  const [actionModal, setActionModal]     = useState<{ request: WithdrawalRequest; action: "approve" | "reject" } | null>(null);
  const [adminNote, setAdminNote]         = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  const counts = useMemo(() => ({
    all:      requests.length,
    PENDING:  requests.filter((r) => r.status === "PENDING").length,
    APPROVED: requests.filter((r) => r.status === "APPROVED").length,
    REJECTED: requests.filter((r) => r.status === "REJECTED").length,
  }), [requests]);

  async function executeAction() {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      const res  = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: actionModal.request.id,
          action:    actionModal.action,
          adminNote: adminNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: actionModal.action === "approve" ? "Withdrawal approved!" : "Withdrawal rejected" });
      setActionModal(null);
      setAdminNote("");
      router.refresh();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteAccount(id: string) {
    setDeleteLoading(true);
    try {
      const res  = await fetch("/api/admin/model-bank-accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Account deleted" });
      setDeleteAccountId(null);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-5">

        {/* ── HEADER ──────────────────────────── */}
        <PageHeader title="Withdrawals" description="Manage model withdrawal requests and bank accounts" />

        {/* ── TABS ────────────────────────────── */}
        <div className="flex rounded-2xl border border-border bg-card p-1.5 gap-1">
          {([
            { key: "requests", label: `Requests (${requests.length})` },
            { key: "accounts", label: `Bank Accounts (${allModelAccounts.length})` },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={cn(
                "flex-1 rounded-xl py-2 text-xs font-bold transition-all",
                activeTab === key
                  ? "bg-gold-gradient text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}>
              {label}
            </button>
          ))}
        </div>

        {/* ── REQUESTS TAB ────────────────────── */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            {/* Status filter */}
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { key: "all",      label: "All",      count: counts.all },
                { key: "PENDING",  label: "Pending",  count: counts.PENDING },
                { key: "APPROVED", label: "Approved", count: counts.APPROVED },
                { key: "REJECTED", label: "Rejected", count: counts.REJECTED },
              ]).map(({ key, label, count }) => (
                <button key={key} onClick={() => setStatusFilter(key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all",
                    statusFilter === key
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-border text-muted-foreground hover:border-gold/30"
                  )}>
                  {label}
                  <span className={cn(
                    "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black",
                    statusFilter === key ? "bg-gold text-black" : "bg-secondary text-muted-foreground"
                  )}>{count}</span>
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <EmptyState icon={Banknote} title="No withdrawal requests"
                description={statusFilter !== "all" ? `No ${statusFilter.toLowerCase()} requests.` : "No models have requested withdrawals yet."} />
            ) : (
              <div className="space-y-3">
                {filtered.map((req) => {
                  const config     = STATUS_CONFIG[req.status];
                  const StatusIcon = config.icon;
                  return (
                    <div key={req.id} className="rounded-2xl border border-border bg-card overflow-hidden hover:border-gold/15 transition-all">
                      <div className={cn("h-0.5", config.bar)} />
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary border border-border text-sm font-black text-muted-foreground">
                            {req.user.fullName[0]}
                          </div>

                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-bold text-foreground">{req.user.nickname ?? req.user.fullName}</p>
                                <p className="text-[10px] text-muted-foreground">{req.user.email}</p>
                              </div>
                              <Badge variant="outline" className={cn("shrink-0 gap-1 text-[10px] rounded-lg px-2 py-0.5 border", config.badge)}>
                                <StatusIcon className="h-2.5 w-2.5" />{config.label}
                              </Badge>
                            </div>

                            {/* Amounts */}
                            <div className="flex gap-2">
                              <div className="rounded-xl border border-gold/20 bg-gold/5 px-3 py-1.5">
                                <p className="text-[10px] text-muted-foreground">Withdraw</p>
                                <p className="text-sm font-black text-foreground">₦{req.nairaAmount.toLocaleString()}</p>
                              </div>
                              <div className="rounded-xl border border-border bg-secondary px-3 py-1.5">
                                <p className="text-[10px] text-muted-foreground">Coins</p>
                                <p className="text-sm font-black text-foreground">{formatCoins(req.coinsAmount)}</p>
                              </div>
                            </div>

                            {/* Bank info */}
                            <div className="rounded-xl border border-border bg-secondary px-3 py-2 text-xs space-y-0.5">
                              <p className="text-muted-foreground font-semibold">{req.bankAccount.bankName}</p>
                              <p className="font-mono text-foreground tracking-widest">{req.bankAccount.accountNumber}</p>
                              <p className="text-muted-foreground">{req.bankAccount.accountName}</p>
                            </div>

                            {req.adminNote && (
                              <p className="text-[10px] text-muted-foreground bg-secondary rounded-xl px-3 py-1.5">Note: {req.adminNote}</p>
                            )}

                            <p className="text-[10px] text-muted-foreground">
                              {new Date(req.createdAt).toLocaleDateString("en-NG", {
                                day: "numeric", month: "short", year: "numeric",
                              })}
                            </p>
                          </div>

                          {req.status === "PENDING" && (
                            <div className="flex flex-col gap-1.5 shrink-0">
                              <Button size="sm" onClick={() => setActionModal({ request: req, action: "approve" })}
                                className="bg-gold-gradient text-black font-black hover:opacity-90 h-8 text-[11px] rounded-xl px-3">
                                <CheckCircle2 className="mr-1 h-3 w-3" />Approve
                              </Button>
                              <Button size="sm" variant="outline"
                                onClick={() => setActionModal({ request: req, action: "reject" })}
                                className="border-destructive/30 text-destructive hover:bg-destructive/10 h-8 text-[11px] rounded-xl px-3">
                                <XCircle className="mr-1 h-3 w-3" />Reject
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

        {/* ── ACCOUNTS TAB ────────────────────── */}
        {activeTab === "accounts" && (
          <div className="space-y-3">
            {allModelAccounts.length === 0 ? (
              <EmptyState icon={Building2} title="No bank accounts" description="No models have added bank accounts yet." />
            ) : (
              allModelAccounts.map((account) => (
                <div key={account.id}
                  className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3 hover:border-gold/15 transition-all">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary border border-border">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-bold text-foreground">{account.accountName}</p>
                    <p className="text-xs text-muted-foreground">{account.bankName}</p>
                    <p className="font-mono text-xs text-foreground tracking-widest">{account.accountNumber}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <User className="h-2.5 w-2.5" />
                      {account.user.nickname ?? account.user.fullName} · {account.user.email}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0 items-end">
                    {account.isLocked ? (
                      <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary px-2 py-1">
                        <Lock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Locked</span>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline"
                        onClick={() => setDeleteAccountId(account.id)}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 h-7 text-[10px] rounded-lg px-2">
                        <Trash2 className="h-2.5 w-2.5 mr-1" />Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── ACTION CONFIRM ───────────────────── */}
      <AlertDialog open={!!actionModal} onOpenChange={(open) => { if (!open) { setActionModal(null); setAdminNote(""); } }}>
        <AlertDialogContent className="bg-card border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black font-playfair">
              {actionModal?.action === "approve" ? "Approve Withdrawal?" : "Reject Withdrawal?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionModal?.action === "approve"
                ? `This will mark the ₦${actionModal?.request.nairaAmount.toLocaleString()} withdrawal as approved. Transfer the funds manually.`
                : "The model will be notified. No transfer will be made."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 space-y-1.5">
            <Label className="text-xs font-semibold">Admin Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              placeholder="Add a note..."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="h-11 bg-secondary border-border focus:border-gold rounded-xl"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction} disabled={actionLoading}
              className={cn("font-black rounded-xl",
                actionModal?.action === "approve"
                  ? "bg-gold-gradient text-black hover:opacity-90"
                  : "bg-destructive text-destructive-foreground"
              )}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                actionModal?.action === "approve" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── DELETE CONFIRM ───────────────────── */}
      <AlertDialog open={!!deleteAccountId} onOpenChange={(open) => !open && setDeleteAccountId(null)}>
        <AlertDialogContent className="bg-card border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black font-playfair">Delete Bank Account?</AlertDialogTitle>
            <AlertDialogDescription>This is permanent and cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAccountId && deleteAccount(deleteAccountId)}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground font-black rounded-xl">
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}