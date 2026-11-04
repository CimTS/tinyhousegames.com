// Wires the game together: starting pieces, input, sound, saving and menus.
import { GameState } from "./state.js";
import { Renderer } from "./render.js";
import { LoomAudio } from "./audio.js";
import { Settings } from "./settings.js";
import { storage } from "./storage.js";
import { Tutorial } from "./tutorial.js";
import { dailySeed, encodeShare, encodeStudio, decodeShare } from "./rng.js";
import { canMerge } from "./rules.js";
import { moveCursor, keyAction } from "./keys.js";
import { installDefs, setPalette, colorName } from "./art.js";
import { LEVELS, levelPiece, levelById, levelCleared } from "./campaign.js";
import { paletteById, isPaletteUnlocked } from "./palettes.js";
import { defaultProgress, recordFinish } from "./progress.js";
import * as ui from "./ui.js";
import { VERSION } from "./version.js";
import { Studio } from "./studio.js";
import { studioPiece } from "./studio-state.js";

const $ = id => document.getElementById(id);
const today = dailySeed();
const audio = new LoomAudio({});
const settings = new Settings(audio);
const announce = text => { $("live-region").textContent = ""; requestAnimationFrame(() => { $("live-region").textContent = text; }); };
const where = i => `row ${Math.floor(i / 5) + 1}, column ${i % 5 + 1}`;

let progress = { ...defaultProgress(), ...storage.getProgress(defaultProgress()) };
const saveProgress = () => storage.saveProgress(progress);
const applyPalette = () => {
  const p = paletteById(progress.palette);
  setPalette(isPaletteUnlocked(p, progress) ? p : paletteById());
};

installDefs();
applyPalette();
const renderer = new Renderer();
const game = {
  state: null, renderer, finishedShown: false, replaying: false,

  start(piece, { replay = false, silent = false } = {}) {
    if (this.tutorial.active && piece.mode !== "tutorial") this.tutorial.stop();
    this.state = new GameState(piece.seed, piece, { silent: replay || silent || piece.mode === "tutorial" });
    this.replaying = replay;
    this.finishedShown = false;
    this.state.subscribe(() => this.afterChange());
    renderer.attach(this.state);
    this.studio.sync();
    this.heading();
    this.state.persist();
    ui.closeSheets();
    unlockAudio();
    if (this.state.data.finished) this.showFinish(false);
  },

  heading() {
    const d = this.state.data;
    if (d.mode === "campaign") {
      const i = LEVELS.findIndex(l => l.id === d.level), l = LEVELS[i];
      renderer.setHeading(`Campaign · Level ${i + 1} of ${LEVELS.length}`, l.title, "Campaign", l.note);
    } else if (d.mode === "daily") renderer.setHeading("Today's piece", "A little room to weave", "Today's piece");
    else if (d.mode === "studio") renderer.setHeading("Studio", "Weave anything", "Studio");
    else if (d.mode === "tutorial") renderer.setHeading("How to play", "Learning the loom", "How to play");
    else renderer.setHeading("Zen weaving", "No goal but the cloth", "Zen weaving");
  },

  afterChange() {
    renderer.render();
    if (renderer.newlyDone?.length) { audio.card(); announce(`Pattern complete: ${renderer.newlyDone.join(", ")}.`); }
    if (this.state.data.finished && !this.finishedShown && this.state.data.mode !== "tutorial") {
      this.finishedShown = true;
      const calm = settings.value.calm || matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(() => this.showFinish(true), calm ? 0 : 700);
    }
  },

  placeAt(index) {
    const tile = { ...this.state.data.queue[0] };
    renderer.flash = { type: "place", index };
    renderer.selected = null;
    if (!this.state.place(index)) { renderer.flash = null; return false; }
    audio.place(tile);
    announce(`${colorName(tile.c)} placed at ${where(index)}.`);
    return true;
  },

  select(index) {
    const tile = this.state.data.cells[index];
    renderer.setSelected(index);
    announce(`${colorName(tile.c)}, tier ${tile.t} picked up. Choose a matching neighbor.`);
    audio.tap();
  },

  mergeInto(index) {
    const from = renderer.selected, cells = this.state.data.cells;
    const source = { ...cells[from] }, target = { ...cells[index] };
    renderer.flash = { type: "merge", index };
    renderer.selected = null;
    if (!this.state.merge(from, index)) { renderer.flash = null; return false; }
    audio.merge(source, target, { c: target.c, t: target.t + 1 });
    if (settings.value.haptics && navigator.vibrate) navigator.vibrate(12);
    announce(`Woven: ${colorName(target.c)} is now tier ${target.t + 1}, at ${where(index)}.`);
    return true;
  },

  // One predictable rule set: empty square → place; thread → pick up;
  // matching neighbor of the picked-up thread → weave there; same thread → put down.
  handleCell(index) {
    if (!this.state || this.replaying || this.state.data.finished) return;
    if (this.tutorial.active) { this.tutorial.handleCell(index); return; }
    if (this.studio.active()) { this.studio.handleCell(index); return; }
    const sel = renderer.selected, tile = this.state.data.cells[index];
    if (!tile) { this.placeAt(index); return; }
    if (sel === index) { renderer.setSelected(null); announce("Put down."); return; }
    if (sel !== null && canMerge(this.state.data.cells, sel, index)) { this.mergeInto(index); return; }
    this.select(index);
  },

  undo() {
    if (!this.state || this.tutorial.active) return;
    const last = this.state.data.moves.at(-1);
    if (this.state.undo()) {
      renderer.selected = null;
      renderer.render();
      audio.undo(last?.type === "place" ? last.tile : last?.target);
      announce("Last move undone.");
    }
  },

  showFinish(animate) {
    const s = this.state, d = s.data, stats = s.stats();
    let title = "A pattern, made by you", eyebrow = "Piece complete", next = "Weave another", unlockedNames = [];
    if (d.mode === "campaign") {
      const level = levelById(d.level), cleared = levelCleared(level, s.result);
      const idx = LEVELS.indexOf(level);
      eyebrow = `Level ${idx + 1} · ${level.title}`;
      title = cleared ? "Level cleared" : "A lovely piece, all the same";
      next = cleared ? (LEVELS[idx + 1] ? "Next level" : "Back to the campaign") : "Try this level again";
      this.nextAction = () => cleared && LEVELS[idx + 1] ? this.start(levelPiece(LEVELS[idx + 1])) :
        cleared ? ui.openSheet("campaign-sheet") : this.start(levelPiece(level));
    } else {
      this.nextAction = () => this.start({ ...newZen() });
    }
    if (!this.replaying && !this.recorded?.has(d.seed + d.moves.length)) {
      (this.recorded ||= new Set()).add(d.seed + d.moves.length);
      const r = recordFinish(progress, {
        mode: d.mode, seed: d.seed, levelId: d.level, stats,
        cleared: d.mode === "campaign" && levelCleared(levelById(d.level), s.result)
      });
      progress = r.progress; saveProgress();
      unlockedNames = r.unlocked.map(id => paletteById(id).name);
      refreshMenus();
    }
    if (this.replaying) { eyebrow = "A shared piece"; title = "Woven by a friend"; next = "Weave my own"; this.nextAction = () => { history.replaceState(null, "", location.pathname); this.start(dailyPiece()); }; }
    audio.finish();
    ui.renderFinish({ cells: d.cells, result: s.result, stats, title, eyebrow, unlockedNames, nextLabel: next, animate });
    announce(`${title}. ${s.result.score} points. ${stats.cardsDone} of ${stats.cardCount} patterns.`);
  },

  finishTutorial() { this.start(dailyPiece()); }
};
game.tutorial = new Tutorial(game);
game.studio = new Studio(game, { announce, buzz: () => settings.value.haptics && navigator.vibrate?.(12) });
renderer.onCell = i => game.handleCell(i);
renderer.onCard = card => {
  if (!game.state) return;
  const items = game.state.progress.filter(p => card === null || p.card === card);
  ui.renderPatternHelp(items);
};

