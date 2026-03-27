import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminWithdrawalsClient } from "./withdrawals-client";

export default async function AdminWithdrawalsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const requests = await prisma.withdrawalRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, fullName: true, nickname: true, email: true },
      },
      bankAccount: {
        select: {
          id: true, bankName: true, accountNumber: true,
          accountName: true, isPreferred: true,
        },
      },
    },
  });

  // Also fetch all model bank accounts for admin management
  const allModelAccounts = await prisma.modelBankAccount.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, fullName: true, nickname: true, email: true } },
    },
  });

  return (
    <AdminWithdrawalsClient
      requests={requests as any}
      allModelAccounts={allModelAccounts as any}
    />
  );
}