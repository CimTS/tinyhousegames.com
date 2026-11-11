// Sheets and menus: opening/closing with focus handling, plus the content
// of the campaign list, gallery, dye picker and finish card.
import { patternSvg, tileSvg, svgEl } from "./art.js";
import { CARD_INFO, CARD_HELP, exampleCells, progressWords } from "./patterns.js";
import { LEVELS, isLevelUnlocked } from "./campaign.js";
import { PALETTES, isPaletteUnlocked, unlockText } from "./palettes.js";
import { GameState } from "./state.js";
import { squareAt } from "./audio.js";

const $ = id => document.getElementById(id);
const OVERLAYS = ["welcome", "campaign-sheet", "settings-sheet", "gallery-sheet", "viewer-sheet", "finish-sheet", "pattern-sheet"];
let opener = null;

export const isOpen = id => !$(id).classList.contains("hidden");
export const anyOpen = () => OVERLAYS.find(isOpen) || null;

// While an overlay is open the game behind it is inert, so focus and
// screen readers stay inside the dialog.
function syncInert() { $("app").inert = Boolean(anyOpen()); }

export function openSheet(id) {
  if (!anyOpen()) opener = document.activeElement;
  OVERLAYS.filter(o => o !== id).forEach(o => $(o).classList.add("hidden"));
  $(id).classList.remove("hidden");
  syncInert();
  const first = $(id).querySelector("button:not(:disabled):not(.hidden), select, input");
  first?.focus({ preventScroll: true });
}

export function closeSheets() {
  OVERLAYS.forEach(o => $(o).classList.add("hidden"));
  syncInert();
  if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  opener = null;
  // Lets the game react when the last sheet closes (stop a tune, or reopen the menu).
  document.dispatchEvent(new CustomEvent("loom:sheets-closed"));
}

export function bindSheetDismissal() {
  document.querySelectorAll(".close-sheet").forEach(b => b.addEventListener("click", closeSheets));
  document.querySelectorAll(".sheet-backdrop").forEach(el => el.addEventListener("click", e => {
    if (e.target === el && el.id !== "finish-sheet") closeSheets();
  }));
}

const stat = (label, value) => {
  const d = document.createElement("div");
  const dt = document.createElement("dt"), dd = document.createElement("dd");
  dt.textContent = label; dd.textContent = String(value);
  d.append(dt, dd);
  return d;
};

export function renderLevels(progress, onPick) {
  const cleared = progress.campaign.cleared;
  const items = LEVELS.map((level, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    const done = cleared.includes(level.id), open = isLevelUnlocked(i, cleared);
    b.className = "level" + (done ? " cleared" : "");
    b.disabled = !open;
    b.innerHTML = `<span class="level-num" aria-hidden="true">${done ? "✓" : i + 1}</span><span><strong></strong><small></small></span><span class="level-state"></span>`;
    b.querySelector("strong").textContent = level.title;
    b.querySelector("small").textContent = level.note;
    b.querySelector(".level-state").textContent = done ? "Cleared" : open ? "Play" : "Locked";
    b.setAttribute("aria-label", `Level ${i + 1}, ${level.title}. ${level.note} ${done ? "Cleared." : open ? "" : "Locked: clear the level before it."}`);
    b.addEventListener("click", () => onPick(level));
    li.append(b);
    return li;
  });
  $("level-list").replaceChildren(...items);
  $("campaign-progress").textContent = `${cleared.length} of ${LEVELS.length} cleared`;
}

