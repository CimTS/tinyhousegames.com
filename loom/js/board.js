import { hashSeed, mulberry32, shuffle } from "./rng.js";

export const SIZE = 5;
export const COLORS = ["Terracotta", "Indigo", "Moss", "Saffron", "Plum"];
export const COLOR_HEX = ["#C4643C", "#3D5A80", "#6B8E5A", "#D9A441", "#7B4B6E"];
export const PATTERNS = ["dots", "diagonal stripes", "chevrons", "waves", "crosshatch"];

// `options` lets curated content (campaign levels) override the cards,
// starting threads and mode while keeping the seeded queue deterministic.
// With no options the output is identical to the original generator.
// Seeds starting "studio-" give a blank free-placement canvas.
export function isStudioSeed(seed) { return String(seed).startsWith("studio-"); }
export function makePiece(seed, options = {}) {
  const studio = isStudioSeed(seed);
  const rng = mulberry32(hashSeed(seed));
  const cells = Array(25).fill(null);
  const spots = shuffle([...Array(25).keys()], rng).slice(0, 3);
  spots.forEach((index, i) => { cells[index] = { c: Math.floor(rng() * 5), t: 1 + (i === 2 && rng() > .55 ? 1 : 0) }; });
  if (options.prefill || studio) {
    cells.fill(null);
  }
  if (options.prefill) {
    for (const { i, c, t } of options.prefill) cells[i] = { c, t };
  }
  const focus = options.focus ?? null;
  const queue = Array.from({ length: 3 }, () => nextTile(rng, focus));
  const cardPool = shuffle(["line", "cluster", "diagonal", "corners", "cross", "tiers", "rainbow", "weave"], rng).slice(0, 4);
  const piece = {
    seed, cells, queue, cards: options.cards ? [...options.cards] : cardPool,
    rngState: Math.floor(rng() * 0xFFFFFFFF) >>> 0, moves: [], undo: [], finished: false,
    mode: options.mode || (studio ? "studio" : seed.length === 10 ? "daily" : "free")
  };
  if (options.level) piece.level = options.level;
  if (focus !== null) piece.focus = focus;
  return piece;
}
// `focus` (a color index) gently favours one color for curated levels.
// Without it, exactly one rng() call is used, as in the original.
export function nextTile(rng, focus = null) {
  if (focus !== null && rng() < 0.4) return { c: focus, t: 1 };
  return { c: Math.floor(rng() * 5), t: 1 };
}
export function indexOf(row, col) { return row * SIZE + col; }
export function coords(index) { return { row: Math.floor(index / SIZE), col: index % SIZE }; }
export function neighbors(index) {
  const { row, col } = coords(index);
  return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
    .filter(([r, c]) => r >= 0 && r < 5 && c >= 0 && c < 5).map(([r, c]) => indexOf(r, c));
}
export function createRngFromState(seed, count) {
  const rng = mulberry32(hashSeed(seed));
  for (let i = 0; i < count; i++) rng();
  return rng;
}
