import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ModelOffersClient } from "./offers-client";

export default async function ModelOffersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const offers = await prisma.offer.findMany({
    where: { modelId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      client: {
        select: {
          id: true,
          fullName: true,
          whatsappNumber: true,
        },
      },
      receipt: true,
    },
  });

  return <ModelOffersClient offers={offers as any} />;
}