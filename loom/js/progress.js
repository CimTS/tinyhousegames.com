// Lifetime progress: pure functions so the rules can be unit tested.
import { PALETTES, isPaletteUnlocked } from "./palettes.js";

export function defaultProgress() {
  return {
    stats: { pieces: 0, threads: 0, merges: 0, perfect: 0, braids: 0 },
    dailies: [],
    campaign: { cleared: [] },
    palette: PALETTES[0].id
  };
}

// Saved progress with every value checked. Anything missing, damaged or of the
// wrong kind falls back to its starting value, so the menus can always be drawn.
export function cleanProgress(saved) {
  const out = defaultProgress(), s = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  const stats = s.stats && typeof s.stats === "object" ? s.stats : {};
  for (const key of Object.keys(out.stats)) out.stats[key] = Number.isFinite(stats[key]) && stats[key] >= 0 ? Math.floor(stats[key]) : 0;
  if (Array.isArray(s.dailies)) out.dailies = [...new Set(s.dailies.filter(x => typeof x === "string"))];
  if (Array.isArray(s.campaign?.cleared)) out.campaign.cleared = [...new Set(s.campaign.cleared.filter(x => typeof x === "string"))];
  if (PALETTES.some(p => p.id === s.palette)) out.palette = s.palette;
  return out;
}

// summary: { mode, seed, levelId, cleared, stats: GameState#stats() }
// Returns a new progress object and the ids of any palettes newly unlocked.
export function recordFinish(progress, summary) {
  const p = structuredClone(progress);
  const before = new Set(PALETTES.filter(x => isPaletteUnlocked(x, progress)).map(x => x.id));
  const s = summary.stats;
  p.stats.pieces += 1;
  p.stats.threads += s.threadsWoven;
  p.stats.merges += s.merges;
  p.stats.perfect += s.perfect ? 1 : 0;
  p.stats.braids += s.braids || 0;
  if (summary.mode === "daily" && summary.seed && !p.dailies.includes(summary.seed)) p.dailies.push(summary.seed);
  if (summary.mode === "campaign" && summary.cleared && !p.campaign.cleared.includes(summary.levelId)) {
    p.campaign.cleared.push(summary.levelId);
  }
  const unlocked = PALETTES.filter(x => isPaletteUnlocked(x, p) && !before.has(x.id)).map(x => x.id);
  return { progress: p, unlocked };
}
