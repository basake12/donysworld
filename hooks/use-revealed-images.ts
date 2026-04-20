"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useRevealedImages
 *
 * Owns the fetch-and-refresh lifecycle for a single model's original images.
 * One hook instance fetches ALL originals (profile + every gallery item) in
 * a single request to `/api/model/{modelProfileId}/reveal-url`, then
 * auto-refreshes them just before the signed URLs die (~50s).
 *
 * Consumers:
 *   • ModelCard  — one hook per card, uses `profilePicture` only.
 *   • GalleryModal / ModelDetailClient — one hook per page/modal, uses
 *     `profilePicture` + `gallery` map by galleryId.
 *
 * Returned URLs are live signed URLs (or legacy public URLs for records that
 * haven't been backfilled yet). Both are opaque to the caller — show them
 * with <Image>, that's it.
 *
 * The hook is a no-op when `enabled === false` or `modelProfileId` is falsy.
 * It aborts in-flight requests and clears pending refresh timers on unmount,
 * or when either dep changes.
 */

export interface RevealedImages {
  /** Signed URL for the profile picture, or null if not loaded / not available. */
  profilePicture: string | null;
  /** galleryId → signed URL. Entries for items without an original are omitted. */
  gallery: Record<string, string>;
  /** True once the first successful fetch has returned. */
  loaded: boolean;
}

// Refresh a bit before the signed URL dies. Server TTL is 60s; re-fetch at
// ~50s so there's no visible gap when the URL rotates.
const REFRESH_LEAD_MS = 10_000;
const MIN_REFRESH_DELAY_MS = 5_000;

const EMPTY_STATE: RevealedImages = {
  profilePicture: null,
  gallery: {},
  loaded: false,
};

export function useRevealedImages(
  modelProfileId: string | null | undefined,
  enabled: boolean
): RevealedImages {
  const [state, setState] = useState<RevealedImages>(EMPTY_STATE);

  const abortRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Disabled or no id — reset and bail.
    if (!enabled || !modelProfileId) {
      setState(EMPTY_STATE);
      abortRef.current?.abort();
      abortRef.current = null;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    async function fetchUrls() {
      // Cancel any in-flight previous fetch.
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;

      try {
        const res = await fetch(`/api/model/${modelProfileId}/reveal-url`, {
          signal: ctl.signal,
          cache: "no-store",
        });

        if (!res.ok) {
          // 401/403/410 are expected "user can't see originals" — stay empty
          // so FaceBlurImage falls back to the blurred source silently.
          // 500/404 are real errors — log them but still stay empty.
          if (![401, 403, 410].includes(res.status)) {
            console.warn(
              `[useRevealedImages] reveal-url returned ${res.status} for ${modelProfileId}`
            );
          }
          return;
        }

        const data = (await res.json()) as {
          profilePicture?: string;
          gallery: Record<string, string>;
          urlExpiresAt: string;
        };

        if (cancelled) return;

        setState({
          profilePicture: data.profilePicture ?? null,
          gallery: data.gallery ?? {},
          loaded: true,
        });

        // Schedule the next refresh.
        const ms =
          new Date(data.urlExpiresAt).getTime() - Date.now() - REFRESH_LEAD_MS;
        const delay = Math.max(ms, MIN_REFRESH_DELAY_MS);

        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          if (!cancelled) fetchUrls();
        }, delay);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        console.warn("[useRevealedImages] fetch error", e);
      }
    }

    fetchUrls();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      abortRef.current = null;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [enabled, modelProfileId]);

  return state;
}