import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// VAPID keys must be generated once and stored in .env.
// Run this in your terminal to generate them:
//   npx web-push generate-vapid-keys
// Then add to .env:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
//   VAPID_PRIVATE_KEY=...

webpush.setVapidDetails(
  "mailto:admin@donysworld.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Send a push notification to ALL registered devices for a given user.
 * This is fire-and-forget — errors are logged but never thrown, so a push
 * failure never blocks the main request (e.g. offer creation).
 *
 * Expired/invalid subscriptions (410 Gone) are automatically pruned from DB.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    if (subscriptions.length === 0) return;

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload)
          );
        } catch (err: any) {
          // 410 = subscription expired or user unsubscribed — clean it up
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await prisma.pushSubscription
              .delete({ where: { id: sub.id } })
              .catch(() => {});
          } else {
            console.error(`[PUSH] Failed to send to sub ${sub.id}:`, err?.message);
          }
        }
      })
    );
  } catch (err) {
    console.error("[PUSH] sendPushToUser error:", err);
  }
}