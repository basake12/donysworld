import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ModelWalletClient } from "./wallet-client";

export default async function ModelWalletPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [wallet, transactions, bankAccounts, withdrawalRequests, user] = await Promise.all([
    prisma.wallet.findUnique({
      where: { userId: session.user.id },
      select: { id: true, balance: true, pendingCoins: true },
    }),
    prisma.transaction.findMany({
      where: { wallet: { userId: session.user.id } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.modelBankAccount.findMany({
      where: { modelUserId: session.user.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.withdrawalRequest.findMany({
      where: { modelUserId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        bankAccount: {
          select: { bankName: true, accountNumber: true, accountName: true },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { fullName: true },
    }),
  ]);

  return (
    <ModelWalletClient
      wallet={wallet as any}
      transactions={transactions as any}
      bankAccounts={bankAccounts as any}
      withdrawalRequests={withdrawalRequests as any}
      fullName={user?.fullName ?? ""}
    />
  );
}