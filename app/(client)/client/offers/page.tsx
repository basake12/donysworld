import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClientOffersClient } from "./offers-client";

export const revalidate = 0;

export default async function ClientOffersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const offers = await prisma.offer.findMany({
    where: { clientId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      model: {
        select: {
          id: true,
          fullName: true,
          nickname: true,
          whatsappNumber: true,
          modelProfile: {
            select: {
              profilePictureUrl: true,
              city: true,
              state: true,
              isFaceBlurred: true,
            },
          },
        },
      },
      receipt: true,
    },
  });

  return <ClientOffersClient offers={offers as any} />;
}