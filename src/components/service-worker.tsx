"use client";

import { useEffect } from "react";

/** Registriert den Service Worker fuer die PWA-Funktionalitaet. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Registrierung fehlgeschlagen – App funktioniert trotzdem. */
      });
    }
  }, []);
  return null;
}
