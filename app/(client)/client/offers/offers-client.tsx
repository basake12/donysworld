"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HandCoins,
  Clock,
  CheckCircle2,
  XCircle,
  Receipt,
  Copy,
  MapPin,
  Coins,
  MessageCircle,
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

interface Receipt {
  id: string;
  couponCode: string;
  modelWhatsapp: string;
  coinsAmount: number;
  isRedeemed: boolean;
  redeemedAt: string | null;
  createdAt: string;
}

interface Offer {
  id: string;
  meetType: "SHORT" | "OVERNIGHT" | "WEEKEND";
  coinsAmount: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  model: {
    id: string;
    fullName: string;
    whatsappNumber: string;
    modelProfile: {
      profilePictureUrl: string;
      city: string;
      state: string;
      isFaceBlurred: boolean;
    } | null;
  };
  receipt: Receipt | null;
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
// RECEIPT MODAL
// ─────────────────────────────────────────────

function ReceiptModal({
  open,
  onClose,
  offer,
}: {
  open: boolean;
  onClose: () => void;
  offer: Offer | null;
}) {
  const { toast } = useToast();

  // FIX: guard against null offer before using it
  if (!offer?.receipt) return null;

  const fees = calculateConnectionFees(offer.coinsAmount);

  function copyCode() {
    // FIX: added null guard — offer and receipt checked before use
    if (!offer || !offer.receipt) return;
    navigator.clipboard.writeText(offer.receipt.couponCode);
    toast({ title: "Coupon code copied!" });
  }

  function openWhatsApp() {
    // FIX: added null guard — offer and receipt checked before use
    if (!offer || !offer.receipt) return;
    const number = offer.receipt.modelWhatsapp.replace(/\D/g, "");
    window.open(`https://wa.me/${number}`, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Receipt className="h-5 w-5 text-gold" />
            Booking Receipt
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Gold accent */}
          <div className="h-0.5 w-full bg-gold-gradient rounded-full" />

          {/* Model info */}
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 rounded-full overflow-hidden border border-border bg-secondary shrink-0">
              {offer.model.modelProfile?.profilePictureUrl ? (
                <img
                  src={offer.model.modelProfile.profilePictureUrl}
                  alt="Model"
                  className="h-full w-full object-cover face-blurred"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm font-bold">
                  {offer.model.fullName[0]}
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {offer.model.fullName}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {offer.model.modelProfile?.city},{" "}
                {offer.model.modelProfile?.state}
              </p>
            </div>
          </div>

          {/* Booking details */}
          <div className="rounded-xl border border-border bg-secondary p-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Meet type</span>
              <span className="text-foreground font-medium">
                {MEET_LABELS[offer.meetType]}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Offer amount</span>
              <span className="text-foreground font-medium">
                {formatCoins(offer.coinsAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Connection fee</span>
              <span className="text-foreground">
                {formatCoins(fees.clientFee)}
              </span>
            </div>
            <Separator className="bg-border" />
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-foreground">Total paid</span>
              <span className="text-gold">
                {formatCoins(fees.clientTotal)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Naira equivalent</span>
              <span>{coinsToNairaFormatted(fees.clientTotal)}</span>
            </div>
          </div>

          {/* Coupon code */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              Coupon Code — Give this to the model to redeem
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2.5">
                <p className="font-mono text-sm font-bold text-gold tracking-widest">
                  {offer.receipt.couponCode}
                </p>
              </div>
              <Button
                size="icon"
                variant="outline"
                onClick={copyCode}
                className="shrink-0 border-gold/30 text-gold hover:bg-gold/10"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {offer.receipt.isRedeemed && (
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">
                  Redeemed by model
                </span>
              </div>
            )}
          </div>

          {/* WhatsApp */}
          <Button
            onClick={openWhatsApp}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Contact on WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export function ClientOffersClient({ offers }: { offers: Offer[] }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const filtered =
    statusFilter === "all"
      ? offers
      : offers.filter((o) => o.status === statusFilter.toUpperCase());

  function openReceipt(offer: Offer) {
    setSelectedOffer(offer);
    setReceiptOpen(true);
  }

  return (
    <>
      <div className="space-y-6">
        {/* ── HEADER ────────────────────────── */}
        <PageHeader
          title="My Offers"
          description={`${offers.length} total offer${offers.length !== 1 ? "s" : ""}`}
          action={
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
          }
        />

        {/* ── OFFERS LIST ───────────────────── */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="No offers found"
            description={
              statusFilter !== "all"
                ? `No ${statusFilter} offers.`
                : "You haven't made any offers yet."
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
                  {/* Top status bar */}
                  <div
                    className={cn(
                      "h-0.5",
                      offer.status === "ACCEPTED" ||
                        offer.status === "COMPLETED"
                        ? "bg-gold-gradient"
                        : offer.status === "REJECTED"
                        ? "bg-destructive"
                        : offer.status === "PENDING"
                        ? "bg-amber-500"
                        : "bg-border"
                    )}
                  />

                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden border border-border bg-secondary">
                        {offer.model.modelProfile?.profilePictureUrl ? (
                          <img
                            src={offer.model.modelProfile.profilePictureUrl}
                            alt="Model"
                            className="h-full w-full object-cover face-blurred"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground font-bold">
                            {offer.model.fullName[0]}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-foreground truncate">
                            {offer.model.fullName}
                          </p>
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

                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {offer.model.modelProfile?.city},{" "}
                          {offer.model.modelProfile?.state}
                        </p>

                        <div className="flex items-center gap-3 pt-1">
                          <div className="flex items-center gap-1">
                            <Coins className="h-3.5 w-3.5 text-gold" />
                            <span className="text-sm font-semibold text-gold">
                              {formatCoins(fees.clientTotal)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {MEET_LABELS[offer.meetType]}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ·{" "}
                            {new Date(offer.createdAt).toLocaleDateString(
                              "en-NG",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Receipt / Actions */}
                    {offer.receipt && (
                      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="rounded-md border border-gold/20 bg-gold/5 px-2.5 py-1">
                            <p className="font-mono text-xs font-bold text-gold tracking-wider">
                              {offer.receipt.couponCode}
                            </p>
                          </div>
                          {offer.receipt.isRedeemed && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-emerald-500/20 text-emerald-400"
                            >
                              Redeemed
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openReceipt(offer)}
                          className="shrink-0 border-gold/30 text-gold hover:bg-gold/10 gap-1.5 h-8 text-xs"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          View Receipt
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

      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        offer={selectedOffer}
      />
    </>
  );
}