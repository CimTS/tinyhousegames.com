// Run upgrades. Pure data plus two helpers: build a draft offer and apply a pick.
// Upgrades only write to `run.mods` (numbers) and `run.roster`; the rules read mods.
//
//   max       how many times it can stack
//   rarity    "common" | "rare" | "unlock" (draft weight and card colour)
//   from      first floor-clear that can offer it
//   eligible  optional extra condition on the run
export const UPGRADES = [
  { id: "plating", name: "Ablative plating", icon: "armor", rarity: "common", max: 3,
    desc: "Every drone starts each floor with +1 armor. Armor soaks a point of damage, then breaks.",
    apply: run => { run.mods.armor = (run.mods.armor || 0) + 1; } },
  { id: "probeRange", name: "Long-range probe", icon: "radar", rarity: "common", max: 2,
    desc: "Scout Probe reaches +1 tile further. Pairs well with Calibrated sensors.",
    apply: run => { run.mods.probeRange = (run.mods.probeRange || 0) + 1; } },
  { id: "afterburner", name: "Afterburners", icon: "boot", rarity: "rare", max: 2,
    desc: "Every drone gets +1 move per turn.",
    apply: run => { run.mods.moves = (run.mods.moves || 0) + 1; } },
  { id: "chain", name: "Chain reaction", icon: "chain", rarity: "rare", max: 1,
    desc: "Clearing a threat also clears every revealed threat of the same type touching it, and so on.",
    apply: run => { run.mods.chain = 1; } },
  { id: "breacher", name: "Breacher rams", icon: "push", rarity: "rare", max: 1,
    desc: "Push costs no HP.",
    apply: run => { run.mods.freePush = 1; } },
  { id: "scrap", name: "Scrap recycler", icon: "repair", rarity: "common", max: 2,
    desc: "Every 3 threats cleared repairs the most damaged drone by 1 (per stack).",
    apply: run => { run.mods.scrap = (run.mods.scrap || 0) + 1; } },
  { id: "calibrate", name: "Calibrated sensors", icon: "probe", rarity: "rare", max: 1,
    desc: "Tiles your drones map show the exact threat count. No more noise.",
    apply: run => { run.mods.exact = 1; } },
  { id: "chrono", name: "Extended window", icon: "end", rarity: "common", max: 3,
    desc: "+5 turns on every floor.",
    apply: run => { run.mods.turns = (run.mods.turns || 0) + 5; } },
  { id: "reinforce", name: "Reinforced frames", icon: "heavy", rarity: "common", max: 3,
    desc: "+1 max HP for every drone, and repair 1 now.",
    apply: run => { run.mods.maxHp = (run.mods.maxHp || 0) + 1; run.heal = (run.heal || 0) + 1; } },
  { id: "patch", name: "Field patch kit", icon: "medic", rarity: "common", max: 9,
    desc: "Repair every drone to full before the next floor.",
    apply: run => { run.heal = 99; } },
  { id: "unlockMedic", name: "Recruit: Medic", icon: "medic", rarity: "unlock", max: 1, from: 2,
    desc: "A third drone that can Repair an adjacent drone (or itself) for 1 HP.",
    eligible: run => run.roster.length < 3,
    apply: run => { run.roster.push("medic"); } },
  { id: "unlockEngineer", name: "Recruit: Engineer", icon: "engineer", rarity: "unlock", max: 1, from: 2,
    desc: "A third drone that can Defuse revealed traps, EMPs, anomalies and swarms with no damage.",
    eligible: run => run.roster.length < 3,
    apply: run => { run.roster.push("engineer"); } }
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
const WEIGHT = { common: 6, rare: 3, unlock: 5 };

export function newRun() {
  return {
    roster: ["scout", "heavy"], mods: {}, upgrades: [], heal: 0, units: null,
    stats: { floorsCleared: 0, threatsCleared: 0, tilesMapped: 0, turns: 0, damageTaken: 0, unitsLost: 0 },
    clearsTowardScrap: 0
  };
}

export function stacks(run, id) { return run.upgrades.filter(u => u === id).length; }

export function isEligible(run, upgrade, floor) {
  return stacks(run, upgrade.id) < upgrade.max && floor >= (upgrade.from || 1) && (!upgrade.eligible || upgrade.eligible(run));
}

/** Three distinct weighted picks for the draft after clearing `floor`. Deterministic for a given rng. */
export function offerUpgrades(run, floor, rng, count = 3) {
  const pool = UPGRADES.filter(u => isEligible(run, u, floor));
  const picks = [];
  while (picks.length < count && pool.length) {
    const total = pool.reduce((s, u) => s + WEIGHT[u.rarity], 0);
    let roll = rng() * total;
    const i = pool.findIndex(u => (roll -= WEIGHT[u.rarity]) < 0);
    picks.push(pool.splice(i < 0 ? pool.length - 1 : i, 1)[0]);
  }
  return picks;
}

export function applyUpgrade(run, id) {
  const up = UPGRADE_BY_ID[id];
  if (!up) return false;
  up.apply(run);
  run.upgrades.push(id);
  return true;
}
