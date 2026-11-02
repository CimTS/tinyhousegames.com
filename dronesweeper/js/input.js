// Pure input mapping: keyboard events and taps become game commands.
import { ACTIONS } from "./actions.js";
import { unitAt } from "./units.js";
import { validTarget, getCurrentUnit } from "./game.js";

const DIRS = {
  arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
  arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0]
};

export function keyToCommand(event) {
  const key = String(event.key || "").toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z") return { type: "undo" };
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  if (DIRS[key]) return { type: "cursor", dx: DIRS[key][0], dy: DIRS[key][1] };
  if (key === "tab") return { type: "cycleUnit", dir: event.shiftKey ? -1 : 1 };
  if (key === "enter" || key === " ") return { type: "confirm" };
  if (key === "e") return { type: "endTurn" };
  if (key === "?" || key === "h") return { type: "help" };
  if (key === "u") return { type: "undo" };
  if (key === "m") return { type: "mute" };
  const action = ACTIONS.find(a => a.key === key);
  if (action) return { type: "action", id: action.id };
  return null;
}

export function moveCursor(index, dx, dy, size) {
  const x = Math.max(0, Math.min(size - 1, (index % size) + dx));
  const y = Math.max(0, Math.min(size - 1, Math.floor(index / size) + dy));
  return y * size + x;
}

/** Decide what a click/tap/Enter on a tile should do. */
export function resolveTap(state, index) {
  const active = getCurrentUnit(state);
  const occupant = unitAt(state.units, index);
  if (occupant && occupant !== active) return { type: "unit", id: occupant.id };
  if (active && validTarget(state, active, state.selectedAction, index)) {
    return { type: "act", action: state.selectedAction, index };
  }
  if (active && validTarget(state, active, "move", index)) return { type: "act", action: "move", index };
  return { type: "cursor", index };
}
