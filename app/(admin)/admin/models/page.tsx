import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminModelsClient } from "./models-client";

export default async function AdminModelsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const models = await prisma.modelProfile.findMany({
    orderBy: { id: "desc" },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          nickname: true,
          email: true,
          whatsappNumber: true,
          gender: true,
          createdAt: true,
        },
      },
      documents: {
        select: {
          id: true,
          documentType: true,
          documentUrl: true,
          uploadedAt: true,
        },
      },
      charges: {
        select: {
          meetType: true,
          minCoins: true,
          maxCoins: true,
        },
      },
      gallery: {
        select: {
          id: true,
          imageUrl: true,
          order: true,
        },
        orderBy: { order: "asc" },
      },
      _count: {
        select: { faceReveals: true },
      },
    },
  });

  return <AdminModelsClient models={models as any} />;
}