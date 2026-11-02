// Tiny synchronous pub/sub bus. The game emits semantic events here so other
// systems (a future procedural audio engine, analytics-free stats, UI juice)
// can react without touching game code. Payloads are plain JSON objects.
// See docs/EVENTS.md for every event and its payload.

export function createBus() {
  const listeners = new Map(); // type -> Set<fn>; "*" receives (type, payload)

  function on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => listeners.get(type)?.delete(fn);
  }

  function once(type, fn) {
    const off = on(type, (...args) => { off(); fn(...args); });
    return off;
  }

  function call(fn, ...args) {
    // A broken listener must never break the game.
    try { fn(...args); } catch (error) { if (typeof console !== "undefined") console.warn("[events]", error); }
  }

  function emit(type, payload = {}) {
    for (const fn of [...(listeners.get(type) || [])]) call(fn, payload);
    for (const fn of [...(listeners.get("*") || [])]) call(fn, type, payload);
  }

  return { on, once, emit };
}

/** The app-wide bus used by the game. */
export const bus = createBus();
