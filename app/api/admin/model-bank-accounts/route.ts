import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// DELETE — admin removes a model bank account (unlocks so model can re-add)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "ADMIN") return errorResponse("Admin only", 403);

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) return errorResponse("accountId is required");

    const account = await prisma.modelBankAccount.findUnique({
      where: { id: accountId },
      include: { user: { select: { id: true, fullName: true } } },
    });

    if (!account) return errorResponse("Account not found", 404);

    await prisma.modelBankAccount.delete({ where: { id: accountId } });

    // Notify model
    await prisma.notification.create({
      data: {
        userId: account.modelUserId,
        title: "Bank Account Removed",
        message: `Your bank account ending in ${account.accountNumber.slice(-4)} has been removed by admin. You can now add a new account.`,
        link: "/model/wallet",
      },
    });

    return NextResponse.json({ message: "Bank account removed" });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}