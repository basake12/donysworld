import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// GET — fetch model's own bank accounts
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "MODEL") return errorResponse("Models only", 403);

    const accounts = await prisma.modelBankAccount.findMany({
      where: { modelUserId: session.user.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ accounts });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — add a bank account (max 2, name must match fullName)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "MODEL") return errorResponse("Models only", 403);

    const { bankName, accountNumber, accountName } = await req.json();

    if (!bankName || !accountNumber || !accountName) {
      return errorResponse("Bank name, account number and account name are required");
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      return errorResponse("Account number must be exactly 10 digits");
    }

    // Fetch model's full name
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { fullName: true },
    });

    if (!user) return errorResponse("User not found", 404);

    // Strict name match — case insensitive trim
    const normalizedInput = accountName.trim().toLowerCase();
    const normalizedFull = user.fullName.trim().toLowerCase();

    if (normalizedInput !== normalizedFull) {
      return errorResponse(
        `Account name must exactly match your registered full name: "${user.fullName}"`
      );
    }

    // Check max 2 accounts
    const existingCount = await prisma.modelBankAccount.count({
      where: { modelUserId: session.user.id },
    });

    if (existingCount >= 2) {
      return errorResponse("You can only add up to 2 bank accounts");
    }

    // Check duplicate account number
    const duplicate = await prisma.modelBankAccount.findFirst({
      where: { modelUserId: session.user.id, accountNumber },
    });
    if (duplicate) return errorResponse("This account number is already added");

    // If first account, set as preferred automatically
    const isPreferred = existingCount === 0;

    const account = await prisma.modelBankAccount.create({
      data: {
        modelUserId: session.user.id,
        bankName: bankName.trim(),
        accountNumber,
        accountName: user.fullName, // always store canonical full name
        isPreferred,
        isLocked: true,
      },
    });

    return NextResponse.json({ account, message: "Bank account added successfully" }, { status: 201 });
  } catch (err: any) {
    console.error("[BANK ACCOUNT ADD ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — set preferred account
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "MODEL") return errorResponse("Models only", 403);

    const { accountId } = await req.json();
    if (!accountId) return errorResponse("accountId is required");

    const account = await prisma.modelBankAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) return errorResponse("Account not found", 404);
    if (account.modelUserId !== session.user.id)
      return errorResponse("Not your account", 403);

    // Unset all preferred, then set chosen
    await prisma.$transaction([
      prisma.modelBankAccount.updateMany({
        where: { modelUserId: session.user.id },
        data: { isPreferred: false },
      }),
      prisma.modelBankAccount.update({
        where: { id: accountId },
        data: { isPreferred: true },
      }),
    ]);

    return NextResponse.json({ message: "Preferred account updated" });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}