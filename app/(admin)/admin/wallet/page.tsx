import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminWalletClient } from "./wallet-client";

export default async function AdminWalletPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [wallet, transactions] = await Promise.all([
    prisma.wallet.findUnique({
      where: { userId: session.user.id },
      select: { id: true, balance: true, pendingCoins: true },
    }),
    prisma.transaction.findMany({
      where: { wallet: { userId: session.user.id } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <AdminWalletClient
      wallet={wallet as any}
      transactions={transactions as any}
    />
  );
}