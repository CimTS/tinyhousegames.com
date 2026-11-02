// Entry point: owns the current game state and UI state, wires input to rules.
import * as game from "./game.js";
import { dailySeed } from "./seed.js";
import { render } from "./render.js";
import { focusCursor } from "./render-board.js";
import { GUIDE } from "./render-overlays.js";
import { keyToCommand, moveCursor, resolveTap } from "./input.js";
import { ACTION_BY_ID } from "./actions.js";
import { icon } from "./icons.js";
import { getBestFloor, getDailyRecord } from "./storage.js";
import { bus } from "./events.js";
import { saveRun, loadRun, hasSave } from "./save.js";
import { createHistory, command, undo as popUndo, reset as resetHistory } from "./history.js";
import { startAudio } from "./audio/hooks.js";
import { bindAudioPanel } from "./render-audio.js";

const history = createHistory();

// Expose the bus so an audio engine or mod can subscribe without editing game code.
window.dronesweeperEvents = bus;

let shownDanger = -1;
bus.on("danger", ({ level }) => { shownDanger = level; document.documentElement.style.setProperty("--danger", String(level)); });
/** Sync tension after a jump in state (new run, resume, undo); the rules only emit on in-game changes. */
const setDanger = level => { if (level !== shownDanger) bus.emit("danger", { level }); };
let screenName = null;
/** Tell listeners (music) which screen is up: title, run, debrief or over. */
const setScreen = name => { if (name !== screenName) { screenName = name; bus.emit("screen", { name }); } };
document.addEventListener("click", event => {
  const button = event.target.closest?.("button");
  if (!button) return;
  const target = button.id || [...button.classList].find(c => c !== "selected") || "button";
  bus.emit("uiClick", { target, label: button.getAttribute("aria-label") || button.textContent.trim().slice(0, 40) });
}, true);

let state = game.createGame();
const sound = startAudio({ bus, boardSize: () => state.board.size });
const audioPanel = bindAudioPanel(sound, { onClose: () => update() });
const ui = {
  screen: "title", cursor: 0, keyboard: false, canUndo: false,
  guideOpen: false, guideIndex: 0, draftOpen: false, offer: [], hasSave: false,
  bestFloor: getBestFloor(), dailyRecord: null
};

function currentScreen() {
  if (ui.screen === "title") return "title";
  if (state.status === "playing") return "run";
  return state.status === "won" && !state.runComplete ? "debrief" : "over";
}

function update() {
  setScreen(currentScreen());
  ui.canUndo = Boolean(history.snap) && ui.screen === "game" && state.status === "playing";
  if (ui.screen === "game") saveRun(state);
  render(state, ui, handlers);
  if (ui.keyboard && ui.screen === "game" && !overlayOpen()) focusCursor(ui); }
const overlayOpen = () => ui.guideOpen || ui.draftOpen || ui.screen !== "game" || state.status !== "playing";

/** After a command, pick sensible defaults so the next tap just works. */
function settle() {
  const unit = game.getCurrentUnit(state);
  if (!unit || state.status !== "playing") return;
  if (unit.moved && unit.acted) {
    const next = state.units.find(u => u.alive && !(u.moved && u.acted));
    if (next) selectUnit(next.id);
    return;
  }
  const sel = ACTION_BY_ID[state.selectedAction];
  const usable = sel && unit.actions.includes(sel.id) && (sel.spends === "move" ? !unit.moved : !unit.acted);
  if (!usable) state.selectedAction = unit.acted ? "move" : "reveal";
}

function selectUnit(id) {
  game.selectUnit(state, id);
  const unit = game.getCurrentUnit(state);
  if (unit) ui.cursor = unit.pos;
  settle();
}

function perform(action, index) {
  const keep = state.selectedAction;
  command(history, state, action, () => {
    game.selectAction(state, action);
    game.performAction(state, index);
  });
  // A fallback Move should not overwrite the command the player had chosen.
  if (action !== keep && state.status === "playing") state.selectedAction = keep;
  settle();
}

const handlers = {
  tap(index) {
    if (state.status !== "playing") return;
    ui.cursor = index;
    const cmd = resolveTap(state, index);
    if (cmd.type === "unit") selectUnit(cmd.id);
    else if (cmd.type === "act") perform(cmd.action, cmd.index);
    update();
  },
  focusCell(index) { if (ui.cursor !== index) { ui.cursor = index; update(); } },
  unit(id) { selectUnit(id); update(); },
  action(id) {
    if (ACTION_BY_ID[id]?.target === false) perform(id, null);
    else game.selectAction(state, id);
    update();
  },
  pick(id) { pickUpgrade(id); },
  endTurn() {
    resetHistory(history);
    game.endTurn(state);
    const msg = state.message;
    selectUnit(state.activeUnit);
    state.message = msg;
    update();
  }
};

function undoLast() {
  const prev = popUndo(history);
  if (!prev) return;
  const action = state.selectedAction;
  state = prev;
  state.message = "Last command undone.";
  bus.emit("undo", { action });
  ui.cursor = game.getCurrentUnit(state)?.pos ?? ui.cursor;
  setDanger(game.dangerLevel(state));
  update();
}

