import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { coinsToNaira } from "@/lib/coins";
import { TransactionType, TransactionStatus } from "@prisma/client";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const MIN_WITHDRAWAL_COINS = 1000; // 1,000 DC = ₦10,000

// POST — model requests a withdrawal
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "MODEL") return errorResponse("Models only", 403);

    const { coinsAmount, bankAccountId } = await req.json();

    if (!coinsAmount || !bankAccountId) {
      return errorResponse("coinsAmount and bankAccountId are required");
    }

    if (typeof coinsAmount !== "number" || coinsAmount < MIN_WITHDRAWAL_COINS) {
      return errorResponse(`Minimum withdrawal is ${MIN_WITHDRAWAL_COINS.toLocaleString()} DC`);
    }

    // Verify bank account belongs to model
    const bankAccount = await prisma.modelBankAccount.findUnique({
      where: { id: bankAccountId },
    });

    if (!bankAccount) return errorResponse("Bank account not found", 404);
    if (bankAccount.modelUserId !== session.user.id)
      return errorResponse("Not your bank account", 403);

    // Check wallet balance
    const wallet = await prisma.wallet.findUnique({
      where: { userId: session.user.id },
    });

    if (!wallet) return errorResponse("Wallet not found");

    if (wallet.balance < coinsAmount) {
      return errorResponse(
        `Insufficient balance. Available: ${wallet.balance.toLocaleString()} DC`
      );
    }

    // Check for existing pending withdrawal
    const pendingExists = await prisma.withdrawalRequest.findFirst({
      where: { modelUserId: session.user.id, status: "PENDING" },
    });

    if (pendingExists) {
      return errorResponse(
        "You already have a pending withdrawal request. Wait for admin to process it."
      );
    }

    const nairaAmount = coinsToNaira(coinsAmount);

    await prisma.$transaction(async (tx) => {
      // Create withdrawal request
      const withdrawalRequest = await tx.withdrawalRequest.create({
        data: {
          modelUserId: session.user.id,
          bankAccountId,
          coinsAmount,
          nairaAmount,
          status: "PENDING",
        },
      });

      // Deduct coins immediately (hold during review)
      await tx.wallet.update({
        where: { userId: session.user.id },
        data: { balance: { decrement: coinsAmount } },
      });

      // Record pending transaction
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING,
          amount: coinsAmount,
          description: `Withdrawal request — ₦${nairaAmount.toLocaleString()} to ${bankAccount.bankName}`,
          reference: withdrawalRequest.id,
        },
      });

      // Notify admin
      const admin = await tx.user.findFirst({ where: { role: "ADMIN" } });
      if (admin) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            title: "Withdrawal Request 💸",
            message: `A model has requested a withdrawal of ₦${nairaAmount.toLocaleString()} to ${bankAccount.bankName} — ${bankAccount.accountNumber}.`,
            link: "/admin/withdrawals",
          },
        });
      }
    });

    return NextResponse.json(
      { message: "Withdrawal request submitted. Admin will process shortly." },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[WITHDRAWAL REQUEST ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET — model's own withdrawal history
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "MODEL") return errorResponse("Models only", 403);

    const requests = await prisma.withdrawalRequest.findMany({
      where: { modelUserId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        bankAccount: {
          select: { bankName: true, accountNumber: true, accountName: true },
        },
      },
    });

    return NextResponse.json({ requests });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}