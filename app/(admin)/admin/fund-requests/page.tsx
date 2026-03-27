import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminFundRequestsClient } from "./fund-requests-client";

export default async function AdminFundRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [requests, bankAccount] = await Promise.all([
    prisma.fundingRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            whatsappNumber: true,
          },
        },
      },
    }),
    prisma.bankAccount.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <AdminFundRequestsClient
      requests={requests as any}
      bankAccount={bankAccount as any}
    />
  );
}