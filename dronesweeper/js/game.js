// Public game API: create a floor, select, act, end turn, advance the run.
// State is plain JSON so it can be saved, cloned for undo and tested headlessly.
import { createBoard, isAdjacent, within, floodReveal } from "./board.js";
import { makeUnits, unitAt, UNIT_TYPES } from "./units.js";
import { mulberry32, randomSeed, hashString } from "./seed.js";
import { getBestFloor, setBestFloor, getDailyRecord, saveDailyRecord } from "./storage.js";
import { canClear } from "./threats.js";
import { newRun, offerUpgrades, applyUpgrade as apply } from "./upgrades.js";
import { bus } from "./events.js";
import { cellAt, liveThreat, damage, heal, clearThreat, trigger, patrol, dangerLevel, updateDanger, trueCount } from "./rules.js";

export { dangerLevel };
export const BASE_TURNS = 30;
export const FINAL_FLOOR = 10;
export const applyUpgrade = apply;

export function createGame({ floor = 1, seed = randomSeed(), daily = false, date = null, run = newRun() } = {}) {
  const board = createBoard(floor, mulberry32(seed));
  const units = makeUnits(board.start, board.size, run.roster.slice(2));
  const mods = run.mods;
  for (const unit of units) {
    unit.maxHp = UNIT_TYPES[unit.id].hp + (mods.maxHp || 0);
    const carried = run.units?.[unit.id];
    unit.hp = carried ? (carried.alive ? Math.min(unit.maxHp, carried.hp + 1) : 1) : unit.maxHp;
    unit.hp = Math.min(unit.maxHp, unit.hp + (run.heal || 0));
    unit.armor = mods.armor || 0;
    unit.maxMoves = 1 + (mods.moves || 0);
    unit.movesUsed = 0;
    unit.jammed = false;
    board.cells[unit.pos].revealed = true; // protected staging platform
  }
  run.heal = 0;
  const state = {
    floor, seed, daily, date, board, units, run, activeUnit: "scout", turn: 1,
    maxTurns: BASE_TURNS + (mods.turns || 0), status: "playing", runComplete: false,
    message: "Find the beacon. Sensor numbers can be off by one.",
    selectedAction: "reveal", bestFloor: getBestFloor(),
    metrics: { damageTaken: 0, unitsLost: 0 }, lastDamage: null, damageEvent: 0, danger: 0,
    lastDailyRecord: daily && date ? getDailyRecord(date) : null
  };
  if (mods.exact) for (const cell of board.cells) cell.estimate = trueCount(state, cell.index);
  state.danger = dangerLevel(state);
  return state;
}

function reject(state, reason) {
  state.message = reason;
  bus.emit("invalid", { reason });
}

function currentUnit(state) {
  return state.units.find(u => u.id === state.activeUnit && u.alive) || state.units.find(u => u.alive) || null;
}
export const getCurrentUnit = currentUnit;

/** Bank floor results into the run exactly once (stats, HP carry-over). */
function closeFloor(state) {
  if (state.floorClosed) return;
  state.floorClosed = true;
  if (state.status === "won") state.run.stats.floorsCleared++;
  state.run.stats.turns += state.turn;
  state.run.units = Object.fromEntries(state.units.map(u => [u.id, { hp: u.hp, alive: u.alive }]));
}

function finishIfLost(state) {
  if (state.units.some(u => u.alive)) return false;
  if (state.status === "playing") {
    state.status = "lost";
    state.message = "All drones are offline. The site keeps its secrets.";
    closeFloor(state);
    bus.emit("runOver", { floor: state.floor, win: false, turn: state.turn });
  }
  return true;
}

function win(state, unit) {
  if (state.status !== "playing") return;
  state.status = "won";
  closeFloor(state);
  const hpLeft = state.units.reduce((sum, u) => sum + (u.alive ? u.hp : 0), 0);
  state.message = `${unit.name} reached the beacon. Floor ${state.floor} cleared.`;
  setBestFloor(state.floor + 1);
  state.bestFloor = getBestFloor();
  if (state.daily && state.date) {
    state.lastDailyRecord = saveDailyRecord(state.date, { turns: state.run.stats.turns, hp: hpLeft, floor: state.floor });
  }
  bus.emit("extract", { unit: unit.id, cell: unit.pos, turn: state.turn, floor: state.floor });
  bus.emit("floorClear", { floor: state.floor, turns: state.turn, hpLeft });
  if (state.floor >= FINAL_FLOOR) {
    state.runComplete = true;
    state.message = `Deep site cleared. All ${FINAL_FLOOR} floors surveyed.`;
    bus.emit("runOver", { floor: state.floor, win: true, turn: state.turn });
  }
}

