// Minimaler Service Worker fuer PWA-Installierbarkeit.
// Bewusst ohne aggressives Caching, damit Echtzeit-Daten immer aktuell sind.

const CACHE = "live-chat-v1";
const APP_SHELL = ["/", "/chat", "/login", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Nur GET-Requests behandeln; alles andere (API, Auth, Realtime) direkt durchreichen.
  if (request.method !== "GET") return;

  // Network-first: immer frische Daten, Cache nur als Offline-Fallback.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (request.url.startsWith("http")) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
