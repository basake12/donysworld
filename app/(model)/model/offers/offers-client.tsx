"use client";

import { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Separator } from "@/components/ui/separator";
import {
  HandCoins,
  Clock,
  CheckCircle2,
  XCircle,
  Coins,
  Loader2,
  KeyRound,
  User,
  Info,
} from "lucide-react";
import {
  formatCoins,
  coinsToNairaFormatted,
  calculateConnectionFees,
} from "@/lib/coins";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface Offer {
  id: string;
  meetType: "SHORT" | "OVERNIGHT" | "WEEKEND";
  coinsAmount: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  client: {
    id: string;
    fullName: string;
    whatsappNumber: string;
  };
  receipt: {
    couponCode: string;
    isRedeemed: boolean;
  } | null;
}

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const STATUS_CONFIG = {
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

const MEET_LABELS = {
  SHORT: "Short Meet · 1hr",
  OVERNIGHT: "Overnight · 3hrs",
  WEEKEND: "Weekend · 48hrs",
} as const;

// ─────────────────────────────────────────────
// REDEEM MODAL
// ─────────────────────────────────────────────

function RedeemModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (coins: number) => void;
}) {
  const { toast } = useToast();
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRedeem() {
    if (!couponCode.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/offers/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: couponCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Redemption failed");
      onSuccess(data.coinsAdded);
      setCouponCode("");
      onClose();
    } catch (err: any) {
      toast({
        title: "Redemption failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <KeyRound className="h-5 w-5 text-gold" />
            Redeem Coupon
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-xl border border-gold/20 bg-gold/5 p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-gold shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Enter the coupon code your client gives you after a successful
              meet to release your pending coins to your available balance.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="coupon">Coupon Code</Label>
            <Input
              id="coupon"
              value={couponCode}
              onChange={(e) =>
                setCouponCode(e.target.value.toUpperCase())
              }
              placeholder="XXXX-XXXX-XXXX"
              className="bg-secondary border-border focus:border-gold font-mono text-center text-lg tracking-widest uppercase"
              maxLength={14}
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRedeem}
              disabled={couponCode.length < 12 || loading}
              className="flex-1 bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Redeem"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export function ModelOffersClient({ offers }: { offers: Offer[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState("all");
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [actionOffer, setActionOffer] = useState<Offer | null>(null);
  const [actionType, setActionType] = useState<"accept" | "reject" | null>(
    null
  );
  const [actionLoading, setActionLoading] = useState(false);

  const filtered =
    statusFilter === "all"
      ? offers
      : offers.filter((o) => o.status === statusFilter.toUpperCase());

  const pendingCount = offers.filter((o) => o.status === "PENDING").length;

  // ── ACCEPT / REJECT ──────────────────────────
  async function handleAction() {
    if (!actionOffer || !actionType) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/offers/${actionOffer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      toast({
        title:
          actionType === "accept"
            ? "Offer accepted! 🎉"
            : "Offer rejected",
        description:
          actionType === "accept"
            ? `Coins are pending in your wallet. Share the coupon with the client.`
            : "The client has been refunded.",
      });

      setActionOffer(null);
      setActionType(null);
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

  function confirmAction(offer: Offer, type: "accept" | "reject") {
    setActionOffer(offer);
    setActionType(type);
  }

  return (
    <>
      <div className="space-y-6">
        {/* ── HEADER ──────────────────────────── */}
        <PageHeader
          title="Offers"
          description={
            pendingCount > 0
              ? `${pendingCount} pending offer${pendingCount > 1 ? "s" : ""} need your response`
              : "Manage your incoming offers"
          }
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setRedeemOpen(true)}
                className="border-gold/30 text-gold hover:bg-gold/10 gap-2"
              >
                <KeyRound className="h-4 w-4" />
                Redeem Coupon
              </Button>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Offers</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />

        {/* ── OFFERS LIST ─────────────────────── */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="No offers found"
            description={
              statusFilter !== "all"
                ? `No ${statusFilter} offers.`
                : "No offers yet. Complete your profile to start receiving offers."
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((offer) => {
              const config = STATUS_CONFIG[offer.status];
              const StatusIcon = config.icon;
              const fees = calculateConnectionFees(offer.coinsAmount);

              return (
                <div
                  key={offer.id}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  {/* Top accent */}
                  <div
                    className={cn(
                      "h-0.5",
                      offer.status === "ACCEPTED" ||
                        offer.status === "COMPLETED"
                        ? "bg-gold-gradient"
                        : offer.status === "PENDING"
                        ? "bg-amber-500"
                        : offer.status === "REJECTED"
                        ? "bg-destructive"
                        : "bg-border"
                    )}
                  />

                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {/* Client avatar */}
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary border border-border text-base font-bold text-muted-foreground">
                        {offer.client.fullName[0]}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              {offer.client.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {MEET_LABELS[offer.meetType]}
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

                        {/* Coin breakdown */}
                        <div className="rounded-lg bg-secondary px-3 py-2 space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Client offer
                            </span>
                            <span className="text-foreground font-medium">
                              {formatCoins(offer.coinsAmount)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Platform fee (15%)
                            </span>
                            <span className="text-muted-foreground">
                              − {formatCoins(fees.modelFee)}
                            </span>
                          </div>
                          <Separator className="bg-border/50" />
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-foreground">
                              You receive
                            </span>
                            <span className="text-gold flex items-center gap-1">
                              <Coins className="h-3 w-3" />
                              {formatCoins(fees.modelReceives)}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground text-right">
                            ≈ {coinsToNairaFormatted(fees.modelReceives)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Date */}
                    <p className="text-xs text-muted-foreground">
                      Received{" "}
                      {new Date(offer.createdAt).toLocaleDateString(
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

                    {/* Pending actions */}
                    {offer.status === "PENDING" && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmAction(offer, "reject")}
                          className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 h-9"
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => confirmAction(offer, "accept")}
                          className="flex-1 bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 h-9"
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          Accept
                        </Button>
                      </div>
                    )}

                    {/* Accepted — show coupon reminder */}
                    {offer.status === "ACCEPTED" && offer.receipt && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-amber-400">
                            Awaiting client coupon
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Ask your client for the coupon code to release
                            your coins.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRedeemOpen(true)}
                          className="shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-8 text-xs"
                        >
                          <KeyRound className="mr-1 h-3 w-3" />
                          Redeem
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── REDEEM MODAL ──────────────────────── */}
      <RedeemModal
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        onSuccess={(coins) => {
          toast({
            title: "Coins released! 💰",
            description: `${formatCoins(coins)} added to your available balance.`,
          });
          router.refresh();
        }}
      />

      {/* ── CONFIRM ACTION DIALOG ─────────────── */}
      <AlertDialog
        open={!!actionOffer && !!actionType}
        onOpenChange={(open) => {
          if (!open) {
            setActionOffer(null);
            setActionType(null);
          }
        }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "accept" ? "Accept Offer?" : "Reject Offer?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "accept"
                ? `You will receive ${formatCoins(
                    calculateConnectionFees(actionOffer?.coinsAmount ?? 0)
                      .modelReceives
                  )} once the client redeems the coupon. This action cannot be undone.`
                : "The client will be fully refunded. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={actionLoading}
              className={cn(
                "font-semibold",
                actionType === "accept"
                  ? "bg-gold-gradient text-primary-foreground hover:opacity-90"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : actionType === "accept" ? (
                "Yes, Accept"
              ) : (
                "Yes, Reject"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}