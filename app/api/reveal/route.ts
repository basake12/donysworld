import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  FACE_REVEAL_COST,
  FACE_REVEAL_MODEL_SHARE,
  FACE_REVEAL_ADMIN_SHARE,
  faceRevealExpiresAt,
} from "@/lib/coins";
import { TransactionType, TransactionStatus } from "@prisma/client";

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);
    if (session.user.role !== "CLIENT") return err("Clients only", 403);

    const { modelProfileId } = await req.json();
    if (!modelProfileId) return err("modelProfileId required");

    const modelProfile = await prisma.modelProfile.findUnique({
      where: { id: modelProfileId },
      include: { user: { select: { id: true, fullName: true } } },
    });

    if (!modelProfile) return err("Model not found", 404);
    if (!modelProfile.allowFaceReveal) return err("This model does not allow face reveals");

    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!clientProfile) return err("Client profile not found");

    // Check for existing NON-EXPIRED reveal
    const existingReveal = await prisma.faceReveal.findFirst({
      where: {
        clientId: clientProfile.id,
        modelProfileId,
        expiresAt: { gt: new Date() }, // still active
      },
    });

    if (existingReveal) {
      return err(
        `Face already revealed. Expires ${existingReveal.expiresAt.toLocaleTimeString("en-NG")}`
      );
    }

    // Delete any expired reveal for this pair so we can create new one
    await prisma.faceReveal.deleteMany({
      where: {
        clientId: clientProfile.id,
        modelProfileId,
        expiresAt: { lte: new Date() },
      },
    });

    const [clientWallet, modelWallet, adminUser] = await Promise.all([
      prisma.wallet.findUnique({ where: { userId: session.user.id } }),
      prisma.wallet.findUnique({ where: { userId: modelProfile.user.id } }),
      prisma.user.findFirst({ where: { role: "ADMIN" }, include: { wallet: true } }),
    ]);

    if (!clientWallet) return err("Client wallet not found");
    if (!modelWallet) return err("Model wallet not found");
    if (!adminUser?.wallet) return err("Admin wallet not found");

    if (clientWallet.balance < FACE_REVEAL_COST) {
      return err(
        `Insufficient balance. Face reveal costs ${FACE_REVEAL_COST.toLocaleString()} DC. You have ${clientWallet.balance.toLocaleString()} DC.`
      );
    }

    const expiresAt = faceRevealExpiresAt();

    await prisma.$transaction([
      prisma.faceReveal.create({
        data: {
          clientId: clientProfile.id,
          modelProfileId,
          coinsCharged: FACE_REVEAL_COST,
          modelEarning: FACE_REVEAL_MODEL_SHARE,
          adminEarning: FACE_REVEAL_ADMIN_SHARE,
          expiresAt,
        },
      }),
      prisma.wallet.update({
        where: { userId: session.user.id },
        data: { balance: { decrement: FACE_REVEAL_COST } },
      }),
      prisma.transaction.create({
        data: {
          walletId: clientWallet.id,
          type: TransactionType.FACE_REVEAL_DEBIT,
          status: TransactionStatus.COMPLETED,
          amount: FACE_REVEAL_COST,
          description: `Face reveal — ${modelProfile.user.fullName} (24hr access)`,
        },
      }),
      prisma.wallet.update({
        where: { userId: modelProfile.user.id },
        data: { balance: { increment: FACE_REVEAL_MODEL_SHARE } },
      }),
      prisma.transaction.create({
        data: {
          walletId: modelWallet.id,
          type: TransactionType.FACE_REVEAL_CREDIT,
          status: TransactionStatus.COMPLETED,
          amount: FACE_REVEAL_MODEL_SHARE,
          description: "Face reveal earning (24hr access sold)",
        },
      }),
      prisma.wallet.update({
        where: { id: adminUser.wallet!.id },
        data: { balance: { increment: FACE_REVEAL_ADMIN_SHARE } },
      }),
      prisma.transaction.create({
        data: {
          walletId: adminUser.wallet!.id,
          type: TransactionType.FACE_REVEAL_CREDIT,
          status: TransactionStatus.COMPLETED,
          amount: FACE_REVEAL_ADMIN_SHARE,
          description: `Face reveal cut — ${modelProfile.user.fullName}`,
        },
      }),
      prisma.notification.create({
        data: {
          userId: modelProfile.user.id,
          title: "Face Revealed 👁️",
          message: `Someone revealed your face for 24 hours. You earned ${FACE_REVEAL_MODEL_SHARE.toLocaleString()} DC.`,
          link: "/model/wallet",
        },
      }),
    ]);

    return NextResponse.json({
      message: "Face revealed — access valid for 24 hours",
      expiresAt: expiresAt.toISOString(),
      coinsCharged: FACE_REVEAL_COST,
    });
  } catch (e: any) {
    console.error("[REVEAL ERROR]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}