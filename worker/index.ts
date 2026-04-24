/// <reference lib="webworker" />
export {};

// next-pwa automatically merges this file into the generated service worker.
// Do NOT put caching logic here — next-pwa handles that. This file is only
// for the push notification event handlers.

// ── Receive a push from the server and show a notification ──────────────────
self.addEventListener("push", (event) => {
  const pushEvent = event as PushEvent;
  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = pushEvent.data?.json() ?? {};
  } catch {
    data = { title: "Dony's World", body: pushEvent.data?.text() ?? "" };
  }

  const title = data.title ?? "Dony's World";
  const options: NotificationOptions = {
    body: data.body ?? "",
    icon: "/icons/brand-logo.png",
    badge: "/icons/brand-logo.png",
    tag: "donys-world-notification",
    data: { url: data.url ?? "/" },
  };

  pushEvent.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).registration.showNotification(title, options)
  );
});

// ── Handle notification tap — open the linked page ──────────────────────────
self.addEventListener("notificationclick", (event) => {
  const clickEvent = event as NotificationEvent;
  clickEvent.notification.close();
  const targetUrl: string = clickEvent.notification.data?.url ?? "/";

  clickEvent.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            (client as WindowClient).focus();
            (client as WindowClient).navigate(targetUrl);
            return;
          }
        }
        return (self as unknown as ServiceWorkerGlobalScope).clients.openWindow(targetUrl);
      })
  );
});