// Draws the board, queue, cards and score. Cells are created once and
// updated in place so keyboard focus never jumps.
import { tileSvg, cardIcon, colorName } from "./art.js";
import { CARD_INFO } from "./patterns.js";
import { coords, neighbors } from "./board.js";
import { canMerge } from "./rules.js";

const $ = id => document.getElementById(id);
const tileKey = t => t ? `${t.c}.${t.t}` : "";

export class Renderer {
  constructor() {
    this.board = $("board");
    this.selected = null;
    this.cursor = 12;
    this.flash = null;
    this.onCell = () => {};
    this.onCard = () => {};
    $("cards-help").addEventListener("click", () => this.onCard(null));
    this.cells = [];
    for (let i = 0; i < 25; i++) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "cell"; b.dataset.index = i; b.dataset.key = "";
      b.addEventListener("click", () => this.onCell(i));
      b.addEventListener("focus", () => { this.cursor = i; this.syncTabStops(); });
      this.cells.push(b);
    }
    this.board.replaceChildren(...this.cells);
  }

  attach(state) {
    this.state = state;
    this.selected = null;
    this.flash = null;
    this.prevDone = new Set(state.progress.filter(p => p.done).map(p => p.card));
    this.cells.forEach(b => { b.dataset.key = "!"; });   // force art refresh (palette may differ)
    this.render();
  }

  syncTabStops() { this.cells.forEach((b, i) => { b.tabIndex = i === this.cursor ? 0 : -1; }); }

  render() {
    if (!this.state) return;
    const d = this.state.data;
    const studio = d.mode === "studio";   // free placement: no merge hints
    const partners = this.selected === null || studio ? [] :
      neighbors(this.selected).filter(j => canMerge(d.cells, this.selected, j));
    d.cells.forEach((tile, i) => {
      const b = this.cells[i], { row, col } = coords(i);
      if (b.dataset.key !== tileKey(tile)) {
        b.replaceChildren(...(tile ? [tileSvg(tile, false)] : []));
        b.dataset.key = tileKey(tile);
      }
      b.classList.toggle("filled", Boolean(tile));
      b.classList.toggle("selected", this.selected === i);
      b.classList.toggle("can-merge", partners.includes(i));
      b.classList.remove("just-placed", "just-merged");
      const where = `row ${row + 1}, column ${col + 1}`;
      let label = tile ? `${colorName(tile.c)}, tier ${tile.t}, ${where}` : `Empty, ${where}`;
      if (this.selected === i) label += ", selected";
      if (partners.includes(i)) label += ", can merge here";
      b.setAttribute("aria-label", label);
      b.setAttribute("aria-pressed", String(this.selected === i));
    });
    if (this.flash) {
      this.cells[this.flash.index]?.classList.add(this.flash.type === "merge" ? "just-merged" : "just-placed");
      this.flash = null;
    }
    this.syncTabStops();
    this.renderQueue(d.queue);
    this.renderCards();
    this.renderScore();
    $("undo-button").disabled = !d.undo.length || d.finished;
    $("guidance").textContent = this.guidance(partners);
  }

  guidance(partners) {
    if (this.state.data.finished) return "This piece is complete.";
    if (this.state.data.mode === "studio") return this.selected === null
      ? "Tap a square to weave your thread. Drag threads anywhere; off the loom lifts them."
      : "Tap any square to move it there, or tap it again to put it down.";
    if (this.selected === null) return "Tap an empty square to place the next thread.";
    if (!partners.length) return "No match beside it yet. Tap it again to put it down.";
    return "Tap a ringed neighbor to weave them together.";
  }

  renderQueue(queue) {
    const q = $("queue");
    const [next, ...later] = queue;
    const nextBox = document.createElement("div");
    nextBox.className = "queue-next";
    const label = document.createElement("div");
    label.className = "q-label";
    label.innerHTML = "<small>Next</small>";
    const name = document.createElement("span");
    name.textContent = colorName(next.c);
    label.append(name);
    nextBox.append(tileSvg(next, false), label);
    const laterBox = document.createElement("div");
    laterBox.className = "queue-later";
    laterBox.setAttribute("aria-hidden", "true");
    later.forEach(t => laterBox.append(tileSvg(t, false)));
    q.replaceChildren(nextBox, laterBox);
    q.setAttribute("aria-label", `Next thread: ${colorName(next.c)}. After that: ${later.map(t => colorName(t.c)).join(", ")}.`);
  }

  renderCards() {
    const host = $("cards");
    const nowDone = new Set();
    const items = this.state.progress.map(({ card, progress, target, done }) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "pattern-card" + (done ? " done" : "");
      item.addEventListener("click", () => this.onCard(card));
      if (done) { nowDone.add(card); if (!this.prevDone.has(card)) item.classList.add("just-done"); }
      const icon = document.createElement("div");
      icon.className = "pattern-icon"; icon.append(cardIcon(card));
      const info = document.createElement("div");
      const name = document.createElement("span"), desc = document.createElement("span");
      name.className = "pattern-name"; name.textContent = CARD_INFO[card][0];
      desc.className = "pattern-desc"; desc.textContent = CARD_INFO[card][1];
      info.append(name, desc);
      const count = document.createElement("span");
      count.className = "pattern-progress";
      count.textContent = done ? "Done ✓" : `${progress} / ${target}`;
      item.setAttribute("aria-label", `${CARD_INFO[card][0]}: ${done ? "complete" : `${progress} of ${target}`}. Show how to make it.`);
      item.append(icon, info, count);
      return item;
    });
    this.newlyDone = [...nowDone].filter(c => !this.prevDone.has(c));
    this.prevDone = nowDone;
    host.replaceChildren(...items);
    $("card-count").textContent = `${nowDone.size} of ${this.state.progress.length}`;
  }

  renderScore() {
    const r = this.state.result;
    $("score").textContent = String(r.score);
    $("score-unit").textContent = r.score === 1 ? "point" : "points";
    $("stars").textContent = "★".repeat(r.stars) + "☆".repeat(3 - r.stars);
    $("stars").setAttribute("aria-label", `${r.stars} of 3 stars`);
  }

  setHeading(eyebrow, title, mode, note = "") {
    $("piece-eyebrow").textContent = eyebrow;
    $("piece-title").textContent = title;
    $("piece-note").textContent = note;
    $("piece-note").classList.toggle("hidden", !note);
    document.title = `${mode} · Loom`;
  }
  setSelected(index) { this.selected = index; this.render(); }
  focusCursor() { this.cells[this.cursor]?.focus(); }
}
