import { makePiece, nextTile } from "./board.js";
import { hashSeed, mulberry32 } from "./rng.js";
import { canMerge, isPieceComplete } from "./rules.js";
import { evaluate, scorePiece } from "./patterns.js";
import { storage } from "./storage.js";

export class GameState {
  // `options.silent` suppresses all storage writes — used for share-link
  // replay and gallery previews so viewing a piece never mutates the archive.
  constructor(seed, saved = null, options = {}) {
    this.silent = Boolean(options.silent);
    this.data = saved ? structuredClone(saved) : makePiece(seed);
    this.listeners = new Set();
    this.recompute();
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this.data); }
  snapshot() { return structuredClone(this.data); }

  // Every unfinished run is saved as "the current run" so it can be resumed
  // after a reload; daily pieces are additionally kept per date.
  persist() {
    if (this.silent || this.data.mode === "tutorial") return;
    if (this.data.finished) return;
    storage.saveRun(this.data);
    if (this.data.mode === "daily") storage.saveDaily(this.data.seed, this.data);
  }

  // Undo is deliberately one step deep: it forgives a misclick without
  // inviting long chains of second-guessing.
  remember(before) { this.data.undo = [before]; }

  stats() {
    const cardsDone = this.progress.filter(p => p.done).length;
    return {
      threadsWoven: this.data.moves.filter(m => m.type === "place").length,
      merges: this.data.moves.filter(m => m.type === "merge").length,
      cardsDone,
      cardCount: this.data.cards.length,
      perfect: cardsDone === this.data.cards.length,
      braids: this.result.tier3
    };
  }

  recompute() {
    this.progress = this.data.cards.map(card => ({ card, ...evaluate(card, this.data.cells) }));
    this.result = scorePiece(this.data.cards, this.data.cells);
    this.complete = isPieceComplete(this.data.cells);
  }

  place(index) {
    if (this.data.finished || index < 0 || index >= 25 || this.data.cells[index]) return false;
    const before = {
      cells: this.data.cells.map(x => x ? { ...x } : null),
      queue: this.data.queue.map(x => ({ ...x })),
      moves: this.data.moves.slice(),
      finished: false
    };
    const tile = this.data.queue.shift();
    this.data.cells[index] = { ...tile };
    this.data.moves.push({ type: "place", index, tile: { ...tile } });
    this.remember(before);
    const placementCount = this.data.moves.filter(m => m.type === "place").length;
    const rng = mulberry32(hashSeed(`${this.data.seed}:queue:${placementCount}`));
    this.data.queue.push(nextTile(rng, this.data.focus ?? null));
    this.recompute(); this.persist(); this.emit();
    if (this.complete) this.finish();
    return true;
  }

  merge(from, to) {
    if (this.data.finished || !canMerge(this.data.cells, from, to)) return false;
    const before = {
      cells: this.data.cells.map(x => x ? { ...x } : null),
      queue: this.data.queue.map(x => ({ ...x })),
      moves: this.data.moves.slice(),
      finished: false
    };
    const source = { ...this.data.cells[from] }, target = { ...this.data.cells[to] };
    this.remember(before);
    this.data.cells[from] = null;
    this.data.cells[to] = { c: target.c, t: target.t + 1 };
    this.data.moves.push({ type: "merge", from, to, source, target });
    this.recompute(); this.persist(); this.emit();
    if (this.complete) this.finish();
    return true;
  }

  undo() {
    if (!this.data.undo.length || this.data.finished) return false;
    const previous = this.data.undo.pop();
    this.data.cells = previous.cells;
    this.data.queue = previous.queue || this.data.queue;
    this.data.moves = previous.moves || this.data.moves.slice(0, -1);
    this.data.finished = false;
    this.recompute(); this.persist(); this.emit();
    return true;
  }

  finish() {
    if (this.data.finished) return;
    this.data.finished = true;
    this.recompute();
    if (!this.silent && this.data.mode !== "tutorial") {
      storage.clearRun();
      const item = {
        seed: this.data.seed, moves: this.data.moves, cells: this.data.cells,
        mode: this.data.mode, level: this.data.level, title: this.data.title,
        score: this.result.score, stars: this.result.stars,
        cards: this.data.cards, completedAt: new Date().toISOString()
      };
      storage.addGallery(item);
      if (this.data.mode === "daily") storage.saveBest(this.data.seed, this.result.score);
      storage.saveDaily(this.data.seed, { ...this.data, finished: true });
    }
    this.emit();
  }
}
