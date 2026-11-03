// Campaign content is data only. Each level introduces at most one new idea.
// prefill: starting threads ({ i: cell index, c: color, t: tier }).
// focus:   a color the shuttle offers a little more often (keeps goals reachable).
// goal:    how many of the level's cards must be complete to clear it.
import { makePiece } from "./board.js";

export const LEVELS = [
  { id: "c01", title: "First threads", note: "Weave in all five colors.", cards: ["rainbow"], goal: 1,
    prefill: [{ i: 12, c: 0, t: 1 }] },
  { id: "c02", title: "Two by two", note: "Gather four of one color into a square.", cards: ["cluster"], goal: 1,
    focus: 2, prefill: [{ i: 6, c: 2, t: 1 }, { i: 7, c: 2, t: 1 }, { i: 11, c: 2, t: 1 }] },
  { id: "c03", title: "A simple line", note: "Fill one row or column with one color.", cards: ["line"], goal: 1,
    focus: 1, prefill: [{ i: 10, c: 1, t: 1 }, { i: 12, c: 1, t: 1 }, { i: 14, c: 1, t: 1 }] },
  { id: "c04", title: "Four corners", note: "Match the four corners.", cards: ["corners"], goal: 1,
    focus: 3, prefill: [{ i: 0, c: 3, t: 1 }, { i: 24, c: 3, t: 1 }] },
  { id: "c05", title: "Tapestry threads", note: "Weave two twill pairs into two tapestry threads.", cards: ["tiers"], goal: 1,
    prefill: [{ i: 0, c: 0, t: 2 }, { i: 1, c: 0, t: 2 }, { i: 23, c: 2, t: 2 }, { i: 24, c: 2, t: 2 }] },
  { id: "c06", title: "The cross", note: "Center and its four neighbors, one color.", cards: ["cross"], goal: 1,
    focus: 4, prefill: [{ i: 12, c: 4, t: 1 }, { i: 7, c: 4, t: 1 }, { i: 17, c: 4, t: 1 }] },
  { id: "c07", title: "Slant", note: "Finish either card.", cards: ["diagonal", "rainbow"], goal: 1,
    focus: 0, prefill: [{ i: 0, c: 0, t: 1 }, { i: 6, c: 0, t: 1 }] },
  { id: "c08", title: "Warp and weft", note: "Finish either card.", cards: ["line", "weave"], goal: 1,
    focus: 1, prefill: [{ i: 2, c: 1, t: 1 }, { i: 7, c: 1, t: 1 }, { i: 11, c: 1, t: 1 }, { i: 13, c: 1, t: 1 }] },
  { id: "c09", title: "Patchwork", note: "Finish two of the three cards.", cards: ["cluster", "corners", "rainbow"], goal: 2,
    focus: 3, prefill: [{ i: 0, c: 3, t: 1 }, { i: 4, c: 3, t: 1 }] },
  { id: "c10", title: "Heirloom", note: "Finish two of the three cards.", cards: ["tiers", "diagonal", "cross"], goal: 2,
    focus: 4, prefill: [{ i: 12, c: 4, t: 2 }, { i: 13, c: 4, t: 2 }, { i: 6, c: 4, t: 1 }] },
  { id: "c11", title: "Gallery piece", note: "Finish two of the four cards.", cards: ["line", "cluster", "corners", "rainbow"], goal: 2,
    focus: 2, prefill: [{ i: 20, c: 2, t: 1 }, { i: 21, c: 2, t: 1 }] },
  { id: "c12", title: "Master weaver", note: "Finish three of the four cards.", cards: ["weave", "tiers", "cross", "diagonal"], goal: 3,
    focus: 1, prefill: [{ i: 12, c: 1, t: 1 }, { i: 0, c: 1, t: 2 }, { i: 1, c: 1, t: 2 }] }
];

export function levelPiece(level) {
  return makePiece(`campaign-${level.id}`, {
    cards: level.cards, prefill: level.prefill, focus: level.focus, mode: "campaign", level: level.id
  });
}

export function isLevelUnlocked(index, cleared) {
  return index === 0 || cleared.includes(LEVELS[index - 1]?.id);
}

export function levelCleared(level, result) {
  return result.complete >= level.goal;
}

export const levelById = id => LEVELS.find(l => l.id === id);
