import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateConnectionFees,
  generateCouponCode,
  generateRedemptionToken,
  validateOffer,
} from "@/lib/coins";
import { sendPushToUser } from "@/lib/web-push";
import { MeetType, TransactionType, TransactionStatus } from "@prisma/client";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const VALID_STATUSES = new Set(["PENDING", "ACCEPTED", "REJECTED", "COMPLETED", "CANCELLED"]);

const MEET_LABEL: Record<string, string> = {
  SHORT: "Short meet",
  OVERNIGHT: "Overnight",
  WEEKEND: "Weekend",
};

// ─────────────────────────────────────────────
// POST /api/offers — client makes an offer
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "CLIENT")
      return errorResponse("Only clients can make offers", 403);

    const body = await req.json();
    const { modelId, meetType, coinsAmount } = body;

    if (!modelId || !meetType || !coinsAmount) {
      return errorResponse("modelId, meetType and coinsAmount are required");
    }

    if (!["SHORT", "OVERNIGHT", "WEEKEND"].includes(meetType)) {
      return errorResponse("Invalid meet type");
    }

    if (typeof coinsAmount !== "number" || coinsAmount <= 0) {
      return errorResponse("Invalid coin amount");
    }

    // ── Fetch model and their charges ─────────
    const model = await prisma.user.findUnique({
      where: { id: modelId, role: "MODEL" },
      include: {
        modelProfile: {
          include: {
            charges: {
              where: { meetType: meetType as MeetType },
            },
          },
        },
      },
    });

    if (!model || !model.modelProfile) {
      return errorResponse("Model not found");
    }

    if (model.modelProfile.status !== "ACTIVE") {
      return errorResponse("This model is not currently active");
    }

    const charge = model.modelProfile.charges[0];
    if (!charge) {
      return errorResponse(
        "This model has not set charges for this meet type"
      );
    }

    // ── Validate offer amount ──────────────────
    const validation = validateOffer(
      coinsAmount,
      meetType as keyof typeof import("@/lib/coins").MEET_LIMITS,
      charge.minCoins,
      charge.maxCoins
    );

    if (!validation.valid) {
      return errorResponse(validation.reason ?? "Invalid offer amount");
    }

    // ── Fetch client wallet ────────────────────
    const clientWallet = await prisma.wallet.findUnique({
      where: { userId: session.user.id },
    });

    if (!clientWallet) {
      return errorResponse("Client wallet not found");
    }

    const fees = calculateConnectionFees(coinsAmount);

    if (clientWallet.balance < fees.clientTotal) {
      return errorResponse(
        `Insufficient balance. Required: ${fees.clientTotal} DC, Available: ${clientWallet.balance} DC`
      );
    }

    // ── Check for duplicate pending offer ─────
    const existingOffer = await prisma.offer.findFirst({
      where: {
        clientId: session.user.id,
        modelId,
        meetType: meetType as MeetType,
        status: "PENDING",
      },
    });

    if (existingOffer) {
      return errorResponse(
        "You already have a pending offer to this model for this meet type"
      );
    }

    // ── Create offer + debit client ────────────
    await prisma.$transaction(async (tx) => {
      const offer = await tx.offer.create({
        data: {
          clientId: session.user.id,
          modelId,
          meetType: meetType as MeetType,
          coinsAmount,
          status: "PENDING",
        },
      });

      await tx.wallet.update({
        where: { userId: session.user.id },
        data: { balance: { decrement: fees.clientTotal } },
      });

      await tx.transaction.create({
        data: {
          walletId: clientWallet.id,
          type: TransactionType.OFFER_DEBIT,
          status: TransactionStatus.COMPLETED,
          amount: fees.clientTotal,
          description: `Offer to ${model.fullName} — ${meetType} meet`,
          reference: offer.id,
        },
      });

      await tx.notification.create({
        data: {
          userId: modelId,
          title: "New Offer Received",
          message: `You have a new ${meetType.toLowerCase()} meet offer of ${coinsAmount.toLocaleString()} DC. Tap to review.`,
          link: "/model/offers",
        },
      });
    });

    // ── Push notification — fire and forget, never blocks the response ──────
    // We intentionally do NOT await this. If push fails (no subscription,
    // network error, etc.) the offer still succeeds.
    sendPushToUser(modelId, {
      title: "New Offer! 💰",
      body: `${MEET_LABEL[meetType] ?? meetType} offer of ${coinsAmount.toLocaleString()} DC. Tap to review.`,
      url: "/model/offers",
    });

    return NextResponse.json(
      { message: "Offer sent successfully" },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[OFFERS POST ERROR]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// GET /api/offers — fetch offers for logged in user
// ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const role = session.user.role;

    const whereClause: any = {};

    if (role === "CLIENT") {
      whereClause.clientId = session.user.id;
    } else if (role === "MODEL") {
      whereClause.modelId = session.user.id;
    } else {
      return errorResponse("Forbidden", 403);
    }

    // Validate status against known enum values — never pass raw user input to DB
    if (statusParam && statusParam !== "all") {
      const upper = statusParam.toUpperCase();
      if (!VALID_STATUSES.has(upper)) {
        return errorResponse("Invalid status filter");
      }
      whereClause.status = upper;
    }

    const offers = await prisma.offer.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            whatsappNumber: true,
          },
        },
        model: {
          select: {
            id: true,
            fullName: true,
            whatsappNumber: true,
            modelProfile: {
              select: {
                profilePictureUrl: true,
                city: true,
                state: true,
                isFaceBlurred: true,
              },
            },
          },
        },
        receipt: true,
      },
    });

    return NextResponse.json({ offers });
  } catch (err: any) {
    console.error("[OFFERS GET ERROR]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}