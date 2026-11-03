import { neighbors } from "./board.js";

export const CARD_INFO = {
  line: ["Line", "One full row or column, one color"],
  cluster: ["Square", "Four of one color in a little square"],
  diagonal: ["Slant", "Three of one color in a slanting line"],
  corners: ["Corners", "All four corners, one color"],
  cross: ["Plus sign", "The middle and the four around it"],
  tiers: ["Two tapestries", "Make two of the finest threads"],
  rainbow: ["Rainbow", "All five thread colors"],
  weave: ["Row and column", "One full row and one full column"]
};

export function evaluate(type, cells) {
  const filled = cells.filter(Boolean);
  if (type === "line") {
    let done = false;
    for (let r = 0; r < 5; r++) if (same(Array.from({ length: 5 }, (_, c) => cells[r * 5 + c]))) done = true;
    for (let c = 0; c < 5; c++) if (same(Array.from({ length: 5 }, (_, r) => cells[r * 5 + c]))) done = true;
    return { progress: done ? 1 : 0, target: 1, done };
  }
  if (type === "cluster") {
    let done = false;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const group = [cells[r * 5 + c], cells[r * 5 + c + 1], cells[(r + 1) * 5 + c], cells[(r + 1) * 5 + c + 1]];
      if (same(group)) done = true;
    }
    return { progress: done ? 1 : 0, target: 1, done };
  }
  if (type === "diagonal") {
    let best = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      for (const [dr, dc] of [[1, 1], [1, -1]]) {
        const run = [];
        for (let k = 0; k < 5; k++) {
          const rr = r + k * dr, cc = c + k * dc;
          if (rr >= 0 && rr < 5 && cc >= 0 && cc < 5) run.push(cells[rr * 5 + cc]);
        }
        for (let color = 0; color < 5; color++) {
          best = Math.max(best, run.filter(tile => tile && tile.c === color).length);
        }
      }
    }
    return { progress: Math.min(3, best), target: 3, done: best >= 3 };
  }
  if (type === "corners") {
    const group = [cells[0], cells[4], cells[20], cells[24]];
    const counts = [0, 1, 2, 3, 4].map(color => group.filter(x => x && x.c === color).length);
    const progress = Math.max(...counts);
    return { progress, target: 4, done: progress === 4 };
  }
  if (type === "cross") {
    const group = [12, 7, 17, 11, 13].map(i => cells[i]);
    const counts = [0, 1, 2, 3, 4].map(color => group.filter(x => x && x.c === color).length);
    const progress = Math.max(...counts);
    return { progress, target: 5, done: progress === 5 };
  }
  if (type === "tiers") {
    const progress = Math.min(2, filled.filter(x => x.t === 3).length);
    return { progress, target: 2, done: progress === 2 };
  }
  if (type === "rainbow") {
    const present = new Set(filled.map(x => x.c));
    return { progress: present.size, target: 5, done: present.size === 5 };
  }
  if (type === "weave") {
    let rows = 0, cols = 0;
    for (let r = 0; r < 5; r++) if (same(Array.from({ length: 5 }, (_, c) => cells[r * 5 + c]))) rows = 1;
    for (let c = 0; c < 5; c++) if (same(Array.from({ length: 5 }, (_, r) => cells[r * 5 + c]))) cols = 1;
    const progress = rows + cols;
    return { progress, target: 2, done: progress === 2 };
  }
  return { progress: 0, target: 1, done: false };
}

function same(group) {
  return group.length > 0 && Boolean(group[0]) && group.every(x => x && x.c === group[0].c);
}

export function scorePiece(cards, cells) {
  const complete = cards.filter(card => evaluate(card, cells).done).length;
  const tier3 = cells.filter(x => x && x.t === 3).length;
  const score = complete + tier3;
  return { complete, tier3, score, stars: score >= 6 ? 3 : score >= 3 ? 2 : 1 };
}

// Plain-language help for each pattern, plus a small example picture.
// example: cells to fill ({ i: index, c: color, t: tier }). Tests check that
// every example really completes its pattern.
const run = (indices, c, t = 1) => indices.map(i => ({ i, c, t }));
export const CARD_HELP = {
  line: { how: "Fill one whole row (side to side) or one whole column (top to bottom) with a single color.",
    example: run([10, 11, 12, 13, 14], 1) },
  cluster: { how: "Make a little square of one color: two threads side by side, and two more right below them.",
    example: run([6, 7, 11, 12], 2) },
  diagonal: { how: "Place three of one color in a slanting line, like steps on a stair.",
    example: run([6, 12, 18], 3) },
  corners: { how: "Put the same color in all four corner squares of the loom.",
    example: run([0, 4, 20, 24], 4) },
  cross: { how: "Make a plus sign of one color: the middle square and the four squares touching it.",
    example: run([7, 11, 12, 13, 17], 0) },
  tiers: { how: "Weave two matching threads into a twill, then two matching twills into a tapestry thread. Make two of those.",
    example: [{ i: 7, c: 1, t: 3 }, { i: 17, c: 2, t: 3 }], anyColor: true },
  rainbow: { how: "Have all five colors somewhere on the loom. Anywhere at all counts.",
    example: [0, 1, 2, 3, 4].map(c => ({ i: 10 + c, c, t: 1 })) },
  weave: { how: "Fill one whole row and one whole column, each with a single color.",
    example: run([10, 11, 12, 13, 14, 2, 7, 17, 22], 1) }
};

export function exampleCells(type) {
  const cells = Array(25).fill(null);
  for (const { i, c, t } of CARD_HELP[type].example) cells[i] = { c, t };
  return cells;
}

export function progressWords({ progress, target, done }) {
  if (done) return "Done! Nicely woven.";
  if (!progress) return "Not started yet.";
  return `You have ${progress} of ${target} so far.`;
}
