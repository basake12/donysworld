import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/shared/navbar";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { prisma } from "@/lib/prisma";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT") redirect("/login");

  const notificationCount = await prisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar session={session} notificationCount={notificationCount} />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        {children}
      </main>
      <InstallPrompt />
    </div>
  );
}