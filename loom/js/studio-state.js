// Studio (free placement) actions on a GameState: any thread, any tier,
// anywhere; threads can be moved, swapped or lifted. Undo goes deeper here
// than in the puzzle because art is made by trying things.
import { makePiece, isStudioSeed } from "./board.js";

const UNDO_LIMIT = 100;
const valid = i => Number.isInteger(i) && i >= 0 && i < 25;
export const isStudio = state => state?.data.mode === "studio";
export const newStudioSeed = () => `studio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function commit(state, change) {
  const d = state.data;
  d.undo.push({ cells: d.cells.map(x => x ? { ...x } : null), queue: d.queue.map(x => ({ ...x })), moves: d.moves.slice(), finished: false });
  if (d.undo.length > UNDO_LIMIT) d.undo.shift();
  change(d.cells);
  state.recompute(); state.persist(); state.emit();
  return true;
}

export function setCell(state, index, tile) {
  if (!isStudio(state) || !valid(index) || !tile) return false;
  const now = state.data.cells[index];
  if (now && now.c === tile.c && now.t === tile.t) return false;
  return commit(state, cells => { cells[index] = { c: tile.c, t: tile.t }; });
}

// Onto an empty cell the thread moves; onto another thread the two swap.
export function moveCell(state, from, to) {
  if (!isStudio(state) || from === to || !valid(from) || !valid(to) || !state.data.cells[from]) return false;
  return commit(state, cells => { [cells[from], cells[to]] = [cells[to], cells[from]]; });
}

export function clearCell(state, index) {
  if (!isStudio(state) || !valid(index) || !state.data.cells[index]) return false;
  return commit(state, cells => { cells[index] = null; });
}

// A studio canvas holding saved or shared cells (copied, never aliased).
export function studioPiece(cells, seed = newStudioSeed(), cards = null) {
  const piece = makePiece(isStudioSeed(seed) ? seed : newStudioSeed());
  piece.cells = cells.map(x => x ? { c: x.c, t: x.t } : null);
  if (Array.isArray(cards)) piece.cards = cards.slice();
  return piece;
}
