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

// Whether to ask "Would you like sound?". `saved` is the stored settings, or null.
// A new player is asked until they answer. Someone who already has Loom data
// from before the question existed keeps their setting and is never asked.
export function soundChoicePending(saved, hasData) {
  if (saved?.soundAsked === false) return true;        // asked before, not answered yet
  if (saved?.soundAsked === true) return false;
  return !hasData;                                      // never asked: only brand-new players
}

// ---- reading saved data back safely --------------------------------------
// Saved data can be damaged, or left over from an older version in another shape.
// Nothing read from storage is trusted: a saved piece that cannot be opened is
// treated as "nothing saved", so a bad save can never lock a player out.
const isTile = x => Boolean(x) && Number.isInteger(x.c) && x.c >= 0 && x.c <= 4 && Number.isInteger(x.t) && x.t >= 1 && x.t <= 3;
const isCloth = cells => Array.isArray(cells) && cells.length === 25 && cells.every(x => x === null || isTile(x));
/** True for a saved piece the game can open. */
export function validPiece(p) {
  return Boolean(p) && typeof p === "object" && !Array.isArray(p) &&
    typeof p.seed === "string" && typeof p.mode === "string" && isCloth(p.cells) &&
    Array.isArray(p.queue) && p.queue.length > 0 && p.queue.every(isTile) &&
    Array.isArray(p.moves) && Array.isArray(p.cards) && Array.isArray(p.undo);
}
const piece = (key) => { const p = read(key, null); return validPiece(p) ? p : null; };
/** True for a gallery entry that can be drawn: it has its cloth, or (early versions) the moves that made it. */
const validGalleryItem = x => Boolean(x) && typeof x === "object" && typeof x.seed === "string" &&
  (isCloth(x.cells) || (x.cells === undefined && Array.isArray(x.moves)));
const DEFAULT_SETTINGS = () => ({
  sound: true, volume: 30, ambient: false, haptics: true,
  large: false, contrast: false, calm: prefersReducedMotion(), theme: "system"
});
/** The saved settings with every value checked; anything missing or of the wrong kind falls back to its default. */
export function cleanSettings(saved) {
  const out = DEFAULT_SETTINGS();
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return out;
  for (const key of ["sound", "ambient", "haptics", "large", "contrast", "calm", "marks", "soundAsked"]) {
    if (typeof saved[key] === "boolean") out[key] = saved[key];
  }
  if (Number.isFinite(saved.volume)) out.volume = Math.min(100, Math.max(0, saved.volume));
  if (["system", "light", "dark"].includes(saved.theme)) out.theme = saved.theme;
  return out;
}

export const GALLERY_LIMIT = 200;
// The same piece, woven the same way: same seed and the same threads in the same squares.
// (Entries from early versions stored only their moves.)
const sameCloth = (a, b) => a.seed === b.seed &&
  JSON.stringify(a.cells ?? a.moves ?? null) === JSON.stringify(b.cells ?? b.moves ?? null);

export const storage = {
  // The settings exactly as stored, or null if none were ever saved.
  getSavedSettings() { return read("settings", null); },
  // True if Loom has stored anything at all on this device.
  hasAny() {
    try { return Object.keys(localStorage).some(k => k.startsWith(PREFIX)); }
    catch { return false; }
  },
  getSettings() { return cleanSettings(read("settings", null)); },
  saveSettings(v) { write("settings", v); },
  getDaily(seed) { return piece("daily." + seed); },
  saveDaily(seed, state) { write("daily." + seed, state); },
  // The one in-progress studio canvas, kept apart from the puzzle run.
  getStudio() { return piece("studio"); },
  saveStudio(state) { write("studio", state); },
  getGallery() {
    const list = read("gallery", []);
    if (!Array.isArray(list)) return [];
    return list.filter(validGalleryItem).map(x => ({
      ...x, score: Number.isFinite(x.score) ? x.score : 0,
      stars: Number.isFinite(x.stars) ? Math.min(3, Math.max(0, Math.floor(x.stars))) : 0
    }));
  },
  // The gallery never loses a piece. A piece is only left out when the very same
  // cloth is already there (saving a studio canvas twice without changing it).
  // A studio canvas, a daily piece and a campaign level each keep one seed, so
  // matching on the seed alone made every new save replace the one before it.
  addGallery(item) {
    const list = this.getGallery().filter(x => !sameCloth(x, item));
    list.unshift(item);
    write("gallery", list.slice(0, GALLERY_LIMIT));
  },
  getRun() { return piece("run"); },
  saveRun(state) { write("run", state); },
  clearRun() { try { localStorage.removeItem(PREFIX + "run"); } catch { /* ignore */ } },
  getProgress(fallback) { return read("progress", fallback); },
  saveProgress(p) { write("progress", p); },
  getBest(seed) { const n = read("best." + seed, 0); return Number.isFinite(n) ? n : 0; },
  saveBest(seed, score) { write("best." + seed, Math.max(score, this.getBest(seed))); },
  reset() {
    try {
      Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }
};
