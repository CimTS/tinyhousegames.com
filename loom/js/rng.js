export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function dailySeed(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
export function shuffle(items, rng) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function encodeShare(seed, moves) {
  const packed = moves.map(m => m.type === "place"
    ? `p${m.index}.${m.tile.c}.${m.tile.t}`
    : m.type === "merge" ? `m${m.from}.${m.to}` : "u").join(",");
  return `#s=${encodeURIComponent(seed)}&m=${encodeURIComponent(packed)}`;
}
// Studio pieces have no move list, so their links carry the grid itself:
// 25 characters, "-" for empty or base-36 (color * 3 + tier - 1).
export function encodeStudio(cells) {
  return `#g=${cells.map(x => x ? (x.c * 3 + x.t - 1).toString(36) : "-").join("")}`;
}
export function decodeShare(hash) {
  const params = new URLSearchParams((hash || "").replace(/^#/, ""));
  const grid = params.get("g");
  if (grid !== null) {
    if (!/^[0-9a-e-]{25}$/.test(grid)) return null;
    return { studio: true, cells: [...grid].map(ch => ch === "-" ? null : { c: Math.floor(parseInt(ch, 36) / 3), t: parseInt(ch, 36) % 3 + 1 }) };
  }
  const seed = params.get("s");
  const raw = params.get("m");
  if (!seed || raw === null) return null;
  const moves = [];
  for (const part of raw.split(",").filter(Boolean)) {
    let match = /^p(\d{1,2})\.([0-4])\.([1-3])$/.exec(part);
    if (match) moves.push({ type: "place", index: Number(match[1]), tile: { c: Number(match[2]), t: Number(match[3]) } });
    else {
      match = /^m(\d{1,2})\.(\d{1,2})$/.exec(part);
      if (match) moves.push({ type: "merge", from: Number(match[1]), to: Number(match[2]) });
    }
  }
  return { seed, moves };
}
