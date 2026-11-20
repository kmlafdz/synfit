// SynFit PWA Service Worker v2.0.0
const CACHE_NAME = "synfit-pwa-v2";
const OFFLINE_URLS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/logo.png"
];

// 1. Install Event: Pre-cache essential app shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS).catch((err) => {
        console.warn("[PWA SW] Pre-caching partial fail (safe to ignore):", err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clean up stale legacy caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event: Network-first strategy with cache fallback
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Ignore non-GET requests, chrome-extension, or internal Firebase/Auth streams
  if (
    request.method !== "GET" ||
    request.url.startsWith("chrome-extension://") ||
    request.url.includes("firestore.googleapis.com") ||
    request.url.includes("identitytoolkit.googleapis.com") ||
    request.url.includes("securetoken.googleapis.com")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cache successful responses for static assets (images, icons, fonts)
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (request.destination === "image" ||
            request.destination === "font" ||
            request.destination === "style" ||
            request.destination === "script")
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // If offline, attempt to serve from cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Fallback for navigation requests
        if (request.mode === "navigate") {
          const rootCached = await caches.match("/");
          if (rootCached) return rootCached;
        }

        return new Response("Koneksi offline", {
          status: 503,
          statusText: "Offline",
          headers: new Headers({ "Content-Type": "text/plain" }),
        });
      })
  );
});
