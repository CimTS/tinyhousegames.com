// Mid-run save and resume. One slot in localStorage; the state is plain JSON.
export const SAVE_VERSION = 2;
const KEY = "dronesweeper_save";

export function saveRun(state) {
  try {
    if (state.status === "lost" || state.runComplete) { localStorage.removeItem(KEY); return; }
    localStorage.setItem(KEY, JSON.stringify({ v: SAVE_VERSION, savedAt: Date.now(), state }));
  } catch { /* storage full or blocked: the run is still playable */ }
}

export function loadRun() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    const s = data?.state;
    if (data?.v !== SAVE_VERSION || !s?.board?.cells || !Array.isArray(s.units) || !s.run) return null;
    return s;
  } catch {
    return null;
  }
}

export function hasSave() { return loadRun() !== null; }

export function clearRun() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