export function selectUnit(state, id) {
  if (state.status !== "playing") return;
  const unit = state.units.find(u => u.id === id && u.alive);
  if (unit) {
    state.activeUnit = id;
    state.message = `${unit.name} selected · move ${unit.moved ? "used" : "ready"} · action ${unit.acted ? "used" : "ready"}.`;
  }
}

export function selectAction(state, action) {
  if (state.status !== "playing") return;
  state.selectedAction = action;
}

function inReach(state, unit, action, index) {
  const size = state.board.size;
  if (action === "probe") return within(unit.pos, index, size, 1 + (state.run.mods.probeRange || 0));
  if (action === "repair") return index === unit.pos || isAdjacent(unit.pos, index, size);
  return isAdjacent(unit.pos, index, size);
}

/** True when `unit` may carry out `action` on tile `index` right now. Used by rules, highlights and taps. */
export function validTarget(state, unit, action, index) {
  if (!unit?.alive || state.status !== "playing") return false;
  if (!Number.isInteger(index) || index < 0 || index >= state.board.cells.length) return false;
  if (!unit.actions.includes(action) || !inReach(state, unit, action, index)) return false;
  const cell = cellAt(state, index);
  const live = liveThreat(cell);
  if (action === "move") return !unit.moved && cell.revealed && !live && !unitAt(state.units, index);
  if (unit.acted) return false;
  switch (action) {
    case "reveal": return !cell.revealed && !cell.flagged;
    case "flag": case "probe": return !cell.revealed;
    case "repair": { const ally = unitAt(state.units, index); return Boolean(ally && ally.hp < ally.maxHp); }
    case "attack": case "push": case "defuse": return cell.revealed && live && canClear(cell.threat, action);
    default: return false;
  }
}

const spend = unit => { unit.acted = true; };
const mapTiles = (state, indices) => { state.run.stats.tilesMapped += indices.length; };

const ACT = {
  move(state, unit, cell) {
    const from = unit.pos;
    unit.pos = cell.index;
    unit.movesUsed++;
    unit.moved = unit.movesUsed >= unit.maxMoves;
    bus.emit("move", { unit: unit.id, from, to: cell.index });
    if (cell.exit) return win(state, unit);
    state.message = `${unit.name} moved.`;
  },
  reveal(state, unit, cell) {
    spend(unit);
    if (liveThreat(cell)) {
      trigger(state, unit, cell);
      state.message = `${unit.name} set off a hidden ${cell.threat}!`;
      return;
    }
    cell.revealed = true;
    if (state.run.mods.exact) cell.estimate = trueCount(state, cell.index);
    const flood = unit.alive && cell.estimate === 0 ? floodReveal(state.board, cell.index) : [];
    mapTiles(state, [cell.index, ...flood]);
    bus.emit("reveal", { cell: cell.index, sensorValue: cell.estimate, floor: state.floor, count: 1 + flood.length, unit: unit.id });
    state.message = cell.exit ? "Beacon located. Move a drone onto it to extract." : `Mapped. Sensor reads ${cell.estimate}.`;
  },
  flag(state, unit, cell) {
    cell.flagged = !cell.flagged;
    spend(unit);
    bus.emit("flag", { cell: cell.index, flagged: cell.flagged });
    state.message = cell.flagged ? "Tile flagged as suspicious." : "Flag removed.";
  },
  probe(state, unit, cell) {
    spend(unit);
    cell.revealed = true;
    bus.emit("probe", { cell: cell.index, threatType: cell.threat, unit: unit.id });
    mapTiles(state, [cell.index]);
    if (cell.threat) {
      state.message = `Probe found a ${cell.threat.toUpperCase()}. Still active.`;
      if (cell.threat === "hazard") damage(state, unit, 1, "probe feedback from hazard");
    } else {
      if (state.run.mods.exact) cell.estimate = trueCount(state, cell.index);
      state.message = "Probe: all clear.";
      if (cell.estimate === 0) mapTiles(state, floodReveal(state.board, cell.index));
    }
  },
  attack(state, unit, cell) {
    spend(unit);
    const type = cell.threat;
    clearThreat(state, cell, unit.id);
    state.message = type === "hostile" ? "Hostile bot disabled." : `${unit.name} disabled the ${type}.`;
  },
  push(state, unit, cell) {
    spend(unit);
    clearThreat(state, cell, unit.id);
    if (state.run.mods.freePush) state.message = "Rams cleared it. No damage.";
    else { damage(state, unit, 1, "pushing through debris"); state.message = "Cleared, at the cost of 1 HP."; }
  },
  defuse(state, unit, cell) {
    spend(unit);
    const type = cell.threat;
    clearThreat(state, cell, unit.id);
    state.message = `${type[0].toUpperCase() + type.slice(1)} disarmed.`;
  },
  repair(state, unit, cell) {
    spend(unit);
    const ally = unitAt(state.units, cell.index);
    heal(state, ally, 1);
    state.message = `${ally.name} repaired to ${ally.hp}/${ally.maxHp}.`;
  }
};

