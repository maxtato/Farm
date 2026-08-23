const CACHE = "ferme-v10";
const SHELL = ["/", "/index.html", "/vendor/three.min.js", "/icon.svg", "/manifest.json",
  "/js/1-base.js", "/js/2-engins.js", "/js/3-terrain.js", "/js/3b-batiments.js", "/js/3d-mobilier.js", "/js/3c-carte.js", "/js/4-cultures.js",
  "/js/5-effets.js", "/js/6-cycle.js", "/js/7-interface.js", "/js/8-conduite.js",
  "/js/9-boucle.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first sur la coquille HTML : un déploiement est pris au premier rechargement
  const isShell =
    req.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname === "/index.html";
  if (isShell) {
    e.respondWith(
      fetch(req).then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return resp;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match("/")))
    );
    return;
  }

  // Cache-first pour le reste : three.js, icône, manifeste
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return resp;
      }).catch(() => hit);
    })
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