export function renderDyes(progress, onPick) {
  const items = PALETTES.map(p => {
    const open = isPaletteUnlocked(p, progress), chosen = progress.palette === p.id;
    const b = document.createElement("button");
    b.type = "button"; b.className = "dye"; b.disabled = !open;
    b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(chosen));
    const sw = document.createElement("span");
    sw.className = "dye-swatches"; sw.setAttribute("aria-hidden", "true");
    p.colors.forEach(c => { const i = document.createElement("i"); i.style.background = c.hex; sw.append(i); });
    const words = document.createElement("span");
    words.innerHTML = "<strong></strong><small></small>";
    words.querySelector("strong").textContent = p.name;
    words.querySelector("small").textContent = open ? p.colors.map(c => c.name).join(", ") : unlockText(p);
    const state = document.createElement("span");
    state.className = "dye-state";
    state.textContent = chosen ? "In use" : open ? "" : "Locked";
    b.append(sw, words, state);
    b.addEventListener("click", () => onPick(p.id));
    return b;
  });
  $("dye-list").replaceChildren(...items);
}

// `onView(item, title, cells)` is called when a piece is chosen to look at and listen to.
export function renderGallery(progress, items, onView = null) {
  const s = progress.stats;
  $("lifetime-stats").replaceChildren(
    stat("Pieces woven", s.pieces), stat("Threads woven", s.threads),
    stat("Perfect patterns", s.perfect), stat("Tapestry threads", s.braids),
    stat("Daily pieces", progress.dailies.length), stat("Levels cleared", progress.campaign.cleared.length));
  const host = $("gallery-items");
  if (!items.length) {
    const p = document.createElement("p");
    p.className = "empty-gallery";
    p.textContent = "Your finished pieces will hang here.";
    host.replaceChildren(p);
    return;
  }
  host.replaceChildren(...items.map((item, i) => {
    const box = document.createElement("figure");
    box.className = "gallery-item"; box.style.margin = "0";
    const cells = item.cells || replayCells(item);
    const title = item.title || `Piece ${items.length - i}`;
    box.append(patternSvg(cells));
    const t = document.createElement("strong");
    t.textContent = title;
    const m = document.createElement("small");
    m.textContent = `${item.score} ${item.score === 1 ? "point" : "points"} · ${"★".repeat(item.stars)}${"☆".repeat(3 - item.stars)}`;
    box.append(t, m);
    if (onView) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "quiet-button gallery-view"; b.textContent = "View and listen";
      b.setAttribute("aria-label", `View and listen to ${title}`);
      b.addEventListener("click", () => onView(item, title, cells));
      box.append(b);
    }
    return box;
  }));
}

