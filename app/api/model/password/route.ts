import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return err("Unauthorized", 401);

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword) return err("Current password is required");
    if (!newPassword) return err("New password is required");
    if (newPassword.length < 8) return err("New password must be at least 8 characters");
    if (currentPassword === newPassword) return err("New password must be different from current");

    const user = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { password: true },
    });
    if (!user) return err("User not found", 404);

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return err("Current password is incorrect");

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: session.user.id },
      data:  { password: hashed },
    });

    return NextResponse.json({ message: "Password changed successfully" });
  } catch (e: any) {
    console.error("[PASSWORD PATCH ERROR]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}