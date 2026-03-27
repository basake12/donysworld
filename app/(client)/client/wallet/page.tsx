import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClientWalletClient } from "./wallet-client";

export default async function ClientWalletPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [wallet, transactions, fundingRequests, bankAccount] =
    await Promise.all([
      prisma.wallet.findUnique({
        where: { userId: session.user.id },
        select: { id: true, balance: true, pendingCoins: true },
      }),
      prisma.transaction.findMany({
        where: { wallet: { userId: session.user.id } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.fundingRequest.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.bankAccount.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

  return (
    <ClientWalletClient
      wallet={wallet as any}
      transactions={transactions as any}
      fundingRequests={fundingRequests as any}
      bankAccount={bankAccount as any}
    />
  );
}