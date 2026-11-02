// Command definitions shared by the rules, the UI and the keyboard map.
// `key` is the number key that selects the command.
export const ACTIONS = [
  { id: "move",   label: "Move",    key: "1", spends: "move",   target: true,  desc: "Step onto a mapped, safe adjacent tile." },
  { id: "reveal", label: "Reveal",  key: "2", spends: "action", target: true,  desc: "Map an adjacent unknown tile. A hidden threat will trigger." },
  { id: "flag",   label: "Flag",    key: "3", spends: "action", target: true,  desc: "Mark or unmark an unknown tile as suspicious." },
  { id: "probe",  label: "Probe",   key: "4", spends: "action", target: true,  desc: "Identify what hides in a tile without setting it off. Hazards zap back for 1." },
  { id: "attack", label: "Disable", key: "5", spends: "action", target: true,  desc: "Shut down a revealed hostile bot." },
  { id: "push",   label: "Push",    key: "6", spends: "action", target: true,  desc: "Bulldoze a revealed hazard or anomaly. Costs 1 HP." },
  { id: "wait",   label: "Hold",    key: "7", spends: "action", target: false, desc: "Spend this drone's action and stay put." },
  { id: "repair", label: "Repair",  key: "8", spends: "action", target: true,  desc: "Restore 1 HP to an adjacent drone (or yourself)." },
  { id: "defuse", label: "Defuse",  key: "9", spends: "action", target: true,  desc: "Safely disarm a revealed trap, EMP or swarm nest." }
];

export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map(a => [a.id, a]));

export function actionsFor(unit) {
  return ACTIONS.filter(a => unit.actions.includes(a.id));
}