function resumeRun() {
  const saved = loadRun();
  if (!saved) { ui.hasSave = false; update(); return; }
  state = saved;
  resetHistory(history);
  ui.screen = "game";
  ui.cursor = game.getCurrentUnit(state)?.pos ?? 0;
  setDanger(game.dangerLevel(state));
  update();
}

function startRun(options) {
  resetHistory(history);
  state = game.createGame(options);
  setDanger(game.dangerLevel(state));
  ui.screen = "game";
  ui.cursor = game.getCurrentUnit(state)?.pos ?? 0;
  let seen = false;
  try { seen = localStorage.getItem("dronesweeper_tutorial_seen") === "1"; } catch { /* storage optional */ }
  if (!seen) openGuide();
  update();
}

function showTitle() {
  ui.screen = "title";
  setDanger(0);
  ui.bestFloor = getBestFloor();
  ui.dailyRecord = getDailyRecord(dailySeed().date);
  ui.hasSave = hasSave();
  update();
  document.getElementById(ui.hasSave ? "resumeBtn" : "newRunBtn").focus();
}

function openGuide() { ui.guideOpen = true; ui.guideIndex = 0; update(); document.getElementById("guideNext").focus(); }
function closeGuide() {
  ui.guideOpen = false;
  try { localStorage.setItem("dronesweeper_tutorial_seen", "1"); } catch { /* storage optional */ }
  update();
}

function continueAfterResult() {
  if (state.status === "won" && !state.runComplete) {
    ui.offer = game.offerDraft(state);
    ui.draftOpen = true;
    update();
    document.querySelector("#draftChoices .upgrade")?.focus();
  } else startRun();
}

function pickUpgrade(id) {
  if (!ui.draftOpen) return;
  state = game.continueAfterResult(state, id);
  resetHistory(history);
  ui.draftOpen = false;
  ui.offer = [];
  ui.cursor = game.getCurrentUnit(state)?.pos ?? 0;
  setDanger(game.dangerLevel(state));
  update();
}

// ---------- Static buttons ----------
const on = (id, fn) => document.getElementById(id).addEventListener("click", fn);
document.getElementById("undoBtn").append(icon("undo"));
document.getElementById("helpBtn").append(icon("help"));
on("newRunBtn", () => startRun());
on("resumeBtn", resumeRun);
on("undoBtn", undoLast);
on("dailyBtn", () => { const d = dailySeed(); startRun({ seed: d.seed, daily: true, date: d.date }); });
on("guideBtn", openGuide);
on("helpBtn", openGuide);
on("menuBtn", showTitle);
on("endTurnBtn", handlers.endTurn);
on("guideSkip", closeGuide);
on("guidePrev", () => { ui.guideIndex = Math.max(0, ui.guideIndex - 1); update(); });
on("guideNext", () => {
  if (ui.guideIndex >= GUIDE.length - 1) closeGuide();
  else { ui.guideIndex++; update(); }
});
on("resultContinue", continueAfterResult);
on("resultMenu", showTitle);

// ---------- Keyboard ----------
document.addEventListener("pointerdown", () => { if (ui.keyboard) { ui.keyboard = false; update(); } });
document.addEventListener("keydown", event => {
  const onSlider = event.target instanceof HTMLInputElement && event.target.type === "range";
  if (onSlider && /^(Arrow|Home|End|Page)/.test(event.key)) return; // sliders own their arrow keys
  if (audioPanel.isOpen) { if (event.key === "Escape") audioPanel.close(); else if (event.key.toLowerCase() === "m") audioPanel.toggleMute(); return; }
  if (keyToCommand(event)?.type === "mute") { audioPanel.toggleMute(); return; }
  if (event.key === "Escape" && ui.guideOpen) { closeGuide(); return; }
  if (ui.guideOpen) {
    if (event.key === "ArrowRight") document.getElementById("guideNext").click();
    if (event.key === "ArrowLeft") document.getElementById("guidePrev").click();
    return;
  }
  if (ui.draftOpen && /^[1-3]$/.test(event.key)) { const up = ui.offer[Number(event.key) - 1]; if (up) pickUpgrade(up.id); return; }
  if (ui.screen !== "game" || overlayOpen()) {
    if (event.key === "?" ) openGuide();
    return;
  }
  const cmd = keyToCommand(event);
  if (!cmd) return;
  // Let Enter/Space activate a focused button that is not a board cell.
  const onButton = event.target instanceof HTMLButtonElement && !event.target.classList.contains("cell");
  if (cmd.type === "confirm" && onButton) return;
  event.preventDefault();
  ui.keyboard = true;
  const size = state.board.size;
  switch (cmd.type) {
    case "cursor": ui.cursor = moveCursor(ui.cursor, cmd.dx, cmd.dy, size); break;
    case "cycleUnit": {
      const alive = state.units.filter(u => u.alive);
      const i = alive.findIndex(u => u.id === state.activeUnit);
      selectUnit(alive[(i + cmd.dir + alive.length) % alive.length].id);
      break;
    }
    case "confirm": handlers.tap(ui.cursor); return;
    case "action": {
      const unit = game.getCurrentUnit(state);
      if (unit?.actions.includes(cmd.id)) handlers.action(cmd.id);
      return;
    }
    case "endTurn": handlers.endTurn(); return;
    case "help": openGuide(); return;
    case "undo": undoLast(); return;
  }
  update();
});

showTitle();

// Offline play and install: only over http(s); file:// has no service workers.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
