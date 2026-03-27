import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// GET — fetch current bank account
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);

    const account = await prisma.bankAccount.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ account });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — admin creates or updates bank account
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "ADMIN")
      return errorResponse("Admin access required", 403);

    const { bankName, accountNumber, accountName } = await req.json();

    if (!bankName || !accountNumber || !accountName) {
      return errorResponse("Bank name, account number and account name are required");
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      return errorResponse("Account number must be exactly 10 digits");
    }

    // Deactivate all existing accounts
    await prisma.bankAccount.updateMany({
      data: { isActive: false },
    });

    // Create new active account
    const account = await prisma.bankAccount.create({
      data: {
        bankName,
        accountNumber,
        accountName,
        isActive: true,
      },
    });

    return NextResponse.json({ account, message: "Bank account saved" });
  } catch (err: any) {
    console.error("[BANK ACCOUNT ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}