// Bump this whenever any shipped file changes so returning players get it.
const CACHE_VERSION = "loom-v20";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./site-bar.css",
  "./css/access.css",
  "./css/base.css",
  "./css/board.css",
  "./css/layout.css",
  "./css/sheets.css",
  "./css/studio.css",
  "./js/art.js",
  "./js/audio.js",
  "./js/board.js",
  "./js/campaign.js",
  "./js/keys.js",
  "./js/main.js",
  "./js/palettes.js",
  "./js/patterns.js",
  "./js/progress.js",
  "./js/render.js",
  "./js/rng.js",
  "./js/rules.js",
  "./js/settings.js",
  "./js/state.js",
  "./js/storage.js",
  "./js/studio-state.js",
  "./js/studio.js",
  "./js/tutorial.js",
  "./js/ui.js",
  "./js/version.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))
  )));
  self.clients.claim();
});
// Network first: when online, players always get the newest files (so a
// fix reaches them on the next visit); the cache is the offline fallback.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match("./index.html"))));
});
