/* Slotchinko seedable RNG. ?seed=123 in the URL makes a run reproducible.
 * Named streams keep systems independent: buying a chip never shifts the deck. */
(() => {
  "use strict";
  const hash = text => {
    let h = 2166136261;
    for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  // A stream is a function; its position is readable/settable as fn.state so saves can resume it exactly.
  const mulberry32 = start => {
    let a = start >>> 0;
    const next = () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    Object.defineProperty(next, "state", { get: () => a, set: v => { a = v | 0; } });
    return next;
  };
  const freshSeed = () => Math.floor(Math.random() * 1e9);

  class SeededRandom {
    constructor(seed) { this.reset(seed); }
    reset(seed) { this.seed = seed ?? freshSeed(); this.streams = new Map(); }
    stream(name) {
      if (!this.streams.has(name)) this.streams.set(name, mulberry32(hash(`${this.seed}:${name}`)));
      return this.streams.get(name);
    }
    random(name) { return this.stream(name)(); }
    exportState() { const streams = {}; for (const [k, f] of this.streams) streams[k] = f.state; return { seed: this.seed, streams }; }
    importState(d) { this.reset(d.seed); for (const [k, v] of Object.entries(d.streams || {})) this.stream(k).state = v; }
  }

  const urlSeed = () => {
    const raw = new URLSearchParams(window.location?.search || "").get("seed");
    return raw === null || raw === "" ? null : raw;
  };
  window.SlotchinkoRNG = { SeededRandom, urlSeed, freshSeed, hash };
})();
