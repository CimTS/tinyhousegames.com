// Board renderer. Cells are built once per board and then updated in place, so
// focus survives re-renders and one-shot CSS effects fire exactly once.
import { icon } from "./icons.js";
import { unitAt } from "./units.js";
import { validTarget, getCurrentUnit } from "./game.js";

let built = null;   // { board, buttons }
let prev = null;    // snapshot used to detect what changed since the last render

function snapshot(state) {
  return {
    board: state.board,
    revealed: state.board.cells.map(c => c.revealed),
    cleared: state.board.cells.map(c => c.cleared),
    pos: Object.fromEntries(state.units.map(u => [u.id, u.pos])),
    damageEvent: state.damageEvent
  };
}

function build(state, handlers) {
  const el = document.getElementById("board");
  const buttons = state.board.cells.map(cell => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cell";
    b.setAttribute("role", "gridcell");
    b.tabIndex = -1;
    b.addEventListener("click", () => handlers.tap(cell.index));
    b.addEventListener("focus", () => handlers.focusCell(cell.index));
    return b;
  });
  el.style.setProperty("--cols", state.board.size);
  el.replaceChildren(...buttons);
  built = { board: state.board, buttons };
  prev = null; // a new board never animates its first frame
}

function describe(cell, unit, state) {
  const where = `Row ${Math.floor(cell.index / state.board.size) + 1}, column ${cell.index % state.board.size + 1}`;
  let what;
  if (!cell.revealed) what = cell.flagged ? "unmapped, flagged" : "unmapped";
  else if (cell.exit) what = "extraction beacon";
  else if (cell.threat && !cell.cleared) what = `${cell.threat}, active`;
  else what = cell.estimate ? `sensor reads ${cell.estimate}` : "clear";
  return `${where}: ${what}${unit ? `, ${unit.name}` : ""}`;
}

export function renderBoard(state, ui, handlers) {
  if (!built || built.board !== state.board) build(state, handlers);
  const el = document.getElementById("board");
  const active = getCurrentUnit(state);
  const action = state.selectedAction;
  const same = prev && prev.board === state.board;
  const hitEvent = same && state.damageEvent !== prev.damageEvent ? state.lastDamage : null;
  let revealOrder = 0;

  el.dataset.cmd = action;
  el.classList.toggle("kbd", ui.keyboard);
  el.classList.toggle("fx-extract", state.status === "won");
  el.classList.toggle("fx-lost", state.status === "lost");
  el.setAttribute("aria-label", `${state.board.size} by ${state.board.size} tactical map`);

  for (const cell of state.board.cells) {
    const b = built.buttons[cell.index];
    const unit = unitAt(state.units, cell.index);
    const live = cell.threat && !cell.cleared;
    const cls = ["cell"];
    const children = [];
    b.removeAttribute("data-n");

    if (!cell.revealed) {
      cls.push("fog");
      if (cell.flagged) children.push(icon("flag", { className: "icon flag" }));
    } else if (cell.exit) {
      cls.push("open", "exit");
      children.push(icon("beacon"));
    } else if (live) {
      cls.push("open", "threat", `t-${cell.threat}`);
      children.push(icon(cell.threat));
    } else {
      cls.push("open");
      if (cell.cleared) { cls.push("scar"); children.push(icon("scar")); }
      else if (cell.estimate) { b.dataset.n = cell.estimate; children.push(document.createTextNode(String(cell.estimate))); }
      else cls.push("zero");
    }

    if (unit) {
      const token = document.createElement("span");
      token.className = `token u-${unit.id}${unit.moved && unit.acted ? " spent" : ""}`;
      token.append(icon(unit.icon));
      children.push(token);
      if (active && unit.id === active.id) cls.push("active-unit");
    }
    if (active && validTarget(state, active, action, cell.index)) cls.push("target");
    if (cell.index === ui.cursor) {
      cls.push("cursor");
      const mark = document.createElement("span");
      mark.className = "cursor-mark";
      children.push(mark);
    }

    // One-shot effects, derived from what changed since the previous frame.
    if (same) {
      if (cell.revealed && !prev.revealed[cell.index]) {
        cls.push("fx-reveal");
        b.style.setProperty("--d", `${Math.min(revealOrder++ * 14, 420)}ms`);
      }
      if (cell.cleared && !prev.cleared[cell.index]) cls.push("fx-clear");
      if (unit && prev.pos[unit.id] !== unit.pos) cls.push("fx-move");
      if (hitEvent) {
        const victim = state.units.find(u => u.id === hitEvent.unitId);
        if (victim && victim.pos === cell.index) { cls.push("fx-hit"); b.dataset.dmg = `−${hitEvent.amount}`; }
      }
    }

    b.className = cls.join(" ");
    b.replaceChildren(...children);
    b.tabIndex = cell.index === ui.cursor ? 0 : -1;
    b.setAttribute("aria-label", describe(cell, unit, state));
  }
  prev = snapshot(state);
}

/** Move DOM focus to the cursor cell (keyboard play). */
export function focusCursor(ui) {
  const b = built?.buttons[ui.cursor];
  if (b && document.activeElement !== b) b.focus({ preventScroll: true });
}
