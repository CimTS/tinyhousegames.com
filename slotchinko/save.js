/* Slotchinko run save: autosaves a run in progress to localStorage at safe checkpoints
   (after each hand action, each finished drop and each shop action) so it can be continued.
   Format: { v, sum, data } with an FNV-1a checksum of the JSON; anything old, corrupt or
   tampered is discarded. This device only: localStorage, no cookies, nothing sent anywhere. */
(() => {
  "use strict";
  const KEY = "slotchinko-run", VERSION = 2; // 2: every blind starts from zero (score, total, handsLeft)
  const fnv = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };

  function pack(game) {
    const data = JSON.stringify({ state: game.state, rng: game.rng.exportState() });
    return JSON.stringify({ v: VERSION, sum: fnv(data), data });
  }
  /* The saved run, or null for missing, old, corrupt or finished saves. */
  function unpack(raw) {
    try {
      const o = JSON.parse(raw);
      if (!o || o.v !== VERSION || typeof o.data !== "string" || fnv(o.data) !== o.sum) return null;
      const d = JSON.parse(o.data);
      const s = d && d.state;
      if (!s || !Array.isArray(s.cards) || !Array.isArray(s.deck) || typeof s.round !== "number" || !d.rng) return null;
      if (s.victory || (s.phase === "roundEnd" && !s.won)) return null;
      return d;
    } catch { return null; }
  }
  const store = () => { try { return window.localStorage; } catch { return null; } };
  function write(game) {
    const s = game.state;
    if (s.victory || (s.phase === "roundEnd" && !s.won)) return clear(); // the run is over
    if (s.phase === "drop") return; // mid-drop is not a checkpoint; the last one stands
    try { store()?.setItem(KEY, pack(game)); } catch { /* full or private mode: play on */ }
  }
  function read() { const raw = store()?.getItem(KEY); return raw ? unpack(raw) : null; }
  function clear() { try { store()?.removeItem(KEY); } catch { /* ignore */ } }
  /* Puts a saved run back exactly: state, RNG streams and the board for its blind. */
  function restore(game, d) {
    game.timers = []; game.state = d.state; game.rng.importState(d.rng);
    if (game._boardRules) game._boardRules();
    game.physics.setRound(d.state.round);game._bossRestore?.();
    game.render();
    return game;
  }

  // Checkpoints: wrap the game actions so game.js stays logic-only.
  const G = window.SlotchinkoGame && window.SlotchinkoGame.prototype;
  if (G) for (const name of ["dealTutorialHand", "toggleHold", "spin", "finishRound", "nextRound", "purchase", "sellChip", "rerollShop", "useConsumable", "newRun", "choosePath", "resolveEvent"]) {
    const orig = G[name]; if (typeof orig !== "function") continue;
    G[name] = function (...args) { const r = orig.apply(this, args); if (this.autosave) write(this); return r; };
  }
  window.SlotchinkoSave = { KEY, VERSION, pack, unpack, write, read, clear, restore, checksum: fnv };
})();
