import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ModelsClient } from "./models-client";
import { NIGERIA_STATES } from "@/lib/nigeria-states";

export const revalidate = 30; // ISR — refresh every 30s

export default async function ModelsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [models, wallet, clientProfile, activeReveals] = await Promise.all([
    prisma.user.findMany({
      where: { role: "MODEL", modelProfile: { status: "ACTIVE" } },
      select: {
        id: true,
        fullName: true,
        nickname: true,
        modelProfile: {
          select: {
            id: true, age: true, height: true, city: true, state: true,
            bodyType: true, complexion: true, about: true,
            profilePictureUrl: true, allowFaceReveal: true, isFaceBlurred: true,
            charges: { select: { meetType: true, minCoins: true, maxCoins: true } },
            gallery: {
              select: { id: true, imageUrl: true, order: true },
              orderBy: { order: "asc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.wallet.findUnique({
      where: { userId: session.user.id },
      select: { balance: true },
    }),
    prisma.clientProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    }),
    // Only fetch NON-EXPIRED reveals
    prisma.faceReveal.findMany({
      where: {
        client: { userId: session.user.id },
        expiresAt: { gt: new Date() },
      },
      select: { modelProfileId: true, expiresAt: true },
    }),
  ]);

  const states = NIGERIA_STATES.map((s) => s.state);

  // Build reveal map: profileId -> expiresAt
  const revealMap: Record<string, string> = {};
  for (const r of activeReveals) {
    revealMap[r.modelProfileId] = r.expiresAt.toISOString();
  }

  return (
    <ModelsClient
      models={models as any}
      walletBalance={wallet?.balance ?? 0}
      clientProfileId={clientProfile?.id ?? ""}
      revealMap={revealMap}
      states={states}
    />
  );
}