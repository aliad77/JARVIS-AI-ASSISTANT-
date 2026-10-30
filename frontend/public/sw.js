/* JARVIS service worker: offline app shell + static asset cache.
 * - Never caches /api/ (the optional desktop backend) or cross-origin requests
 *   (WebLLM manages its own model cache separately).
 * - Navigations: network first, falling back to the cached app shell offline.
 * - Static files: cache first, with a size cap and old-version cleanup.
 */
const VERSION = "jarvis-v2-1";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const MAX_ASSET_ENTRIES = 150;
const SHELL_FILES = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("jarvis-") && !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(SHELL).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html").then((r) => r || caches.match("/"))),
    );
    return;
  }

  if (/^\/(assets|icons)\//.test(url.pathname) || url.pathname.endsWith(".webmanifest")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && res.type === "basic") {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(req, copy)).then(() => trim(ASSETS, MAX_ASSET_ENTRIES));
            }
            return res;
          }),
      ),
    );
  }
});
