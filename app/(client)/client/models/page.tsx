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

  const [rawModels, wallet, clientProfile, activeReveals] = await Promise.all([
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
            // Originals are NEVER selected — reveal-url endpoint is the
            // single gate that reads them. This select only returns data
            // safe to ship to any authenticated client.
            id: true, age: true, height: true, city: true, state: true,
            bodyType: true, complexion: true, about: true,
            profilePictureUrl: true,
            allowFaceReveal: true, isFaceBlurred: true, isAvailable: true,
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

  // The `where` clause above guarantees modelProfile is present, but Prisma
  // types it as nullable. Narrow to non-null at the page boundary so the
  // client component receives a clean shape.
  const models = rawModels
    .filter((m): m is typeof m & { modelProfile: NonNullable<typeof m.modelProfile> } => !!m.modelProfile)
    .map((m) => ({
      id: m.id,
      fullName: m.fullName,
      nickname: m.nickname,
      modelProfile: m.modelProfile,
    }));

  const revealMap: Record<string, string> = {};
  for (const r of activeReveals) {
    revealMap[r.modelProfileId] = r.expiresAt.toISOString();
  }

  const states = NIGERIA_STATES.map((s) => s.state);

  return (
    <ModelsClient
      models={models}
      walletBalance={wallet?.balance ?? 0}
      clientProfileId={clientProfile?.id ?? ""}
      revealMap={revealMap}
      states={states}
    />
  );
}