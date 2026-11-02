// One-step undo for misclicks. Only commands that reveal no new information can
// be undone; otherwise undo would let you peek at a tile and take it back.
export const UNDOABLE = new Set(["move", "flag", "wait", "attack", "push", "defuse", "repair"]);

export function createHistory() { return { snap: null, action: null }; }

// What counts as "the command did something": board and squad, not the message text.
const signature = state => JSON.stringify([state.board, state.units, state.status]);

/** Run a command and update the undo slot. Refused commands leave the slot alone. */
export function command(history, state, action, run) {
  const before = structuredClone(state);
  const sig = signature(state);
  run();
  if (signature(state) === sig) return false;
  const keep = UNDOABLE.has(action) && state.status === "playing";
  history.snap = keep ? before : null;
  history.action = keep ? action : null;
  return true;
}

/** Forget the undo step (end of turn, new floor, load). */
export function reset(history) { history.snap = null; history.action = null; }

/** Return the previous state (once) or null. */
export function undo(history) {
  const snap = history.snap;
  reset(history);
  return snap;
}
