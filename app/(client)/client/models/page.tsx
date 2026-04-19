import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ModelsClient } from "./models-client";
import { NIGERIA_STATES } from "@/lib/nigeria-states";

export const revalidate = 30;

export default async function ModelsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const clientUser = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { email: true, whatsappNumber: true, fullName: true },
  });

  // Find models that have blocked this client
  const blockedProfiles = clientUser
    ? await prisma.modelBlocklist.findMany({
        where: {
          OR: [
            { identifierType: "EMAIL", identifier: clientUser.email.toLowerCase() },
            { identifierType: "PHONE", identifier: clientUser.whatsappNumber.trim().toLowerCase() },
            { identifierType: "NAME",  identifier: { contains: clientUser.fullName.trim(), mode: "insensitive" } },
          ],
        },
        select: { modelProfileId: true },
      })
    : [];

  const blockedProfileIds = blockedProfiles.map((b) => b.modelProfileId);

  const [models, wallet, clientProfile, activeReveals] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: "MODEL",
        modelProfile: {
          status:      "ACTIVE",
          isAvailable: true,
          ...(blockedProfileIds.length > 0 && {
            NOT: { id: { in: blockedProfileIds } },
          }),
        },
      },
      select: {
        id: true,
        fullName: true,
        nickname: true,
        modelProfile: {
          select: {
            id: true, age: true, height: true, city: true, state: true,
            bodyType: true, complexion: true, about: true,
            profilePictureUrl: true,
            originalPictureUrl: true,  // fetched here, stripped below unless revealed
            allowFaceReveal: true, isFaceBlurred: true, isAvailable: true,
            charges: { select: { meetType: true, minCoins: true, maxCoins: true } },
            gallery: {
              select: { id: true, imageUrl: true, originalImageUrl: true, order: true },
              orderBy: { order: "asc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.wallet.findUnique({
      where:  { userId: session.user.id },
      select: { balance: true },
    }),
    prisma.clientProfile.findUnique({
      where:  { userId: session.user.id },
      select: { id: true },
    }),
    prisma.faceReveal.findMany({
      where: {
        client:    { userId: session.user.id },
        expiresAt: { gt: new Date() },
      },
      select: { modelProfileId: true, expiresAt: true },
    }),
  ]);

  const revealMap: Record<string, string> = {};
  for (const r of activeReveals) {
    revealMap[r.modelProfileId] = r.expiresAt.toISOString();
  }

  // Strip originalPictureUrl / originalImageUrl unless this client has an active reveal.
  // This ensures original URLs are never sent to non-paying clients.
  const sanitizedModels = models.map((m) => {
    const hasReveal = !!(m.modelProfile && revealMap[m.modelProfile.id]);
    return {
      ...m,
      modelProfile: m.modelProfile
        ? {
            ...m.modelProfile,
            originalPictureUrl: hasReveal ? m.modelProfile.originalPictureUrl : null,
            gallery: m.modelProfile.gallery.map((g) => ({
              ...g,
              originalImageUrl: hasReveal ? g.originalImageUrl : null,
            })),
          }
        : m.modelProfile,
    };
  });

  const states = NIGERIA_STATES.map((s) => s.state);

  return (
    <ModelsClient
      models={sanitizedModels as any}
      walletBalance={wallet?.balance ?? 0}
      clientProfileId={clientProfile?.id ?? ""}
      revealMap={revealMap}
      states={states}
    />
  );
}