function explainInvalid(state, unit, action, index) {
  if (!unit.actions.includes(action)) return `${unit.name} can't do that.`;
  if (action === "move" && unit.moved) return "This drone has already moved this turn.";
  if (action !== "move" && unit.acted) return "This drone has already used its action.";
  if (!Number.isInteger(index) || !cellAt(state, index) || !inReach(state, unit, action, index)) return "Out of reach. Commands target adjacent tiles.";
  if (action === "move") return unitAt(state.units, index) ? "Another drone holds that tile." : "Move needs a mapped, safe tile.";
  if (action === "reveal") return cellAt(state, index).flagged ? "Unflag that tile before revealing it." : "That tile is already mapped.";
  return "No valid target there.";
}

export function performAction(state, index = null) {
  if (state.status !== "playing") return;
  const unit = currentUnit(state);
  if (!unit) return;
  const action = state.selectedAction;
  if (action === "wait") {
    if (unit.acted) return reject(state, "This drone has already acted.");
    spend(unit);
    state.message = `${unit.name} holds position.`;
  } else if (!validTarget(state, unit, action, index)) {
    return reject(state, explainInvalid(state, unit, action, index));
  } else {
    ACT[action](state, unit, cellAt(state, index));
  }
  finishIfLost(state);
  updateDanger(state);
}

export function endTurn(state) {
  if (state.status !== "playing" || finishIfLost(state)) return;
  bus.emit("turnEnd", { turn: state.turn, floor: state.floor });
  patrol(state);
  if (finishIfLost(state)) { updateDanger(state); return; }
  state.turn++;
  for (const unit of state.units) {
    unit.movesUsed = unit.jammed ? unit.maxMoves : 0;
    unit.moved = unit.movesUsed >= unit.maxMoves;
    unit.jammed = false;
    unit.acted = false;
  }
  state.activeUnit = state.units.find(u => u.alive)?.id || "scout";
  if (state.turn > state.maxTurns) {
    state.status = "lost";
    state.turn = state.maxTurns;
    state.message = `The ${state.maxTurns}-turn window closed. Extraction aborted.`;
    closeFloor(state);
    bus.emit("runOver", { floor: state.floor, win: false, turn: state.turn });
    return;
  }
  const jammed = state.units.filter(u => u.alive && u.moved);
  state.message = `Turn ${state.turn}.${jammed.length ? ` ${jammed.map(u => u.name).join(", ")} jammed: no move.` : " Drones refreshed."}`;
  updateDanger(state);
}

/** The three upgrades offered after clearing this floor (deterministic per floor seed). */
export function offerDraft(state) {
  return offerUpgrades(state.run, state.floor, mulberry32(hashString(`${state.seed}:${state.floor}:draft`)));
}

/** Build the next floor (after a win) or a fresh run (after a loss). `pick` is an upgrade id. */
export function continueAfterResult(state, pick = null) {
  if (state.status !== "won" || state.runComplete) return createGame({ floor: 1, seed: randomSeed() });
  closeFloor(state);
  const run = structuredClone(state.run);
  if (pick) {
    apply(run, pick);
    bus.emit("upgrade", { id: pick, floor: state.floor, stacks: run.upgrades.filter(u => u === pick).length });
  }
  // Daily runs stay deterministic floor after floor; normal runs reroll.
  const seed = state.daily ? hashString(`${state.seed}:${state.floor + 1}`) : randomSeed();
  return createGame({ floor: state.floor + 1, seed, daily: state.daily, date: state.date, run });
}

export function getDailyLeaderboard(state) {
  if (!state.daily || !state.date) return null;
  return state.lastDailyRecord || getDailyRecord(state.date);
}
