// Internal rule helpers shared by game.js: damage, threats, clears, patrol, danger.
// Everything here mutates plain JSON state and emits events on the bus.
import { neighbors, isAdjacent } from "./board.js";
import { unitAt } from "./units.js";
import { THREATS } from "./threats.js";
import { bus } from "./events.js";

export const cellAt = (state, index) => state.board.cells[index];
export const liveThreat = cell => Boolean(cell.threat && !cell.cleared);

export function damage(state, unit, amount, reason) {
  if (!unit.alive || amount <= 0) return;
  const absorbed = Math.min(unit.armor || 0, amount);
  if (absorbed) {
    unit.armor -= absorbed;
    amount -= absorbed;
    bus.emit("shield", { unit: unit.id, absorbed, armorLeft: unit.armor });
  }
  const before = unit.hp;
  unit.hp = Math.max(0, unit.hp - amount);
  const actual = before - unit.hp;
  if (!actual) return;
  state.metrics.damageTaken += actual;
  state.run.stats.damageTaken += actual;
  state.damageEvent++;
  state.lastDamage = { unitId: unit.id, unitName: unit.name, amount: actual, reason, remaining: unit.hp, maxHp: unit.maxHp, turn: state.turn };
  bus.emit("hit", { unit: unit.id, amount: actual, hpLeft: unit.hp, reason });
  if (unit.hp <= 0) {
    unit.alive = false;
    state.metrics.unitsLost++;
    state.run.stats.unitsLost++;
    bus.emit("unitDown", { unit: unit.id, cell: unit.pos, floor: state.floor });
  }
}

export function heal(state, unit, amount) {
  if (!unit?.alive) return 0;
  const before = unit.hp;
  unit.hp = Math.min(unit.maxHp, unit.hp + amount);
  if (unit.hp > before) bus.emit("repair", { unit: unit.id, amount: unit.hp - before, hpLeft: unit.hp });
  return unit.hp - before;
}

/** Neutralise a threat. `by` is a unit id, "trigger" or "chain". */
export function clearThreat(state, cell, by) {
  if (!liveThreat(cell)) return;
  cell.cleared = true;
  cell.revealed = true;
  bus.emit("threatCleared", { type: cell.threat, cell: cell.index, by });
  if (by === "trigger") return;
  state.run.stats.threatsCleared++;
  const mods = state.run.mods;
  if (mods.scrap) {
    state.run.clearsTowardScrap++;
    if (state.run.clearsTowardScrap >= 3) {
      state.run.clearsTowardScrap = 0;
      const hurt = state.units.filter(u => u.alive && u.hp < u.maxHp).sort((a, b) => a.hp - b.hp)[0];
      if (hurt) heal(state, hurt, mods.scrap);
    }
  }
  if (mods.chain) {
    for (const i of neighbors(cell.index, state.board.size)) {
      const next = cellAt(state, i);
      if (next.revealed && liveThreat(next) && next.threat === cell.threat) clearThreat(state, next, "chain");
    }
  }
}

/** A drone revealed a hidden threat: apply the threat's table entry. */
export function trigger(state, unit, cell) {
  const t = THREATS[cell.threat];
  cell.revealed = true;
  bus.emit("trigger", { type: cell.threat, cell: cell.index, unit: unit.id });
  const nearby = state.units.filter(u => u.alive && u !== unit && isAdjacent(u.pos, cell.index, state.board.size));
  damage(state, unit, t.damage, t.reason);
  if (t.splash) for (const other of nearby) damage(state, other, t.splash, `${t.reason} splash`);
  if (t.jam) {
    for (const u of [unit, ...nearby]) if (u.alive) u.jammed = true;
    bus.emit("jam", { cell: cell.index, units: [unit, ...nearby].filter(u => u.alive).map(u => u.id) });
  }
  if (!t.persists) clearThreat(state, cell, "trigger");
}

export function patrol(state) {
  let moved = 0, struck = 0;
  const size = state.board.size;
  const hostiles = state.board.cells.filter(c => c.threat === "hostile" && !c.cleared);
  for (const hostile of hostiles) {
    const adjacentUnits = state.units.filter(u => u.alive && isAdjacent(hostile.index, u.pos, size));
    if (!adjacentUnits.length) continue;
    const target = adjacentUnits.sort((a, b) => a.pos - b.pos)[0];
    const options = neighbors(hostile.index, size)
      .filter(i => !unitAt(state.units, i) && !cellAt(state, i).threat && !cellAt(state, i).exit);
    if (options.length) {
      const dist = i => Math.abs(i % size - target.pos % size) + Math.abs(Math.floor(i / size) - Math.floor(target.pos / size));
      options.sort((a, b) => dist(a) - dist(b));
      const destination = cellAt(state, options[0]);
      destination.threat = "hostile";
      destination.cleared = false;
      destination.revealed = hostile.revealed;
      hostile.threat = null;
      hostile.cleared = false;
      hostile.revealed = true;
      moved++;
    } else { damage(state, target, 1, "hostile patrol contact"); struck++; }
  }
  bus.emit("patrol", { count: moved + struck, moved, struck });
}

/**
 * Tension in 0..1 from what the player can see: sensor readings under the drones
 * (the visible proxy for nearby unrevealed threats), revealed live threats beside
 * them, squad damage, floor depth and the turn clock.
 */
export function dangerLevel(state) {
  const alive = state.units.filter(u => u.alive);
  if (!alive.length) return 1;
  const size = state.board.size;
  const local = Math.max(...alive.map(u => {
    const here = cellAt(state, u.pos)?.estimate ?? 0;
    const seen = neighbors(u.pos, size).filter(i => { const c = cellAt(state, i); return c.revealed && liveThreat(c); }).length;
    return here + seen;
  }));
  const hp = alive.reduce((s, u) => s + u.hp, 0);
  const max = state.units.reduce((s, u) => s + u.maxHp, 0);
  const depth = Math.min(1, (state.floor - 1) / 9);
  const clock = Math.min(1, (state.turn - 1) / state.maxTurns);
  const raw = 0.45 * Math.min(1, local / 4) + 0.3 * (1 - hp / max) + 0.15 * depth + 0.1 * clock;
  return Math.round(Math.min(1, Math.max(0, raw)) * 20) / 20;
}

export function updateDanger(state) {
  const level = dangerLevel(state);
  if (level !== state.danger) {
    state.danger = level;
    bus.emit("danger", { level });
  }
}

export function trueCount(state, index) {
  return neighbors(index, state.board.size).filter(i => cellAt(state, i).threat).length;
}
