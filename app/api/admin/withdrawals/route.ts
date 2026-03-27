import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionStatus } from "@prisma/client";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// GET — all withdrawal requests
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "ADMIN") return errorResponse("Admin only", 403);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const requests = await prisma.withdrawalRequest.findMany({
      where: status && status !== "all" ? { status: status as any } : {},
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, fullName: true, nickname: true, email: true } },
        bankAccount: {
          select: {
            bankName: true, accountNumber: true, accountName: true, isPreferred: true,
          },
        },
      },
    });

    return NextResponse.json({ requests });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — approve or reject
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "ADMIN") return errorResponse("Admin only", 403);

    const { requestId, action, adminNote } = await req.json();

    if (!requestId || !action) return errorResponse("requestId and action required");
    if (!["approve", "reject"].includes(action)) return errorResponse("Invalid action");

    const request = await prisma.withdrawalRequest.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { id: true, fullName: true } },
        bankAccount: { select: { bankName: true, accountNumber: true } },
      },
    });

    if (!request) return errorResponse("Request not found", 404);
    if (request.status !== "PENDING") return errorResponse("Already reviewed");

    const wallet = await prisma.wallet.findUnique({
      where: { userId: request.modelUserId },
    });
    if (!wallet) return errorResponse("Model wallet not found");

    await prisma.$transaction(async (tx) => {
      await tx.withdrawalRequest.update({
        where: { id: requestId },
        data: {
          status: action === "approve" ? "APPROVED" : "REJECTED",
          adminNote: adminNote ?? null,
          reviewedAt: new Date(),
        },
      });

      if (action === "reject") {
        // Refund coins back to model
        await tx.wallet.update({
          where: { userId: request.modelUserId },
          data: { balance: { increment: request.coinsAmount } },
        });

        // Update transaction to failed
        await tx.transaction.updateMany({
          where: { reference: requestId, status: TransactionStatus.PENDING },
          data: { status: TransactionStatus.FAILED },
        });

        await tx.notification.create({
          data: {
            userId: request.modelUserId,
            title: "Withdrawal Rejected",
            message: adminNote
              ? `Your withdrawal of ₦${request.nairaAmount.toLocaleString()} was rejected. Reason: ${adminNote}. Coins have been refunded.`
              : `Your withdrawal of ₦${request.nairaAmount.toLocaleString()} was rejected. Coins have been refunded.`,
            link: "/model/wallet",
          },
        });
      } else {
        // Mark transaction completed
        await tx.transaction.updateMany({
          where: { reference: requestId, status: TransactionStatus.PENDING },
          data: { status: TransactionStatus.COMPLETED },
        });

        await tx.notification.create({
          data: {
            userId: request.modelUserId,
            title: "Withdrawal Approved! 💸",
            message: `Your withdrawal of ₦${request.nairaAmount.toLocaleString()} to ${request.bankAccount.bankName} (${request.bankAccount.accountNumber}) has been approved and is being processed.`,
            link: "/model/wallet",
          },
        });
      }
    });

    return NextResponse.json({
      message: `Withdrawal ${action}d successfully`,
    });
  } catch (err: any) {
    console.error("[WITHDRAWAL REVIEW ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}