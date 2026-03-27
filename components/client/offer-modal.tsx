"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Coins,
  Clock,
  Moon,
  CalendarDays,
  Loader2,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  formatCoins,
  coinsToNairaFormatted,
  calculateConnectionFees,
  MEET_LIMITS,
} from "@/lib/coins";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface ModelCharge {
  meetType: "SHORT" | "OVERNIGHT" | "WEEKEND";
  minCoins: number;
  maxCoins: number;
}

interface OfferModalProps {
  open: boolean;
  onClose: () => void;
  model: {
    id: string;
    fullName: string;
    profileId: string;
    charges: ModelCharge[];
  };
  walletBalance: number;
  onSuccess: () => void;
}

const MEET_TYPE_CONFIG = {
  SHORT: {
    label: "Short Meet",
    duration: "1 Hour",
    icon: Clock,
  },
  OVERNIGHT: {
    label: "Overnight",
    duration: "3 Hours",
    icon: Moon,
  },
  WEEKEND: {
    label: "Weekend",
    duration: "48 Hours",
    icon: CalendarDays,
  },
} as const;

export function OfferModal({
  open,
  onClose,
  model,
  walletBalance,
  onSuccess,
}: OfferModalProps) {
  const { toast } = useToast();
  const [selectedMeetType, setSelectedMeetType] = useState<
    "SHORT" | "OVERNIGHT" | "WEEKEND" | null
  >(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedCharge = model.charges.find(
    (c) => c.meetType === selectedMeetType
  );

  const offerCoins = parseInt(offerAmount.replace(/,/g, ""), 10) || 0;
  const fees = offerCoins > 0 ? calculateConnectionFees(offerCoins) : null;

  const insufficientBalance =
    fees !== null && fees.clientTotal > walletBalance;

  const offerTooLow =
    selectedCharge !== null &&
    selectedCharge !== undefined &&
    offerCoins > 0 &&
    offerCoins < selectedCharge.minCoins;

  const offerTooHigh =
    selectedCharge !== null &&
    selectedCharge !== undefined &&
    offerCoins > 0 &&
    offerCoins > selectedCharge.maxCoins;

  const canSubmit =
    selectedMeetType !== null &&
    selectedCharge !== undefined &&
    offerCoins >= selectedCharge.minCoins &&
    offerCoins <= selectedCharge.maxCoins &&
    !insufficientBalance &&
    !loading;

  function handleClose() {
    setSelectedMeetType(null);
    setOfferAmount("");
    onClose();
  }

  async function handleSubmit() {
    if (!canSubmit || !selectedMeetType) return;
    setLoading(true);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model.id,
          meetType: selectedMeetType,
          coinsAmount: offerCoins,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send offer");
      toast({
        title: "Offer sent!",
        description: `Your offer of ${formatCoins(offerCoins)} has been sent to ${model.fullName}.`,
      });
      handleClose();
      onSuccess();
    } catch (err: any) {
      toast({
        title: "Offer failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Make an Offer to{" "}
            <span className="text-gold">{model.fullName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* ── MEET TYPE SELECTOR ────────────── */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Select Meet Type
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {model.charges.map((charge) => {
                const config = MEET_TYPE_CONFIG[charge.meetType];
                const Icon = config.icon;
                const selected = selectedMeetType === charge.meetType;

                return (
                  <button
                    key={charge.meetType}
                    onClick={() => {
                      setSelectedMeetType(charge.meetType);
                      setOfferAmount(charge.maxCoins.toString());
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all duration-200",
                      selected
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border bg-secondary text-muted-foreground hover:border-gold/40 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-semibold leading-tight">
                      {config.label}
                    </span>
                    <span className="text-[10px] opacity-70">
                      {config.duration}
                    </span>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <Coins className="h-2.5 w-2.5" />
                      <span className="text-[10px] font-bold">
                        {formatCoins(charge.maxCoins)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── OFFER AMOUNT ──────────────────── */}
          {selectedCharge && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="offerAmount">Your Offer (DC)</Label>
                <span className="text-xs text-muted-foreground">
                  Range:{" "}
                  <span className="text-gold">
                    {formatCoins(selectedCharge.minCoins)}
                  </span>{" "}
                  –{" "}
                  <span className="text-gold">
                    {formatCoins(selectedCharge.maxCoins)}
                  </span>
                </span>
              </div>
              <Input
                id="offerAmount"
                type="number"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                min={selectedCharge.minCoins}
                max={selectedCharge.maxCoins}
                placeholder={`Max: ${selectedCharge.maxCoins}`}
                className="bg-secondary border-border focus:border-gold"
              />
              {offerTooLow && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Minimum offer is {formatCoins(selectedCharge.minCoins)}
                </p>
              )}
              {offerTooHigh && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Maximum offer is {formatCoins(selectedCharge.maxCoins)}
                </p>
              )}
            </div>
          )}

          {/* ── FEE BREAKDOWN ─────────────────── */}
          {fees && selectedCharge && !offerTooLow && !offerTooHigh && (
            <div className="rounded-xl border border-border bg-secondary p-4 space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Payment Breakdown
              </p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Offer amount</span>
                  <span className="text-foreground font-medium">
                    {formatCoins(offerCoins)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Platform fee (15%)
                  </span>
                  <span className="text-foreground">
                    {formatCoins(fees.clientFee)}
                  </span>
                </div>
                <Separator className="bg-border" />
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-foreground">Total deducted</span>
                  <span className="text-gold">
                    {formatCoins(fees.clientTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>≈ Naira value</span>
                  <span>{coinsToNairaFormatted(fees.clientTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── BALANCE CHECK ─────────────────── */}
          {insufficientBalance && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">
                Insufficient balance. You need{" "}
                {formatCoins(fees!.clientTotal)} but have{" "}
                {formatCoins(walletBalance)}. Please fund your wallet.
              </p>
            </div>
          )}

          {/* ── WALLET BALANCE ────────────────── */}
          <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
            <span className="text-xs text-muted-foreground">
              Your wallet balance
            </span>
            <span
              className={cn(
                "text-xs font-semibold",
                insufficientBalance ? "text-destructive" : "text-gold"
              )}
            >
              {formatCoins(walletBalance)}
            </span>
          </div>

          {/* ── ACTIONS ───────────────────────── */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Send Offer"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}