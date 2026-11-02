// Offline support. Bump CACHE_VERSION whenever any file in ASSETS changes so
// returning players get the new build; old caches are deleted on activate.
const CACHE_VERSION = "dronesweeper-live-1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./site-bar.css",
  "./css/base.css",
  "./css/layout.css",
  "./css/board.css",
  "./css/panels.css",
  "./css/overlays.css",
  "./css/audio.css",
  "./js/main.js",
  "./js/game.js",
  "./js/rules.js",
  "./js/board.js",
  "./js/threats.js",
  "./js/upgrades.js",
  "./js/units.js",
  "./js/actions.js",
  "./js/events.js",
  "./js/save.js",
  "./js/history.js",
  "./js/input.js",
  "./js/icons.js",
  "./js/render.js",
  "./js/render-board.js",
  "./js/render-overlays.js",
  "./js/seed.js",
  "./js/storage.js",
  "./js/render-audio.js",
  "./js/audio/sound.js",
  "./js/audio/sfx.js",
  "./js/audio/cues.js",
  "./js/audio/hooks.js",
  "./js/audio/music.js",
  "./js/audio/score.js",
  "./js/audio/voices.js",
  "./js/audio/vendor/zzfx/zzfx-build.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("dronesweeper-") && k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for our own files; nothing else is ever requested.
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(hit => hit || fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
