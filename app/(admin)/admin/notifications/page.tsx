import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NotificationsClient } from "@/components/shared/notifications-client";

export default async function AdminNotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return <NotificationsClient notifications={notifications as any} />;
}