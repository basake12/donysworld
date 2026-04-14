import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ModelDetailClient } from "./model-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ModelDetailPage({ params: paramsPromise }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT") redirect("/login");

  const params = await paramsPromise;

  const [model, wallet, clientProfile] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: params.id,
        role: "MODEL",
        modelProfile: { status: "ACTIVE", isAvailable: true },
      },
      include: {
        modelProfile: {
          include: {
            gallery: { orderBy: { order: "asc" } },
            charges: true,
          },
        },
      },
    }),
    prisma.wallet.findUnique({ where: { userId: session.user.id } }),
    prisma.clientProfile.findUnique({ where: { userId: session.user.id } }),
  ]);

  if (!model?.modelProfile) notFound();

  // ── Face reveal status ───────────────────────
  let revealInfo: { revealed: boolean; expiresAt: string | null } = {
    revealed: false, expiresAt: null,
  };
  if (clientProfile) {
    const reveal = await prisma.faceReveal.findFirst({
      where: {
        clientId: clientProfile.id,
        modelProfileId: model.modelProfile.id,
        expiresAt: { gt: new Date() },
      },
    });
    if (reveal) {
      revealInfo = { revealed: true, expiresAt: reveal.expiresAt.toISOString() };
    }
  }

  // ── Other models in same state ───────────────
  const otherModels = await prisma.user.findMany({
    where: {
      role: "MODEL",
      id: { not: model.id },
      modelProfile: {
        status: "ACTIVE",
        state: model.modelProfile.state,
        isAvailable: true,
      },
    },
    take: 6,
    include: {
      modelProfile: {
        select: {
          id: true, age: true, height: true, city: true, state: true,
          bodyType: true, complexion: true, about: true,
          profilePictureUrl: true, allowFaceReveal: true, isFaceBlurred: true, isAvailable: true,
          charges: { select: { meetType: true, minCoins: true, maxCoins: true } },
          gallery: { select: { id: true, imageUrl: true, order: true }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Reveal map for other models
  let otherRevealMap: Record<string, string> = {};
  if (clientProfile && otherModels.length > 0) {
    const otherProfileIds = otherModels
      .map((m) => m.modelProfile?.id)
      .filter(Boolean) as string[];
    const reveals = await prisma.faceReveal.findMany({
      where: {
        clientId: clientProfile.id,
        modelProfileId: { in: otherProfileIds },
        expiresAt: { gt: new Date() },
      },
      select: { modelProfileId: true, expiresAt: true },
    });
    reveals.forEach((r) => {
      otherRevealMap[r.modelProfileId] = r.expiresAt.toISOString();
    });
  }

  return (
    <ModelDetailClient
      model={model as any}
      walletBalance={wallet?.balance ?? 0}
      clientProfileId={clientProfile?.id ?? ""}
      revealInfo={revealInfo}
      otherModels={otherModels as any}
      otherRevealMap={otherRevealMap}
    />
  );
}