"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "loading" | "unsupported" | "default" | "granted" | "denied";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** Base64-URL VAPID-Key in Uint8Array umwandeln (fuer pushManager.subscribe). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushToggle({ userId }: { userId: string }) {
  const supabase = createClient();
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as Status);
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      if (!VAPID_PUBLIC_KEY) {
        throw new Error(
          "VAPID Public Key fehlt (NEXT_PUBLIC_VAPID_PUBLIC_KEY)."
        );
      }

      const permission = await Notification.requestPermission();
      setStatus(permission as Status);
      if (permission !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            VAPID_PUBLIC_KEY
          ) as BufferSource,
        });
      }

      const json = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        },
        { onConflict: "endpoint" }
      );
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konnte nicht aktivieren.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("default");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konnte nicht deaktivieren.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Push-Benachrichtigungen</p>
          <p className="mt-0.5 text-xs text-neutral-400">
            {status === "unsupported"
              ? "Dieser Browser unterstützt keine Push-Nachrichten."
              : status === "granted"
                ? "Aktiv – du bekommst Benachrichtigungen bei neuen Nachrichten."
                : status === "denied"
                  ? "Blockiert. Erlaube Benachrichtigungen in den Browser-Einstellungen."
                  : "Aktiviere Benachrichtigungen für neue Nachrichten."}
          </p>
        </div>

        {status === "granted" ? (
          <button
            onClick={disable}
            disabled={busy}
            className="shrink-0 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Deaktivieren
          </button>
        ) : (
          <button
            onClick={enable}
            disabled={busy || status === "unsupported" || status === "denied"}
            className="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition disabled:opacity-40 dark:bg-white dark:text-neutral-900"
          >
            {busy ? "…" : "Aktivieren"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <p className="mt-3 text-xs text-neutral-400">
        Hinweis: Auf dem iPhone musst du die App zuerst über „Teilen → Zum
        Home-Bildschirm" installieren, damit Push funktioniert.
      </p>
    </div>
  );
}
