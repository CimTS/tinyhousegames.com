/* Slotchinko visit count: the first time this device plays, send one anonymous "a visit happened"
   (just {"site":"slotchinko"}: no id, no stored browser data, no referrer), then remember it was sent so it never
   repeats. If it fails, nothing happens. The counter stores daily totals only. */
(() => {
  "use strict";
  const KEY = "slotchinko.counted";
  try {
    if (localStorage.getItem(KEY)) return;
    fetch("https://geode-lb.tinyhousegames.workers.dev/v1/visit", {
      method: "POST", body: '{"site":"slotchinko"}', keepalive: true, credentials: "omit", referrerPolicy: "no-referrer"
    }).catch(() => {});
    localStorage.setItem(KEY, "1");
  } catch { /* storage blocked: skip counting */ }
})();
