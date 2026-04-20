import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BackfillClient } from "./backfill-client";

export const dynamic = "force-dynamic";

export default async function BackfillPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  return <BackfillClient />;
}