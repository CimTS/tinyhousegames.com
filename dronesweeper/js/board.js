import { threatForRoll, threatCount } from "./threats.js";

const DIRECTIONS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

/** Tiles within Chebyshev distance `range` (excluding the tile itself). */
export function within(a, b, size, range) {
  if (a === b) return false;
  const dx = Math.abs((a % size) - (b % size)), dy = Math.abs(Math.floor(a / size) - Math.floor(b / size));
  return Math.max(dx, dy) <= range;
}

export function neighbors(index, size) {
  const x = index % size, y = Math.floor(index / size), out = [];
  for (const [dy, dx] of DIRECTIONS) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < size && ny < size) out.push(ny * size + nx);
  }
  return out;
}

export function isAdjacent(a, b, size) { return neighbors(a, size).includes(b); }

export function createBoard(floor, rng) {
  const size = Math.min(10, 8 + Math.floor((floor - 1) / 2));
  const cells = Array.from({ length: size * size }, (_, index) => ({
    index, revealed: false, flagged: false, threat: null, cleared: false,
    estimate: 0, exit: false
  }));
  const start = 0, exit = size * size - 1;
  cells[exit].exit = true;
  const count = threatCount(floor, size);
  const reserved = new Set([start, exit, 1, size, exit - 1, exit - size]);
  let placed = 0, attempts = 0;
  while (placed < count && attempts++ < size * size * 20) {
    const index = Math.floor(rng() * cells.length);
    if (reserved.has(index) || cells[index].threat) continue;
    cells[index].threat = threatForRoll(rng(), floor);
    placed++;
  }
  for (const cell of cells) {
    const actual = neighbors(cell.index, size).filter(i => cells[i].threat).length;
    // Sensor estimates are deliberately noisy, including occasional false positives.
    const noise = rng() < .32 ? (rng() < .5 ? -1 : 1) : 0;
    cell.estimate = Math.max(0, Math.min(8, actual + noise));
  }
  return { size, cells, start, exit, threatCount: placed };
}

export function floodReveal(board, startIndex) {
  const queue = [startIndex], revealed = [];
  const seen = new Set();
  while (queue.length) {
    const index = queue.shift();
    if (seen.has(index)) continue;
    seen.add(index);
    const cell = board.cells[index];
    if (!cell || cell.threat || cell.flagged) continue;
    // The start cell may already be revealed by the action that triggered the flood.
    if (cell.revealed && index !== startIndex) continue;
    if (!cell.revealed) { cell.revealed = true; revealed.push(index); }
    if (cell.estimate === 0) {
      for (const next of neighbors(index, board.size)) {
        if (!seen.has(next)) queue.push(next);
      }
    }
  }
  return revealed;
}
