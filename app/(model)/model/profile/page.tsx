import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ModelProfileClient } from "./profile-client";

export default async function ModelProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [modelProfile, user] = await Promise.all([
    prisma.modelProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        charges: true,
        gallery: { orderBy: { order: "asc" } },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { fullName: true, email: true, whatsappNumber: true },
    }),
  ]);

  if (!modelProfile) redirect("/login");

  return (
    <ModelProfileClient
      profile={modelProfile as any}
      user={user as any}
    />
  );
}