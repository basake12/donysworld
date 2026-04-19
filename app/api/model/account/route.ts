import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);
    if (session.user.role !== "MODEL") return err("Models only", 403);

    const { fullName, nickname, whatsappNumber } = await req.json();

    if (!fullName?.trim()) return err("Full name is required");
    if (fullName.trim().length < 3) return err("Full name must be at least 3 characters");
    if (!whatsappNumber?.trim()) return err("WhatsApp number is required");
    if (!/^\+?[0-9\s\-()+]{10,}$/.test(whatsappNumber.trim()))
      return err("Invalid WhatsApp number");

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        fullName:       fullName.trim(),
        nickname:       nickname?.trim() || null,
        whatsappNumber: whatsappNumber.trim(),
      },
    });

    return NextResponse.json({ message: "Account updated successfully" });
  } catch (e: any) {
    console.error("[ACCOUNT PATCH ERROR]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}