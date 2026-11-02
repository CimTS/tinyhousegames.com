// Drone roster. Medic and Engineer are run unlocks (see upgrades.js).
const BASE = ["move", "reveal", "flag"];

export const UNIT_TYPES = {
  scout:    { name: "Scout",    role: "Recon · probe",       hp: 3, actions: [...BASE, "probe", "wait"] },
  heavy:    { name: "Heavy",    role: "Breach · clear",      hp: 5, actions: [...BASE, "attack", "push", "wait"] },
  medic:    { name: "Medic",    role: "Field repair",        hp: 3, actions: [...BASE, "repair", "wait"] },
  engineer: { name: "Engineer", role: "Disarm traps",        hp: 4, actions: [...BASE, "defuse", "wait"] }
};

export function makeUnit(id, pos) {
  const t = UNIT_TYPES[id];
  return {
    id, name: t.name, role: t.role, icon: id, hp: t.hp, maxHp: t.hp, armor: 0,
    actions: [...t.actions], pos, alive: true, moved: false, acted: false
  };
}

export function makeUnits(start, size, extra = []) {
  const slots = [start, start + 1, start + size, start + size + 1];
  return ["scout", "heavy", ...extra].map((id, i) => makeUnit(id, slots[i]));
}

export function unitAt(units, index) {
  return units.find(unit => unit.alive && unit.pos === index) || null;
}
