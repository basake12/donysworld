import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionType, TransactionStatus } from "@prisma/client";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ─────────────────────────────────────────────
// POST /api/offers/redeem — model redeems coupon
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "MODEL")
      return errorResponse("Only models can redeem coupons", 403);

    const { couponCode } = await req.json();

    if (!couponCode || typeof couponCode !== "string") {
      return errorResponse("Coupon code is required");
    }

    // ── Find receipt ───────────────────────────
    const receipt = await prisma.receipt.findUnique({
      where: { couponCode: couponCode.trim().toUpperCase() },
      include: {
        offer: {
          include: {
            model: { select: { id: true, fullName: true } },
            client: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!receipt) {
      return errorResponse("Invalid coupon code");
    }

    if (receipt.isRedeemed) {
      return errorResponse("This coupon has already been redeemed");
    }

    // ── Verify model owns this offer ───────────
    if (receipt.offer.modelId !== session.user.id) {
      return errorResponse("This coupon does not belong to your offer");
    }

    if (receipt.offer.status !== "ACCEPTED") {
      return errorResponse("This offer is not in an accepted state");
    }

    // ── Fetch model wallet ─────────────────────
    const modelWallet = await prisma.wallet.findUnique({
      where: { userId: session.user.id },
    });

    if (!modelWallet) return errorResponse("Wallet not found");

    const coinsToRedeem = receipt.coinsAmount;
    const modelFee = Math.floor(coinsToRedeem * 0.1);
    const modelReceives = coinsToRedeem - modelFee;

    // ── Redeem: move pending → available ───────
    await prisma.$transaction(async (tx) => {
      // Mark receipt as redeemed
      await tx.receipt.update({
        where: { id: receipt.id },
        data: {
          isRedeemed: true,
          redeemedAt: new Date(),
        },
      });

      // Update offer to completed
      await tx.offer.update({
        where: { id: receipt.offerId },
        data: { status: "COMPLETED" },
      });

      // Move coins from pending to available balance
      await tx.wallet.update({
        where: { userId: session.user.id },
        data: {
          pendingCoins: { decrement: modelReceives },
          balance: { increment: modelReceives },
        },
      });

      // Update transaction to completed
      await tx.transaction.updateMany({
        where: {
          walletId: modelWallet.id,
          reference: receipt.offerId,
          status: TransactionStatus.PENDING,
        },
        data: { status: TransactionStatus.COMPLETED },
      });

      // Notify model
      await tx.notification.create({
        data: {
          userId: session.user.id,
          title: "Coins Redeemed! 💰",
          message: `${modelReceives.toLocaleString()} DC has been added to your wallet balance.`,
          link: "/model/wallet",
        },
      });

      // Notify client that meet is completed
      await tx.notification.create({
        data: {
          userId: receipt.offer.clientId,
          title: "Meet Completed",
          message: `Your ${receipt.offer.meetType.toLowerCase()} meet with ${receipt.offer.model.fullName} has been marked as completed.`,
          link: "/client/offers",
        },
      });
    });

    return NextResponse.json({
      message: "Coupon redeemed successfully",
      coinsAdded: modelReceives,
    });
  } catch (err: any) {
    console.error("[REDEEM ERROR]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}