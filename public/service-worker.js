/* public/service-worker.js */

// Change this string if you want to force everyone to update immediately.
const CACHE_PREFIX = "turboscout-cache";
const CACHE_VERSION = "v1";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

// Files CRA generates in production that we can use to discover ALL hashed assets.
const MANIFEST_URL = "./asset-manifest.json";

// Install: cache the app shell + all build assets listed in CRA's asset manifest
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);

        // Cache the manifest itself (nice to have)
        await cache.add(MANIFEST_URL);

        // Fetch the manifest so we know every hashed file to cache
        const res = await fetch(MANIFEST_URL, { cache: "no-store" });
        const manifest = await res.json();

        // CRA manifest has "files" and sometimes "entrypoints"
        const filesObj = manifest.files || {};
        const entrypoints = manifest.entrypoints || [];

        const urlsToCache = new Set();

        // Cache core navigations
        urlsToCache.add("./"); // homepage
        urlsToCache.add("./index.html");

        // Cache every file in manifest.files
        for (const key of Object.keys(filesObj)) {
          const url = filesObj[key];
          if (typeof url === "string") urlsToCache.add("." + url);
        }

        // Cache entrypoints too (belt + suspenders)
        for (const url of entrypoints) {
          if (typeof url === "string") urlsToCache.add("." + url);
        }

        await cache.addAll(Array.from(urlsToCache));

        // Activate immediately on install (so first load is ready ASAP)
        await self.skipWaiting();
      } catch (e) {
        // If manifest fetch fails, we still install the SW, but offline won't be ready yet.
        // (Next online load will fix it.)
      }
    })()
  );
});

// Activate: clear old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// Fetch:
// - For navigation (page loads), serve cached index.html (SPA routing)
// - For other requests, serve cache-first, fall back to network and cache it
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // SPA navigation: return cached index.html so routes work offline
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match("./index.html");
        if (cachedIndex) return cachedIndex;

        // Fallback to network if not cached yet
        return fetch(req);
      })()
    );
    return;
  }

  // Static assets and same-origin files
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        // Cache successful GET responses
        if (req.method === "GET" && fresh && fresh.ok) {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (e) {
        // Offline and not cached
        return new Response("", { status: 504, statusText: "Offline" });
      }
    })()
  );
});

// Allow page to force activate waiting SW
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
