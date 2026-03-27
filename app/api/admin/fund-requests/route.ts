import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionType, TransactionStatus } from "@prisma/client";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// GET — admin fetches all funding requests
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "ADMIN")
      return errorResponse("Admin access required", 403);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const requests = await prisma.fundingRequest.findMany({
      where: status && status !== "all" ? { status: status as any } : {},
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            whatsappNumber: true,
          },
        },
      },
    });

    return NextResponse.json({ requests });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — admin approves or rejects a request
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "ADMIN")
      return errorResponse("Admin access required", 403);

    const { requestId, action, adminNote } = await req.json();

    if (!requestId || !action) {
      return errorResponse("requestId and action are required");
    }

    if (!["approve", "reject"].includes(action)) {
      return errorResponse("Action must be approve or reject");
    }

    const fundingRequest = await prisma.fundingRequest.findUnique({
      where: { id: requestId },
      include: { user: { select: { id: true, fullName: true } } },
    });

    if (!fundingRequest) return errorResponse("Funding request not found", 404);
    if (fundingRequest.status !== "PENDING")
      return errorResponse("This request has already been reviewed");

    const wallet = await prisma.wallet.findUnique({
      where: { userId: fundingRequest.userId },
    });

    if (!wallet) return errorResponse("Client wallet not found");

    await prisma.$transaction(async (tx) => {
      // Update request status
      await tx.fundingRequest.update({
        where: { id: requestId },
        data: {
          status: action === "approve" ? "APPROVED" : "REJECTED",
          adminNote: adminNote ?? null,
          reviewedAt: new Date(),
        },
      });

      if (action === "approve") {
        // Credit client wallet
        await tx.wallet.update({
          where: { userId: fundingRequest.userId },
          data: { balance: { increment: fundingRequest.coinsAmount } },
        });

        // Record transaction
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: TransactionType.FUND_WALLET,
            status: TransactionStatus.COMPLETED,
            amount: fundingRequest.coinsAmount,
            description: `Wallet funded — ₦${fundingRequest.nairaAmount.toLocaleString()} (approved by admin)`,
            reference: requestId,
          },
        });

        // Notify client
        await tx.notification.create({
          data: {
            userId: fundingRequest.userId,
            title: "Wallet Funded! 💰",
            message: `Your payment of ₦${fundingRequest.nairaAmount.toLocaleString()} has been approved. ${fundingRequest.coinsAmount.toLocaleString()} DC has been added to your wallet.`,
            link: "/client/wallet",
          },
        });
      } else {
        // Notify client of rejection
        await tx.notification.create({
          data: {
            userId: fundingRequest.userId,
            title: "Funding Request Rejected",
            message: adminNote
              ? `Your funding request was rejected. Reason: ${adminNote}`
              : "Your funding request was rejected. Please contact support or resubmit with correct proof.",
            link: "/client/wallet",
          },
        });
      }
    });

    return NextResponse.json({
      message: `Funding request ${action}d successfully`,
    });
  } catch (err: any) {
    console.error("[FUND REQUEST REVIEW ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}