const PREFIX = "loom.";
const read = (key, fallback) => {
  try { const raw = localStorage.getItem(PREFIX + key); return raw === null ? fallback : JSON.parse(raw); }
  catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
  catch { /* Storage may be unavailable; play continues. */ }
};
const prefersReducedMotion = () => globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

export const storage = {
  getSettings() {
    return read("settings", {
      sound: true, volume: 30, ambient: false, haptics: true,
      large: false, contrast: false, calm: prefersReducedMotion(), theme: "system"
    });
  },
  saveSettings(v) { write("settings", v); },
  getDaily(seed) { return read("daily." + seed, null); },
  saveDaily(seed, state) { write("daily." + seed, state); },
  getGallery() { return read("gallery", []); },
  // Deduplicate by seed so replaying a shared piece or re-saving a daily
  // never creates duplicate cards (and preserves user-visible ordering).
  addGallery(item) {
    const list = this.getGallery().filter(x => x.seed !== item.seed);
    list.unshift(item);
    write("gallery", list.slice(0, 60));
  },
  getRun() { return read("run", null); },
  saveRun(state) { write("run", state); },
  clearRun() { try { localStorage.removeItem(PREFIX + "run"); } catch { /* ignore */ } },
  getProgress(fallback) { return read("progress", fallback); },
  saveProgress(p) { write("progress", p); },
  getBest(seed) { return read("best." + seed, 0); },
  saveBest(seed, score) { write("best." + seed, Math.max(score, this.getBest(seed))); },
  reset() {
    try {
      Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }
};
