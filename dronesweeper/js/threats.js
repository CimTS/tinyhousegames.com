// Threat roster. Pure data: board generation, damage and clearing all read from here.
//
//   from        first floor the threat can appear on
//   roll        [min, max) slice of the placement roll that selects this type;
//               later rows override earlier ones, which keeps floors 1-4 identical
//               to the original generator
//   damage      HP lost by the drone that sets it off
//   splash      HP lost by every *other* drone adjacent to the threat when triggered
//   jam         drones adjacent to it lose their next move when triggered
//   persists    stays active after being triggered (hostile bots)
//   clearBy     commands that neutralise it once revealed
//   clearCost   HP the clearing drone pays (Push)
export const THREATS = {
  hazard:  { label: "Hazard",  from: 1, roll: [0, .48],   damage: 1, clearBy: ["push"],             reason: "static hazard" },
  hostile: { label: "Hostile", from: 1, roll: [.48, .80], damage: 1, clearBy: ["attack"], persists: true, reason: "hostile contact" },
  trap:    { label: "Trap",    from: 1, roll: [.80, 1],   damage: 2, clearBy: ["defuse"],           reason: "tripwire trap" },
  anomaly: { label: "Anomaly", from: 3, roll: [.88, 1],   damage: 2, clearBy: ["push", "defuse"],   reason: "unknown anomaly" },
  emp:     { label: "EMP",     from: 5, roll: [.80, .86], damage: 1, clearBy: ["push", "defuse"], jam: true, reason: "EMP burst" },
  swarm:   { label: "Swarm",   from: 7, roll: [.40, .48], damage: 1, splash: 1, clearBy: ["attack", "defuse"], reason: "nano-swarm" }
};

// Threats placed per floor: base + perFloor * floor, capped to leave room to move.
export const DENSITY = { base: 12, perFloor: 4 };
export function threatCount(floor, size) {
  return Math.min(size * size - 14, DENSITY.base + DENSITY.perFloor * floor);
}

/** Pick a threat type for one placement roll on a floor. */
export function threatForRoll(roll, floor) {
  let type = null;
  for (const [id, t] of Object.entries(THREATS)) {
    if (floor >= t.from && roll >= t.roll[0] && roll < t.roll[1]) type = id;
  }
  return type ?? "trap";
}

export function canClear(type, action) {
  return Boolean(THREATS[type]?.clearBy.includes(action));
}