// One gallery piece, shown large. The game plays its tune and lights the cloth.
// `quiet` shows a line explaining that sound is off.
export function renderPiece({ title, cells, score, stars, studio, quiet }) {
  $("viewer-title").textContent = title;
  $("viewer-art").replaceChildren(patternSvg(cells, { lights: true }));
  $("viewer-score").textContent = String(score);
  $("viewer-unit").textContent = score === 1 ? "point" : "points";
  $("viewer-stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  $("viewer-stars").setAttribute("aria-label", `${stars} of 3 stars`);
  $("viewer-quiet").classList.toggle("hidden", !quiet);
  $("viewer-studio").classList.toggle("hidden", !studio);
  openSheet("viewer-sheet");
}

// Older gallery entries stored only moves; rebuild their cells by replay.
export function replayCells(item) {
  const s = new GameState(item.seed, null, { silent: true });
  for (const m of item.moves) {
    if (!m) continue;   // a damaged entry: skip the move instead of failing the whole gallery
    m.type === "place" ? s.place(m.index) : s.merge(m.from, m.to);
  }
  return s.data.cells;
}

export function renderFinish({ cells, result, stats, title, eyebrow, unlockedNames, nextLabel, animate }) {
  $("finish-eyebrow").textContent = eyebrow;
  $("finish-title").textContent = title;
  $("finish-art").replaceChildren(patternSvg(cells, { animate, lights: true }));
  $("finish-score").textContent = String(result.score);
  $("finish-unit").textContent = result.score === 1 ? "point" : "points";
  $("finish-stars").textContent = "★".repeat(result.stars) + "☆".repeat(3 - result.stars);
  $("finish-stars").setAttribute("aria-label", `${result.stars} of 3 stars`);
  $("finish-stats").replaceChildren(
    stat("Threads woven", stats.threadsWoven), stat("Merges", stats.merges),
    stat("Patterns", `${stats.cardsDone} of ${stats.cardCount}`), stat("Tapestry threads", stats.braids));
  const note = $("finish-unlock");
  note.classList.toggle("hidden", !unlockedNames.length);
  note.textContent = unlockedNames.length ? `New dye unlocked: ${unlockedNames.join(", ")}. Choose it in Settings.` : "";
  $("finish-next").textContent = nextLabel;
  openSheet("finish-sheet");
}

// The finished piece plays itself, and the cloth shows where the tune is: each square
// lights while its note sounds. `tune` comes from LoomAudio#finish; `clock` returns the
// audio clock, so the lights stay with the sound even if the page is slowed down.
let lightsFrame = 0;
export function stopTuneLights() {
  cancelAnimationFrame(lightsFrame);
  document.querySelectorAll(".tune-light.lit").forEach(el => el.classList.remove("lit"));
}
export function lightTune(tune, clock, host = "finish-art") {
  stopTuneLights();
  const svg = $(host).querySelector("svg");
  if (!tune || !svg) return;
  const lights = new Map([...svg.querySelectorAll(".tune-light")].map(el => [Number(el.dataset.index), el]));
  let lit = null;
  const tick = () => {
    if (!svg.isConnected) return;
    const t = clock() - tune.start, now = squareAt(tune, t);
    if (now !== lit) {
      lights.get(lit)?.classList.remove("lit");
      lights.get(now)?.classList.add("lit");
      lit = now;
    }
    if (t < tune.length) lightsFrame = requestAnimationFrame(tick);
  };
  lightsFrame = requestAnimationFrame(tick);
}

// A tiny loom showing one correct way to make a pattern.
function exampleLoom(type) {
  const svg = svgEl("svg", { viewBox: "0 0 104 104", class: "example-loom", "aria-hidden": "true" });
  svg.append(svgEl("rect", { x: 0, y: 0, width: 104, height: 104, rx: 9, class: "example-bed" }));
  exampleCells(type).forEach((tile, i) => {
    const x = 4 + (i % 5) * 19.6, y = 4 + Math.floor(i / 5) * 19.6;
    if (tile) {
      const t = tileSvg(tile, false);
      Object.entries({ x, y, width: 18, height: 18 }).forEach(([k, v]) => t.setAttribute(k, v));
      svg.append(t);
    } else svg.append(svgEl("rect", { x: x + .5, y: y + .5, width: 17, height: 17, rx: 3.5, class: "example-empty" }));
  });
  return svg;
}

// items: [{ card, progress, target, done }]. One item for a tapped card,
// or all of the piece's cards for the heading.
export function renderPatternHelp(items) {
  $("pattern-title").textContent = items.length === 1 ? CARD_INFO[items[0].card][0] : "Patterns to weave";
  $("pattern-help").replaceChildren(...items.map(item => {
    const help = CARD_HELP[item.card];
    const box = document.createElement("article");
    box.className = "pattern-explain" + (item.done ? " done" : "");
    const words = document.createElement("div");
    words.className = "explain-words";
    const how = document.createElement("p"); how.className = "how"; how.textContent = help.how;
    words.append(how);
    if (!help.anyColor && item.card !== "rainbow") {
      const note = document.createElement("p"); note.className = "aside";
      note.textContent = "Any weave counts. Only the color matters.";
      words.append(note);
    }
    const prog = document.createElement("p"); prog.className = "where";
    prog.textContent = progressWords(item);
    words.append(prog);
    if (items.length > 1) { const h = document.createElement("h3"); h.textContent = CARD_INFO[item.card][0]; box.append(h); }
    box.append(exampleLoom(item.card), words);
    return box;
  }));
  openSheet("pattern-sheet");
}

export { svgEl };
