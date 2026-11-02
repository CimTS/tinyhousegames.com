// Top-level renderer: HUD, squad, commands and the phone action bar.
// Board and overlays live in their own modules.
import { icon } from "./icons.js";
import { getCurrentUnit, FINAL_FLOOR } from "./game.js";
import { actionsFor, ACTION_BY_ID } from "./actions.js";
import { renderBoard } from "./render-board.js";
import { renderOverlays, upgradeChips } from "./render-overlays.js";

const $ = id => document.getElementById(id);
let lastDamageEvent = 0;

export function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

const pad = n => String(n).padStart(2, "0");

function pips(unit, perPip = "pip") {
  const wrap = make("span", `pips${unit.hp <= 1 ? " low" : ""}`);
  for (let i = 0; i < unit.maxHp; i++) wrap.append(make("i", `${perPip}${i < unit.hp && unit.alive ? " on" : ""}`));
  for (let i = 0; i < (unit.armor || 0); i++) wrap.append(make("i", `${perPip} armor`));
  wrap.setAttribute("aria-label", `${unit.alive ? unit.hp : 0} of ${unit.maxHp} HP${unit.armor ? `, ${unit.armor} armor` : ""}`);
  return wrap;
}

function badge(unit) {
  const b = make("span", "unit-badge");
  b.append(icon(unit.icon));
  return b;
}

function renderHud(state) {
  $("hudFloor").textContent = pad(state.floor);
  $("hudFinal").textContent = pad(FINAL_FLOOR);
  $("hudTurn").textContent = String(Math.min(state.turn, state.maxTurns));
  $("hudMaxTurn").textContent = String(state.maxTurns);
  $("hudThreats").textContent = String(state.board.cells.filter(c => c.threat && !c.cleared).length);
  const hp = state.units.reduce((s, u) => s + (u.alive ? u.hp : 0), 0);
  const max = state.units.reduce((s, u) => s + u.maxHp, 0);
  $("hudSquad").textContent = `${hp}/${max}`;
  const found = state.board.cells[state.board.exit]?.revealed;
  $("hudBeacon").textContent = found ? "Located" : "Unknown";
  $("hudBeacon").parentElement.classList.toggle("found", Boolean(found));
  $("modeBadge").hidden = !state.daily;
  $("modeBadge").textContent = state.daily ? `Daily ${state.date?.slice(5) ?? ""}` : "";
}

function renderSquad(state, handlers, hitId) {
  const active = getCurrentUnit(state);
  const cards = state.units.map(unit => {
    const card = make("button", `unit-card u-${unit.id}${active?.id === unit.id ? " active" : ""}${unit.alive ? "" : " offline"}${hitId === unit.id ? " fx-hit" : ""}`);
    card.type = "button";
    card.disabled = !unit.alive || state.status !== "playing";
    card.setAttribute("aria-pressed", String(active?.id === unit.id));
    const meta = make("span", "unit-meta");
    const name = make("span", "unit-name", unit.name);
    name.append(make("small", "", unit.alive ? unit.role : "Offline"));
    meta.append(name, pips(unit));
    const budget = make("span", "budget");
    for (const [label, used] of [["Move", unit.moved], ["Act", unit.acted]]) {
      const s = make("span", used ? "used" : "", label);
      s.title = `${label === "Move" ? "Move" : "Action"} ${used ? "used" : "ready"}`;
      budget.append(s);
    }
    card.append(badge(unit), meta, budget);
    card.addEventListener("click", () => handlers.unit(unit.id));
    return card;
  });
  $("squad").replaceChildren(...cards);

  const strip = $("squadStrip");
  strip.style.setProperty("--units", state.units.length);
  strip.replaceChildren(...state.units.map(unit => {
    const chip = make("button", `chip u-${unit.id}${active?.id === unit.id ? " active" : ""}${unit.alive ? "" : " offline"}${hitId === unit.id ? " fx-hit" : ""}`);
    chip.type = "button";
    chip.disabled = !unit.alive || state.status !== "playing";
    chip.setAttribute("aria-label", `${unit.name}, ${unit.hp} HP, move ${unit.moved ? "used" : "ready"}, action ${unit.acted ? "used" : "ready"}`);
    const body = make("span", "chip-body");
    const name = make("span", "chip-name", unit.name);
    const dots = make("span", "dots");
    dots.append(make("i", unit.moved ? "used" : ""), make("i", unit.acted ? "used" : ""));
    name.append(dots);
    body.append(name, pips(unit));
    chip.append(badge(unit), body);
    chip.addEventListener("click", () => handlers.unit(unit.id));
    return chip;
  }));
}

function commandEnabled(state, unit, a) {
  if (!unit || state.status !== "playing") return false;
  return a.spends === "move" ? !unit.moved : !unit.acted;
}

function renderCommands(state, handlers) {
  const unit = getCurrentUnit(state);
  const list = unit ? actionsFor(unit) : [];
  $("commandOwner").textContent = unit ? unit.name : "—";
  $("commands").replaceChildren(...list.map(a => {
    const b = make("button", `cmd${state.selectedAction === a.id ? " selected" : ""}`);
    b.type = "button";
    b.disabled = !commandEnabled(state, unit, a);
    b.title = a.desc;
    b.append(icon(a.id), document.createTextNode(a.label), make("kbd", "", a.key));
    b.addEventListener("click", () => handlers.action(a.id));
    return b;
  }));
  const sel = ACTION_BY_ID[state.selectedAction];
  $("commandHelp").textContent = sel ? sel.desc : "";
  $("barHelp").textContent = sel && unit ? `${unit.name} · ${sel.label}: ${sel.desc}` : "";

  const bar = list.map(a => {
    const b = make("button", `bar-btn${state.selectedAction === a.id ? " selected" : ""}`);
    b.type = "button";
    b.disabled = !commandEnabled(state, unit, a);
    b.setAttribute("aria-label", `${a.label}: ${a.desc}`);
    b.append(icon(a.id), make("span", "", a.label));
    b.addEventListener("click", () => handlers.action(a.id));
    return b;
  });
  const end = make("button", "bar-btn end");
  end.type = "button";
  end.append(icon("end"), make("span", "", "End turn"));
  end.addEventListener("click", handlers.endTurn);
  bar.push(end);
  $("actionBar").replaceChildren(...bar);
  return end;
}

export function render(state, ui, handlers) {
  const hitId = state.damageEvent !== lastDamageEvent ? state.lastDamage?.unitId : null;
  lastDamageEvent = state.damageEvent;

  renderHud(state);
  renderSquad(state, handlers, hitId);
  const barEnd = renderCommands(state, handlers);
  renderBoard(state, ui, handlers);

  const comms = $("comms");
  comms.textContent = state.message;
  comms.classList.toggle("alert", Boolean(hitId));

  // Nudge End turn once every living drone has nothing left to spend.
  const done = state.status === "playing" && state.units.filter(u => u.alive).every(u => u.moved && u.acted);
  const end = $("endTurnBtn");
  end.disabled = state.status !== "playing";
  end.classList.toggle("nudge", done);
  barEnd.disabled = end.disabled;
  barEnd.classList.toggle("nudge", done);
  $("undoBtn").disabled = !ui.canUndo;

  const loadout = upgradeChips(state.run);
  $("loadout").hidden = !loadout.length;
  $("loadoutList").replaceChildren(...loadout);

  renderOverlays(state, ui, handlers);
}
