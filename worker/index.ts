// worker/index.ts
// next-pwa automatically merges this file into the generated service worker.
// Do NOT put caching logic here — next-pwa handles that. This file is only
// for the push notification event handlers.

declare const self: ServiceWorkerGlobalScope;

// ── Receive a push from the server and show a notification ──────────────────
self.addEventListener("push", (event) => {
  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: "Dony's World", body: event.data?.text() ?? "" };
  }

  const title = data.title ?? "Dony's World";
  const options: NotificationOptions = {
    body: data.body ?? "",
    icon: "/icons/brand-logo.png",
    badge: "/icons/brand-logo.png",
    vibrate: [200, 100, 200],
    tag: "donys-world-notification",  // replaces previous notification if present
    renotify: true,
    data: { url: data.url ?? "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Handle notification tap — open the linked page ──────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl: string = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it and navigate
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        // Otherwise open a new tab
        return self.clients.openWindow(targetUrl);
      })
  );
});