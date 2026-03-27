import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateConnectionFees,
  generateCouponCode,
  generateRedemptionToken,
} from "@/lib/coins";
import { TransactionType, TransactionStatus } from "@prisma/client";

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);
    if (session.user.role !== "MODEL")
      return err("Only models can respond to offers", 403);

    const { id: offerId } = await context.params;
    const body = await req.json();
    const { action } = body;

    if (!["accept", "reject"].includes(action)) {
      return err("Action must be accept or reject");
    }

    // Fetch offer with all needed relations in one query
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        client: { select: { id: true, fullName: true, whatsappNumber: true } },
        model: { select: { id: true, fullName: true, whatsappNumber: true } },
      },
    });

    if (!offer) return err("Offer not found", 404);
    if (offer.modelId !== session.user.id)
      return err("This is not your offer", 403);
    if (offer.status !== "PENDING")
      return err("This offer is no longer pending");

    const fees = calculateConnectionFees(offer.coinsAmount);

    // Fetch all wallets in parallel
    const [clientWallet, modelWallet, adminUser] = await Promise.all([
      prisma.wallet.findUnique({ where: { userId: offer.clientId } }),
      prisma.wallet.findUnique({ where: { userId: session.user.id } }),
      prisma.user.findFirst({
        where: { role: "ADMIN" },
        include: { wallet: true },
      }),
    ]);

    if (!clientWallet) return err("Client wallet not found");
    if (!modelWallet) return err("Model wallet not found");
    if (!adminUser?.wallet) return err("Admin wallet not found");

    // ── REJECT ────────────────────────────────
    if (action === "reject") {
      await prisma.offer.update({
        where: { id: offerId },
        data: { status: "REJECTED" },
      });

      await prisma.wallet.update({
        where: { userId: offer.clientId },
        data: { balance: { increment: fees.clientTotal } },
      });

      await prisma.transaction.create({
        data: {
          walletId: clientWallet.id,
          type: TransactionType.OFFER_CREDIT,
          status: TransactionStatus.COMPLETED,
          amount: fees.clientTotal,
          description: `Refund — offer rejected by ${offer.model.fullName}`,
          reference: `refund_${offerId}_${Date.now()}`,
        },
      });

      await prisma.notification.create({
        data: {
          userId: offer.clientId,
          title: "Offer Rejected",
          message: `Your ${offer.meetType.toLowerCase()} meet offer was rejected. Your ${fees.clientTotal.toLocaleString()} DC has been fully refunded.`,
          link: "/client/offers",
        },
      });

      return NextResponse.json({ message: "Offer rejected, client refunded" });
    }

    // ── ACCEPT ────────────────────────────────
    const couponCode = generateCouponCode();
    const token = generateRedemptionToken();

    await prisma.offer.update({
      where: { id: offerId },
      data: { status: "ACCEPTED", token },
    });

    await prisma.receipt.create({
      data: {
        offerId,
        couponCode,
        modelWhatsapp: offer.model.whatsappNumber,
        coinsAmount: offer.coinsAmount,
        isRedeemed: false,
      },
    });

    await prisma.wallet.update({
      where: { userId: session.user.id },
      data: { pendingCoins: { increment: fees.modelReceives } },
    });

    await prisma.transaction.create({
      data: {
        walletId: modelWallet.id,
        type: TransactionType.OFFER_CREDIT,
        status: TransactionStatus.PENDING,
        amount: fees.modelReceives,
        description: `Offer accepted — ${offer.meetType.toLowerCase()} meet (pending coupon)`,
        reference: `pending_${offerId}`,
      },
    });

    await prisma.wallet.update({
      where: { id: adminUser.wallet!.id },
      data: { balance: { increment: fees.adminTotal } },
    });

    await prisma.transaction.create({
      data: {
        walletId: adminUser.wallet!.id,
        type: TransactionType.CONNECTION_FEE,
        status: TransactionStatus.COMPLETED,
        amount: fees.adminTotal,
        description: `Connection fee — ${offer.client.fullName} → ${offer.model.fullName}`,
        reference: `fee_${offerId}`,
      },
    });

    await prisma.notification.create({
      data: {
        userId: offer.clientId,
        title: "Offer Accepted! 🎉",
        message: `${offer.model.fullName} accepted your offer! Check your receipt for the coupon code and WhatsApp number.`,
        link: "/client/offers",
      },
    });

    return NextResponse.json({ message: "Offer accepted", couponCode });
  } catch (e: any) {
    console.error("[OFFER PATCH ERROR]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}