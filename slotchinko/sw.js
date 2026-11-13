/* Slotchinko service worker: plays offline from this folder only.
   Precaches the game's own files; answers same-origin GET requests from that cache, falling back
   to the network for anything not cached. Never touches other sites and sends nothing anywhere.
   CACHE_VERSION is a hash of the precached files (tools/slotchinko-sw-version.mjs); a new version
   installs a fresh cache and deletes the old one, so updates arrive on the next visit.
   The code in this file is not part of that hash, so a change here refills the same cache in place. */
self.CACHE_VERSION = "0c6aff2da171";
self.PRECACHE = ["./","aimflow.js","board.js","boardview.js","boss-art.js","boss-rules.js","boss-view.js","bosses-data.js","bosses.css","coach.js","coin.js","data.js","desktop-copy.js","desktop.css","favicon.svg","fonts/barlow-condensed-latin-500-normal.woff2","fonts/barlow-condensed-latin-700-normal.woff2","fonts/barlow-condensed-latin-800-normal.woff2","fonts/barlow-condensed-latin-900-normal.woff2","fonts/dm-mono-latin-400-normal.woff2","fonts/dm-mono-latin-500-normal.woff2","fonts/fonts.css","game.js","icon-180.png","icon-192.png","icon-512.png","icon-maskable-512.png","index.html","keys.js","lanes.js","manifest.webmanifest","music.js","overlays.js","path.js","payouts.js","phone.css","physics.js","poker.js","polish.css","rng.js","save.js","scoring.js","shop.js","site-bar.css","sound-hooks.js","sound.js","status.js","style.css","tablet.css","tutorial.css","ui.js","vendor/matter.min.js","vendor/zzfx/zzfx-build.js","vice-voices.js","view-shop.js","view.js","visit.js","version.js"];
const CACHE = "slotchinko-" + self.CACHE_VERSION;

/* Fill the cache straight from the network, never from the browser's own HTTP cache: that can still hold the last
   build's files, and a cache filled from it would serve the old game under the new name until the next release.
   Then check the download really is this build before taking over. If it is not (a server still handing out old
   files just after a release), the install fails, the old copy keeps running, and the browser tries again next visit. */
async function install() {
  const cache = await caches.open(CACHE);
  await cache.addAll(self.PRECACHE.map((url) => new Request(url, { cache: "reload" })));
  const version = await cache.match("version.js");
  const build = version ? await version.text() : "";
  if (!build.includes(self.CACHE_VERSION.slice(0, 7))) {
    await caches.delete(CACHE);
    throw new Error("Slotchinko: the download was not this build; keeping the old copy for now");
  }
  await self.skipWaiting();
}
self.addEventListener("install", (event) => {
  event.waitUntil(install());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("slotchinko-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return; // not ours: leave it alone
  event.respondWith(caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))));
});
