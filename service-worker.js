const CACHE_NAME = "orthodox-daily-v2.1.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./404.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./css/companion.css",
  "./js/storage.js",
  "./js/github-sync.js",
  "./js/companion.js",
  "./assets/photos/meteora.jpg",
  "./assets/photos/athos.jpg",
  "./js/astronomy.js",
  "./js/app.js",
  "./assets/cross.svg",
  "./assets/byzantine-bg.svg",
  "./assets/candle.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/art/month-01-theophany.jpg",
  "./assets/art/month-02-temple.jpg",
  "./assets/art/month-03-lent.jpg",
  "./assets/art/month-04-pascha.jpg",
  "./assets/art/month-05-ascension.jpg",
  "./assets/art/month-06-pentecost.jpg",
  "./assets/art/month-07-apostles.jpg",
  "./assets/art/month-08-transfiguration.jpg",
  "./assets/art/month-09-cross.jpg",
  "./assets/art/month-10-protection.jpg",
  "./assets/art/month-11-archangels.jpg",
  "./assets/art/month-12-nativity.jpg",
  "./assets/art/witness-01-catacomb.jpg",
  "./assets/art/witness-02-lamps.jpg",
  "./assets/art/history-01-council.jpg",
  "./assets/art/history-02-manuscript.jpg",
  "./assets/art/history-03-monastery.jpg",
  "./assets/art/history-04-pilgrimage.jpg",
  "./assets/icons/archangel-gabriel.jpg",
  "./assets/icons/archangel-michael.jpg",
  "./assets/icons/forty-martyrs-sebaste.jpg",
  "./assets/icons/saint-anastasia.jpg",
  "./assets/icons/saint-barbara.jpg",
  "./assets/icons/saint-catherine.jpg",
  "./assets/icons/saint-demetrius.jpg",
  "./assets/icons/saint-george.jpg",
  "./assets/icons/saint-ignatius.jpg",
  "./assets/icons/saint-john-baptist.jpg",
  "./assets/icons/saint-nicholas.jpg",
  "./assets/icons/saint-panteleimon.jpg",
  "./assets/icons/saint-paraskeva.jpg",
  "./assets/icons/saint-tatiana.jpg",
  "./assets/icons/theotokos-dormition-ritzos.jpg",
  "./assets/icons/theotokos-hodegetria-serbia.jpg",
  "./assets/icons/theotokos-nativity.jpg",
  "./assets/icons/theotokos-passion.jpg",
  "./assets/icons/theotokos-vladimir.jpg",
  "./data/fixed-calendar.json",
  "./data/history.json",
  "./data/prayers.json",
  "./data/practices.json",
  "./data/images.json",
  "./data/icons.json",
  "./data/martyrs.json",
  "./data/years/2026.json",
  "./data/years/2027.json",
  "./data/years/2028.json",
  "./data/years/2029.json",
  "./data/years/2030.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("orthodox-daily-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// Cache-first versioned shell: one complete release, no mixed old/new JavaScript.
// The browser checks service-worker.js for updates outside this handler.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch (error) {
      if (event.request.mode === "navigate") return await cache.match("./index.html");
      return new Response("Offline resource unavailable", {status: 503});
    }
  })());
});
