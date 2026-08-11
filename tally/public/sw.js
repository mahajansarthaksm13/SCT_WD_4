/**
 * The tasks were always local. The app itself was not — every load still went
 * to the network for the shell and the chunks, so "works offline" was only ever
 * half true. This closes the other half.
 *
 * Two strategies, and deliberately no more:
 *   • Navigations: network first, cached shell as the fallback. A deploy is
 *     picked up on the very next load rather than whenever the cache expires,
 *     and a plane is the only thing that ever sees the fallback.
 *   • /_next/static/*: cache first. Every one of those URLs is content-hashed,
 *     so a hit can never be stale — a changed file is a changed URL.
 *
 * Anything else (other origins, POSTs, the manifest) is left alone and goes
 * straight to the network. A service worker that intercepts everything is a
 * service worker that has to be right about everything.
 */

const CACHE = "tally-v1";
const SHELL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      // Take over the tab that registered us, so the first visit caches its own
      // chunks instead of leaving the next one to do it.
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(SHELL, copy)));
          return response;
        })
        .catch(async () => (await caches.match(SHELL)) ?? Response.error()),
    );
    return;
  }

  if (!url.pathname.startsWith("/_next/static/")) return;

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          // Only a real 200 is worth keeping. Caching an error means serving
          // that error back forever, offline and on.
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
          }
          return response;
        }),
    ),
  );
});
