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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Eye,
  Save,
  Coins,
  User,
  Mail,
} from "lucide-react";
import { formatCoins } from "@/lib/coins";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface FundingRequest {
  id: string;
  nairaAmount: number;
  coinsAmount: number;
  proofImageUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    whatsappNumber: string;
  };
}

type BankAccount = {
  bankName: string;
  accountNumber: string;
  accountName: string;
} | null;

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const STATUS_CONFIG = {
  PENDING: {
    label: "Pending",
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

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export function AdminFundRequestsClient({
  requests,
  bankAccount: initialBankAccount,
}: {
  requests: FundingRequest[];
  bankAccount: BankAccount;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState("all");
  const [proofModal, setProofModal] = useState<FundingRequest | null>(null);
  const [actionModal, setActionModal] = useState<{
    request: FundingRequest;
    action: "approve" | "reject";
  } | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Bank account state
  const [bankForm, setBankForm] = useState({
    bankName: initialBankAccount?.bankName ?? "",
    accountNumber: initialBankAccount?.accountNumber ?? "",
    accountName: initialBankAccount?.accountName ?? "",
  });
  const [savingBank, setSavingBank] = useState(false);
  const [bankSettingsOpen, setBankSettingsOpen] = useState(false);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return requests;
    return requests.filter((r) => r.status === statusFilter.toUpperCase());
  }, [requests, statusFilter]);

  const counts = useMemo(
    () => ({
      all: requests.length,
      PENDING: requests.filter((r) => r.status === "PENDING").length,
      APPROVED: requests.filter((r) => r.status === "APPROVED").length,
      REJECTED: requests.filter((r) => r.status === "REJECTED").length,
    }),
    [requests]
  );

  async function saveBank() {
    if (
      !bankForm.bankName ||
      !bankForm.accountNumber ||
      !bankForm.accountName
    )
      return;
    setSavingBank(true);
    try {
      const res = await fetch("/api/admin/bank-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bankForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Bank account saved!" });
      setBankSettingsOpen(false);
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Failed to save",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingBank(false);
    }
  }

  async function executeAction() {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/fund-requests", {
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
        title:
          actionModal.action === "approve"
            ? "Payment approved — coins credited!"
            : "Request rejected",
      });
      setActionModal(null);
      setAdminNote("");
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Action failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* ── HEADER ──────────────────────────── */}
        <PageHeader
          title="Funding Requests"
          description="Review client payment proofs and credit wallets"
          action={
            <Button
              variant="outline"
              onClick={() => setBankSettingsOpen(true)}
              className="border-gold/30 text-gold hover:bg-gold/10 gap-2"
            >
              <Building2 className="h-4 w-4" />
              Bank Account Settings
            </Button>
          }
        />

        {/* ── STATUS TABS ─────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { key: "all", label: "All" },
              { key: "PENDING", label: "Pending" },
              { key: "APPROVED", label: "Approved" },
              { key: "REJECTED", label: "Rejected" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                statusFilter === key
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border text-muted-foreground hover:border-gold/30 hover:text-foreground"
              )}
            >
              {label}
              <span
                className={cn(
                  "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  statusFilter === key
                    ? "bg-gold text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {counts[key === "all" ? "all" : key]}
              </span>
            </button>
          ))}
        </div>

        {/* ── REQUESTS LIST ───────────────────── */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No funding requests"
            description={
              statusFilter !== "all"
                ? `No ${statusFilter.toLowerCase()} requests.`
                : "No clients have submitted funding requests yet."
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((req) => {
              const config = STATUS_CONFIG[req.status];
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
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Client info */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 border border-gold/20 text-sm font-bold text-gold">
                        {req.user.fullName[0]}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="font-semibold text-foreground flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              {req.user.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {req.user.email}
                            </p>
                          </div>
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
                        </div>

                        {/* Amount */}
                        <div className="flex items-center gap-3 pt-1">
                          <div className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-1.5">
                            <p className="text-xs text-muted-foreground">
                              Amount
                            </p>
                            <p className="font-bold text-foreground">
                              ₦{req.nairaAmount.toLocaleString()}
                            </p>
                          </div>
                          <div className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-1.5">
                            <p className="text-xs text-muted-foreground">
                              Coins
                            </p>
                            <p className="font-bold text-gold flex items-center gap-1">
                              <Coins className="h-3 w-3" />
                              {formatCoins(req.coinsAmount)}
                            </p>
                          </div>
                        </div>

                        {req.adminNote && (
                          <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-1.5">
                            Note: {req.adminNote}
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

                      {/* Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setProofModal(req)}
                          className="border-border text-muted-foreground hover:text-foreground gap-1.5 h-8 text-xs"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Proof
                        </Button>
                        {req.status === "PENDING" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() =>
                                setActionModal({ request: req, action: "approve" })
                              }
                              className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 h-8 text-xs"
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setActionModal({ request: req, action: "reject" })
                              }
                              className="border-destructive/30 text-destructive hover:bg-destructive/10 h-8 text-xs"
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PROOF MODAL ───────────────────────── */}
      <Dialog
        open={!!proofModal}
        onOpenChange={(open) => !open && setProofModal(null)}
      >
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
          </DialogHeader>
          {proofModal && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{proofModal.user.fullName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-gold">
                  ₦{proofModal.nairaAmount.toLocaleString()} ={" "}
                  {formatCoins(proofModal.coinsAmount)}
                </span>
              </div>
              <div className="rounded-xl overflow-hidden border border-border">
                <img
                  src={proofModal.proofImageUrl}
                  alt="Payment proof"
                  className="w-full max-h-96 object-contain bg-secondary"
                />
              </div>
              {proofModal.status === "PENDING" && (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setProofModal(null);
                      setActionModal({ request: proofModal, action: "reject" });
                    }}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setProofModal(null);
                      setActionModal({ request: proofModal, action: "approve" });
                    }}
                    className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90"
                  >
                    Approve
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── BANK SETTINGS MODAL ───────────────── */}
      <Dialog open={bankSettingsOpen} onOpenChange={setBankSettingsOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gold" />
              Bank Account Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">
              This is the account clients will transfer to when funding
              their wallets.
            </p>

            <div className="space-y-1.5">
              <Label>Bank Name</Label>
              <Input
                placeholder="e.g. First Bank of Nigeria"
                value={bankForm.bankName}
                onChange={(e) =>
                  setBankForm((p) => ({ ...p, bankName: e.target.value }))
                }
                className="bg-secondary border-border focus:border-gold"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Account Number</Label>
              <Input
                placeholder="10-digit account number"
                value={bankForm.accountNumber}
                maxLength={10}
                onChange={(e) =>
                  setBankForm((p) => ({
                    ...p,
                    accountNumber: e.target.value.replace(/\D/g, ""),
                  }))
                }
                className="bg-secondary border-border focus:border-gold font-mono tracking-widest"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Account Name</Label>
              <Input
                placeholder="e.g. Dony's World Ltd"
                value={bankForm.accountName}
                onChange={(e) =>
                  setBankForm((p) => ({
                    ...p,
                    accountName: e.target.value,
                  }))
                }
                className="bg-secondary border-border focus:border-gold"
              />
            </div>

            <Button
              onClick={saveBank}
              disabled={
                savingBank ||
                !bankForm.bankName ||
                bankForm.accountNumber.length !== 10 ||
                !bankForm.accountName
              }
              className="w-full bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-40"
            >
              {savingBank ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Bank Account
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── APPROVE / REJECT CONFIRM ──────────── */}
      <AlertDialog
        open={!!actionModal}
        onOpenChange={(open) => {
          if (!open) {
            setActionModal(null);
            setAdminNote("");
          }
        }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionModal?.action === "approve"
                ? "Approve Payment?"
                : "Reject Payment?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionModal?.action === "approve"
                ? `This will credit ${formatCoins(actionModal?.request.coinsAmount ?? 0)} to ${actionModal?.request.user.fullName}'s wallet immediately.`
                : "The client will be notified and no coins will be credited."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="px-1 space-y-1.5">
            <Label className="text-sm">
              Admin Note{" "}
              {actionModal?.action === "reject" && (
                <span className="text-muted-foreground">(recommended)</span>
              )}
            </Label>
            <Input
              placeholder={
                actionModal?.action === "approve"
                  ? "Optional note..."
                  : "Reason for rejection..."
              }
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="bg-secondary border-border focus:border-gold"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAction}
              disabled={actionLoading}
              className={cn(
                "font-semibold",
                actionModal?.action === "approve"
                  ? "bg-gold-gradient text-primary-foreground hover:opacity-90"
                  : "bg-destructive text-destructive-foreground"
              )}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : actionModal?.action === "approve" ? (
                "Approve & Credit"
              ) : (
                "Reject"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}