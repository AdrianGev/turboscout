const CACHE_PREFIX = "turboscout-cache";
const CACHE_VERSION = "v4";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

const MANIFEST_URL = "asset-manifest.json";

function abs(path) {
  return new URL(path, self.registration.scope).toString();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await cache.addAll([abs("./"), abs("./index.html"), abs(`./${MANIFEST_URL}`)]);

      try {
        const res = await fetch(abs(`./${MANIFEST_URL}`), { cache: "no-store" });
        const manifest = await res.json();

        const files = Object.values(manifest.files || {});
        const entrypoints = manifest.entrypoints || [];
        const urlsToCache = [...new Set([...files, ...entrypoints])]
          .filter(Boolean)
          .map((u) => new URL(u, self.location.origin).toString());

        await cache.addAll(urlsToCache);
      } catch (e) {
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME) return caches.delete(k);
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      if (req.mode === "navigate") {
        const cachedIndex = await cache.match(abs("./index.html"));
        if (cachedIndex) return cachedIndex;

        try {
          return await fetch(req);
        } catch (e) {
          return (await cache.match(abs("./index.html"))) || new Response("Offline", { status: 503 });
        }
      }

      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok && req.method === "GET") {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (e) {
        return new Response("", { status: 504, statusText: "Offline" });
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});