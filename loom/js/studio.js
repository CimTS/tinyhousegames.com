// Studio screen: the thread palette, tools, tap rules and drag-and-drop for
// the free-placement canvas. The rules themselves live in studio-state.js.
import { tileSvg, colorName } from "./art.js";
import { makePiece } from "./board.js";
import { storage } from "./storage.js";
import { anyOpen } from "./ui.js";
import { isStudio, setCell, moveCell, clearCell, studioPiece, newStudioSeed } from "./studio-state.js";

const $ = id => document.getElementById(id);
const where = i => `row ${Math.floor(i / 5) + 1}, column ${i % 5 + 1}`;
const cellAt = (x, y) => {
  const el = document.elementFromPoint(x, y)?.closest?.(".cell");
  return el && $("board").contains(el) ? Number(el.dataset.index) : null;
};
const insideLoom = (x, y) => {
  const r = document.querySelector(".loom-frame").getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};

export class Studio {
  constructor(game, { announce, buzz }) {
    this.game = game; this.announce = announce; this.buzz = buzz;
    this.brush = { c: 0, t: 1 }; this.eraser = false; this.drag = null; this.quietUntil = 0;
    this.bind();
  }
  get state() { return this.game.state; }
  active() { return isStudio(this.state); }

  // After every start or dye change: show the studio panel and redraw swatches.
  sync() {
    this.cancel();
    $("app").classList.toggle("studio", this.active());
    if (this.active()) this.buildPalette();
  }

  open(fresh = false) {
    const saved = fresh ? null : storage.getStudio();
    const ok = saved?.mode === "studio" && Array.isArray(saved.cells) && saved.cells.length === 25;
    this.eraser = false;
    this.game.start(ok ? saved : makePiece(newStudioSeed()));
    this.announce("Studio open. Weave any thread anywhere, and drag threads to move them.");
  }

  openPiece(item) {
    const now = storage.getStudio();
    if (now && now.seed !== item.seed && now.cells?.some(Boolean) &&
      !confirm("Open this piece in the studio? Your current canvas will be replaced. Save it to the gallery first to keep it.")) return;
    this.eraser = false;
    this.game.start(studioPiece(item.cells, item.seed, item.cards));
  }

  // Empty square: weave the brush thread. Thread: pick it up, then any square
  // moves it there (a thread there swaps). With the eraser on, a tap lifts.
  handleCell(index) {
    if (performance.now() < this.quietUntil) return;
    const r = this.game.renderer, cells = this.state.data.cells, tile = cells[index], sel = r.selected;
    if (sel !== null) {
      const moving = cells[sel];
      r.selected = null;
      if (index !== sel && moveCell(this.state, sel, index)) this.announce(`${colorName(moving.c)} moved to ${where(index)}${tile ? ", swapping places" : ""}.`);
      else { r.render(); this.announce("Put down."); }
      return;
    }
    if (this.eraser) {
      if (tile && clearCell(this.state, index)) this.announce(`Thread lifted from ${where(index)}.`);
      return;
    }
    if (tile) { r.setSelected(index); this.announce(`${colorName(tile.c)}, tier ${tile.t} picked up. Choose any square to move it there.`); return; }
    if (setCell(this.state, index, this.brush)) this.announce(`${colorName(this.brush.c)}, tier ${this.brush.t} woven at ${where(index)}.`);
  }

