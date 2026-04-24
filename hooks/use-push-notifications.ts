"use client";

import { useEffect, useRef, useState } from "react";

type PushStatus = "unsupported" | "denied" | "prompt" | "granted" | "loading";

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setStatus("unsupported");
      return;
    }

    const p = Notification.permission;
    if (p === "denied") {
      setStatus("denied");
    } else if (p === "granted") {
      setStatus("granted");
    } else {
      setStatus("prompt");
    }
  }, []);

  async function subscribe() {
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    try {
      setStatus("loading");

      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "prompt");
        subscribedRef.current = false;
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
        subscribedRef.current = false;
        return;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(vapidKey),
      });

      const json = subscription.toJSON();

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });

      if (!res.ok) {
        console.error("[Push] Failed to save subscription", await res.text());
        subscribedRef.current = false;
        return;
      }

      setStatus("granted");
    } catch (err) {
      console.error("[Push] subscribe error", err);
      subscribedRef.current = false;
      setStatus("prompt");
    }
  }

  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }

      subscribedRef.current = false;
      setStatus("prompt");
    } catch (err) {
      console.error("[Push] unsubscribe error", err);
    }
  }

  return { status, subscribe, unsubscribe };
}

// Convert VAPID public key from base64url string to ArrayBuffer.
// Returning ArrayBuffer (not Uint8Array) satisfies the stricter TS types
// on PushSubscriptionOptionsInit.applicationServerKey in TS 5.x.
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    buffer[i] = raw.charCodeAt(i);
  }
  return buffer.buffer as ArrayBuffer;
}