const newZen = () => ({ ...new GameState(`free-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, null, { silent: true }).data });
function dailyPiece() {
  const saved = storage.getDaily(today);
  if (saved && !saved.finished) return saved;
  return new GameState(today, null, { silent: true }).data;
}
function tutorialPiece() {
  const d = new GameState("tutorial", null, { silent: true }).data;
  return { ...d, mode: "tutorial", cells: Array(25).fill(null), queue: [{ c: 1, t: 1 }, { c: 1, t: 1 }, { c: 3, t: 1 }], cards: ["rainbow", "cluster"] };
}

let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  audio.unlock().then(() => { if (settings.value.ambient) audio.startAmbient(); }).catch(() => {});
}

function refreshMenus() {
  ui.renderLevels(progress, level => game.start(levelPiece(level)));
  ui.renderDyes(progress, id => { progress.palette = id; saveProgress(); applyPalette(); refreshMenus(); if (game.state) { renderer.attach(game.state); game.studio.sync(); } });
  const run = storage.getRun();
  $("continue-button").classList.toggle("hidden", !(run && !run.finished));
  // First visit: put the lesson right under the main button.
  const first = progress.stats.pieces === 0 && !run;
  if (first) $("begin-button").after($("tutorial-button"));
  else $("gallery-open").after($("tutorial-button"));
  const n = storage.getGallery().length;
  $("gallery-count").textContent = n ? `${n} finished ${n === 1 ? "piece" : "pieces"}` : "Your finished pieces";
}

function openMenu() {
  refreshMenus();
  $("welcome-close").classList.toggle("hidden", !game.state);
  $("welcome-title").textContent = game.state ? "Menu" : "Come sit at the loom";
  ui.openSheet("welcome");
}

function share() {
  const d = game.state?.data;
  if (!d) return;
  if (d.mode === "campaign" || d.mode === "tutorial") { announce("Sharing works for daily and Zen pieces."); return; }
  const hash = d.mode === "studio" ? encodeStudio(d.cells) : encodeShare(d.seed, d.moves);
  const url = `${location.href.split("#")[0]}${hash}`;
  if (navigator.share) navigator.share({ title: "My Loom piece", url }).catch(() => {});
  else navigator.clipboard?.writeText(url).then(() => announce("Link copied.")).catch(() => {});
}

// --- wiring -----------------------------------------------------------
const guard = fn => () => {
  try { fn(); } catch (err) {
    console.error("Loom:", err);
    $("welcome-error").textContent = "Something went wrong opening that piece. Please try again.";
  }
};
$("begin-button").addEventListener("click", guard(() => game.start(dailyPiece())));
$("continue-button").addEventListener("click", guard(() => game.start(storage.getRun())));
$("zen-button").addEventListener("click", guard(() => game.start(newZen())));
$("studio-button").addEventListener("click", guard(() => game.studio.open()));
$("studio-share").addEventListener("click", share);
$("tutorial-button").addEventListener("click", guard(() => { game.start(tutorialPiece()); game.tutorial.start(); }));
$("campaign-button").addEventListener("click", () => { refreshMenus(); ui.openSheet("campaign-sheet"); });
$("gallery-open").addEventListener("click", () => { ui.renderGallery(progress, storage.getGallery(), item => game.studio.openPiece(item)); ui.openSheet("gallery-sheet"); });
$("welcome-close").addEventListener("click", ui.closeSheets);
$("pattern-ok").addEventListener("click", ui.closeSheets);
$("menu-open").addEventListener("click", openMenu);
$("finish-menu").addEventListener("click", openMenu);
$("finish-next").addEventListener("click", () => game.nextAction?.());
$("finish-share").addEventListener("click", share);
$("undo-button").addEventListener("click", () => game.undo());
$("settings-open").addEventListener("click", () => { refreshMenus(); ui.openSheet("settings-sheet"); });
$("tutorial-next").addEventListener("click", () => game.tutorial.advance());
$("tutorial-skip").addEventListener("click", () => { game.tutorial.stop(); game.start(dailyPiece()); });
$("reset-progress").addEventListener("click", () => {
  if (confirm("Erase settings, saved pieces, campaign progress, dyes and the gallery on this device?")) { storage.reset(); location.reload(); }
});
ui.bindSheetDismissal();
$("version-label").textContent = `Loom version ${VERSION}`;

const syncSoundButton = () => {
  const on = settings.value.sound;
  $("sound-toggle").classList.toggle("sound-off", !on);
  $("sound-toggle").setAttribute("aria-pressed", String(on));
  $("sound-toggle").setAttribute("aria-label", on ? "Sound is on. Turn sound off" : "Sound is off. Turn sound on");
};
$("sound-toggle").addEventListener("click", () => { settings.value.sound = !settings.value.sound; settings.save("sound"); });
settings.onChange((key, value) => {
  if (key === "sound") { syncSoundButton(); audio.mute(!value); if (value && settings.value.ambient) audio.startAmbient(); }
  if (key === "ambient") value ? audio.startAmbient() : audio.stopAmbient();
});
settings.bind();
syncSoundButton();

document.addEventListener("keydown", e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const action = keyAction(e.key);
  if (action === "settings") {
    const open = ui.anyOpen();
    if (open && (open !== "welcome" || game.state)) ui.closeSheets();
    else if (!ui.anyOpen()) { refreshMenus(); ui.openSheet("settings-sheet"); }
    return;
  }
  if (ui.anyOpen() || !game.state) return;
  const tag = document.activeElement?.tagName;
  const onBoard = document.activeElement?.classList.contains("cell");
  if (onBoard) renderer.cursor = Number(document.activeElement.dataset.index);
  const moved = moveCursor(renderer.cursor, e.key);
  if (moved !== null && (onBoard || tag === "BODY")) { e.preventDefault(); renderer.cursor = moved; renderer.focusCursor(); return; }
  if (action === "undo") { game.undo(); return; }
  if (action === "select" && onBoard) { e.preventDefault(); game.handleCell(renderer.cursor); }
});

// Opening a share link shows that finished piece without touching progress.
const shared = decodeShare(location.hash);
refreshMenus();
// A shared studio grid opens as a canvas to remix; it never replaces your own.
if (shared?.studio) game.start(studioPiece(shared.cells), { silent: true });
else if (shared) {
  const s = new GameState(shared.seed, null, { silent: true });
  for (const m of shared.moves) m.type === "place" ? s.place(m.index) : s.merge(m.from, m.to);
  s.data.undo = [];
  game.start(s.data, { replay: true });
}

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
