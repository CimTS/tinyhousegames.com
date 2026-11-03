// Pure keyboard mapping so it can be tested without a DOM.
const MOVES = {
  ArrowUp: [-1, 0], w: [-1, 0],
  ArrowDown: [1, 0], s: [1, 0],
  ArrowLeft: [0, -1], a: [0, -1],
  ArrowRight: [0, 1], d: [0, 1]
};

export function moveCursor(cursor, key) {
  const step = MOVES[key] || MOVES[key.length === 1 ? key.toLowerCase() : key];
  if (!step) return null;
  const r = Math.min(4, Math.max(0, Math.floor(cursor / 5) + step[0]));
  const c = Math.min(4, Math.max(0, cursor % 5 + step[1]));
  return r * 5 + c;
}

export function keyAction(key) {
  if (key === "Enter" || key === " ") return "select";
  if (key === "u" || key === "U") return "undo";
  if (key === "Escape") return "settings";
  return null;
}