  buildPalette() {
    const swatches = [];
    for (let t = 1; t <= 3; t++) for (let c = 0; c < 5; c++) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "swatch"; b.dataset.c = c; b.dataset.t = t;
      b.setAttribute("aria-label", `${colorName(c)}, tier ${t}`);
      b.append(tileSvg({ c, t }, false));
      b.addEventListener("click", () => { if (performance.now() >= this.quietUntil) this.choose({ c, t }); });
      b.addEventListener("pointerdown", e => this.press(e, { kind: "palette", tile: { c, t } }));
      swatches.push(b);
    }
    $("studio-palette").replaceChildren(...swatches);
    this.syncTools();
  }

  syncTools() {
    document.querySelectorAll("#studio-palette .swatch").forEach(b => {
      const on = !this.eraser && Number(b.dataset.c) === this.brush.c && Number(b.dataset.t) === this.brush.t;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    $("studio-eraser").setAttribute("aria-pressed", String(this.eraser));
    $("studio-brush").textContent = this.eraser ? "Eraser" : `${colorName(this.brush.c)} · tier ${this.brush.t}`;
  }

  choose(tile) {
    this.brush = { ...tile }; this.eraser = false; this.syncTools();
    this.announce(`${colorName(tile.c)}, tier ${tile.t} on the shuttle.`);
  }

  save() {
    const s = this.state, d = s.data;
    if (!d.cells.some(Boolean)) { this.announce("Weave a few threads before saving."); return; }
    storage.addGallery({
      seed: d.seed, mode: "studio", studio: true, title: "Studio piece", moves: [],
      cells: d.cells.map(x => x ? { ...x } : null), score: s.result.score, stars: s.result.stars,
      cards: d.cards, completedAt: new Date().toISOString()
    });
    this.announce("Saved to your gallery.");
    const b = $("studio-save");
    b.textContent = "Saved ✓";
    setTimeout(() => { b.textContent = "Save to gallery"; }, 1600);
  }

  // --- drag and drop (mouse, touch and pen) ------------------------------
  press(e, source) {
    if (!this.active() || this.drag || this.game.tutorial.active) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    this.drag = { ...source, id: e.pointerId, x0: e.clientX, y0: e.clientY, live: false, ghost: null, over: null, size: 56 };
  }

  lift() {
    const d = this.drag, r = this.game.renderer;
    d.live = true;
    if (r.selected !== null) r.setSelected(null);
    d.size = Math.max(40, r.cells[0].getBoundingClientRect().width);
    d.ghost = document.createElement("div");
    d.ghost.className = "drag-ghost";
    d.ghost.style.width = d.ghost.style.height = `${d.size}px`;
    d.ghost.append(tileSvg(d.tile, false));
    document.body.append(d.ghost);
    if (d.kind === "cell") r.cells[d.index].classList.add("drag-origin");
    document.body.classList.add("is-dragging");
  }

  follow(x, y) {
    const d = this.drag, cells = this.game.renderer.cells, over = cellAt(x, y);
    d.ghost.style.transform = `translate(${x - d.size / 2}px, ${y - d.size / 2}px)`;
    if (over !== d.over) {
      if (d.over !== null) cells[d.over].classList.remove("drop-target");
      d.over = over;
      if (over !== null && !(d.kind === "cell" && over === d.index)) cells[over].classList.add("drop-target");
    }
    d.ghost.classList.toggle("will-remove", d.kind === "cell" && !insideLoom(x, y));
  }

  cleanup(d) {
    d.ghost?.remove();
    document.querySelectorAll(".drop-target, .drag-origin").forEach(el => el.classList.remove("drop-target", "drag-origin"));
    document.body.classList.remove("is-dragging");
    this.quietUntil = performance.now() + 350;   // swallow the click that ends a drag
  }

  cancel() { const d = this.drag; this.drag = null; if (d?.live) this.cleanup(d); }

  release(e, cancelled) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    if (!d.live) return;   // a tap: the click handler takes it from here
    this.cleanup(d);
    if (cancelled || !this.active()) return;
    const to = cellAt(e.clientX, e.clientY), name = colorName(d.tile.c);
    if (d.kind === "cell") {
      const swap = to !== null && this.state.data.cells[to];
      if (to !== null && to !== d.index && moveCell(this.state, d.index, to)) { this.buzz(); this.announce(`${name} moved to ${where(to)}${swap ? ", swapping places" : ""}.`); }
      else if (to === null && !insideLoom(e.clientX, e.clientY) && clearCell(this.state, d.index)) this.announce("Thread lifted off the loom.");
    } else if (to !== null) {
      this.brush = { ...d.tile }; this.eraser = false; this.syncTools();
      if (setCell(this.state, to, d.tile)) { this.buzz(); this.announce(`${name}, tier ${d.tile.t} woven at ${where(to)}.`); }
    }
  }

  bind() {
    $("board").addEventListener("pointerdown", e => {
      const cell = this.active() && e.target.closest?.(".cell");
      if (!cell) return;
      const i = Number(cell.dataset.index), tile = this.state.data.cells[i];
      if (tile) this.press(e, { kind: "cell", index: i, tile: { ...tile } });
    });
    window.addEventListener("pointermove", e => {
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      if (!d.live) { if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return; this.lift(); }
      e.preventDefault();
      this.follow(e.clientX, e.clientY);
    }, { passive: false });
    window.addEventListener("pointerup", e => this.release(e, false));
    window.addEventListener("pointercancel", e => this.release(e, true));
    window.addEventListener("blur", () => this.cancel());
    $("studio-eraser").addEventListener("click", () => {
      this.eraser = !this.eraser; this.syncTools();
      this.announce(this.eraser ? "Eraser on. Tap a thread to lift it." : "Eraser off.");
    });
    $("studio-save").addEventListener("click", () => this.save());
    $("studio-new").addEventListener("click", () => {
      if (this.state.data.cells.some(Boolean) && !confirm("Start a blank canvas? Save this one to your gallery first if you want to keep it.")) return;
      this.open(true);
    });
    // Delete or Backspace lifts the focused thread.
    document.addEventListener("keydown", e => {
      if (!this.active() || anyOpen() || (e.key !== "Delete" && e.key !== "Backspace")) return;
      const el = document.activeElement;
      if (!el?.classList.contains("cell")) return;
      e.preventDefault();
      const i = Number(el.dataset.index);
      if (clearCell(this.state, i)) this.announce(`Thread lifted from ${where(i)}.`);
    });
  }
}
