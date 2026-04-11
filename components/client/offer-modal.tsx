"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Coins, Clock, Moon, CalendarDays,
  Loader2, AlertTriangle, Info, Wallet,
} from "lucide-react";
import {
  formatCoins, coinsToNairaFormatted,
  calculateConnectionFees,
} from "@/lib/coins";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// ─── TYPES ──────────────────────────────────────

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

// ─── CONFIG ─────────────────────────────────────

const MEET_TYPE_CONFIG = {
  SHORT: {
    label: "Short Meet",
    duration: "~1 Hour",
    icon: Clock,
    color: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    activeColor: "border-blue-400/60 bg-blue-400/15 text-blue-400",
  },
  OVERNIGHT: {
    label: "Overnight",
    duration: "~3 Hours",
    icon: Moon,
    color: "text-violet-400 border-violet-400/30 bg-violet-400/10",
    activeColor: "border-violet-400/60 bg-violet-400/15 text-violet-400",
  },
  WEEKEND: {
    label: "Weekend",
    duration: "~48 Hours",
    icon: CalendarDays,
    color: "text-rose-400 border-rose-400/30 bg-rose-400/10",
    activeColor: "border-rose-400/60 bg-rose-400/15 text-rose-400",
  },
} as const;

// ─── COMPONENT ──────────────────────────────────

export function OfferModal({
  open, onClose, model, walletBalance, onSuccess,
}: OfferModalProps) {
  const { toast } = useToast();
  const [selectedMeetType, setSelectedMeetType] = useState<
    "SHORT" | "OVERNIGHT" | "WEEKEND" | null
  >(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [loading, setLoading]         = useState(false);

  const selectedCharge = model.charges.find((c) => c.meetType === selectedMeetType);
  const offerCoins     = parseInt(offerAmount.replace(/,/g, ""), 10) || 0;
  const fees           = offerCoins > 0 ? calculateConnectionFees(offerCoins) : null;

  const insufficientBalance = fees !== null && fees.clientTotal > walletBalance;
  const offerTooLow  = selectedCharge && offerCoins > 0 && offerCoins < selectedCharge.minCoins;
  const offerTooHigh = selectedCharge && offerCoins > 0 && offerCoins > selectedCharge.maxCoins;

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
        title: "Offer sent! 🎉",
        description: `${formatCoins(offerCoins)} DC offer sent to ${model.fullName}.`,
      });
      handleClose();
      onSuccess();
    } catch (err: any) {
      toast({ title: "Offer failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md rounded-2xl p-0 overflow-hidden">
        <div className="h-1 bg-gold-gradient" />

        <div className="p-5">
          <DialogHeader className="mb-5">
            <DialogTitle className="text-foreground font-black font-playfair text-xl">
              Offer to{" "}
              <span className="text-gold">{model.fullName}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">

            {/* ── MEET TYPE SELECTOR ──────────── */}
            <div className="space-y-2">
              <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                Select Meet Type
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {model.charges.map((charge) => {
                  const cfg      = MEET_TYPE_CONFIG[charge.meetType];
                  const Icon     = cfg.icon;
                  const selected = selectedMeetType === charge.meetType;

                  return (
                    <button
                      key={charge.meetType}
                      onClick={() => {
                        setSelectedMeetType(charge.meetType);
                        setOfferAmount(charge.maxCoins.toString());
                      }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all duration-200",
                        selected ? cfg.activeColor : "border-border bg-secondary text-muted-foreground hover:border-gold/30"
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-xl border",
                        selected ? cfg.activeColor : "border-border bg-card"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold leading-tight">{cfg.label}</span>
                      <span className="text-[10px] opacity-60">{cfg.duration}</span>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <Coins className="h-2.5 w-2.5 text-gold" />
                        <span className="text-[10px] font-black text-gold">
                          {charge.maxCoins >= 1000
                            ? `${(charge.maxCoins / 1000).toFixed(charge.maxCoins % 1000 === 0 ? 0 : 1)}k`
                            : charge.maxCoins}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── OFFER AMOUNT ────────────────── */}
            {selectedCharge && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                    Your Offer (DC)
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    <span className="text-gold font-bold">{formatCoins(selectedCharge.minCoins)}</span>
                    {" – "}
                    <span className="text-gold font-bold">{formatCoins(selectedCharge.maxCoins)}</span>
                  </span>
                </div>
                <Input
                  type="number"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  min={selectedCharge.minCoins}
                  max={selectedCharge.maxCoins}
                  placeholder={`Max: ${selectedCharge.maxCoins.toLocaleString()}`}
                  className="h-12 bg-secondary border-border focus:border-gold rounded-xl text-base font-semibold"
                />
                {offerTooLow && (
                  <p className="text-xs text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Minimum offer is {formatCoins(selectedCharge.minCoins)}
                  </p>
                )}
                {offerTooHigh && (
                  <p className="text-xs text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Maximum offer is {formatCoins(selectedCharge.maxCoins)}
                  </p>
                )}
              </div>
            )}

            {/* ── FEE BREAKDOWN ───────────────── */}
            {fees && selectedCharge && !offerTooLow && !offerTooHigh && (
              <div className="rounded-2xl border border-border bg-secondary overflow-hidden">
                <div className="px-4 pt-3 pb-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Info className="h-3 w-3 text-gold" />
                    Payment Breakdown
                  </p>
                </div>
                <div className="px-4 pb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Offer amount</span>
                    <span className="text-foreground font-semibold">{formatCoins(offerCoins)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform fee (15%)</span>
                    <span className="text-foreground">{formatCoins(fees.clientFee)}</span>
                  </div>
                  <Separator className="bg-border my-1" />
                  <div className="flex justify-between text-sm font-black">
                    <span className="text-foreground">Total deducted</span>
                    <span className="text-gold text-base">{formatCoins(fees.clientTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>≈ Naira equivalent</span>
                    <span>{coinsToNairaFormatted(fees.clientTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── INSUFFICIENT BALANCE ────────── */}
            {insufficientBalance && (
              <div className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/8 p-4">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive leading-relaxed">
                  Insufficient balance. You need {formatCoins(fees!.clientTotal)} but only have {formatCoins(walletBalance)}.
                  Please fund your wallet.
                </p>
              </div>
            )}

            {/* ── WALLET BALANCE ──────────────── */}
            <div className="flex items-center justify-between rounded-2xl border border-border bg-secondary px-4 py-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Wallet balance</span>
              </div>
              <span className={cn(
                "text-sm font-black",
                insufficientBalance ? "text-destructive" : "text-gold"
              )}>
                {formatCoins(walletBalance)}
              </span>
            </div>

            {/* ── ACTIONS ─────────────────────── */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 border-border rounded-xl h-12 font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 h-12 bg-gold-gradient text-black font-black hover:opacity-90 rounded-xl disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    Send Offer
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}