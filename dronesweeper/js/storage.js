const PREFIX = "dronesweeper_";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
  catch { /* Private browsing or storage quota: the run remains playable. */ }
}

export function getBestFloor() { return Math.max(1, Number(read("best_floor", 1)) || 1); }
export function setBestFloor(floor) { write("best_floor", Math.max(getBestFloor(), floor)); }

export function getDailyRecord(date) { return read(`daily_${date}`, null); }

export function saveDailyRecord(date, record) {
  const old = getDailyRecord(date);
  const better = !old || record.turns < old.turns ||
    (record.turns === old.turns && record.hp > old.hp);
  if (better) write(`daily_${date}`, record);
  return better ? record : old;
}
