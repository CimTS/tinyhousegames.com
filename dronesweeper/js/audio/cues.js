/* The cue map: every game event (docs/EVENTS.md) -> what the player hears.
 * Each cue gets (payload, audio) where audio is the sound engine from sound.js:
 *   audio.play(patch, { t, vel, rate, pan })   one-shot SFX (sfx.js patches)
 *   audio.duck(amount, seconds)                dip the music under a big moment
 *   audio.music                                setIntensity / setMode / accent
 *   audio.panFor(cell)                         optional: stereo position of a board cell (-1..1)
 * Every event must have an entry, even if it is deliberately quiet. tests/audio.test.js scans the
 * source for bus.emit("...") calls and fails if one is missing here. */
import { semis } from "./sfx.js";

// E minor pentatonic over the score's E phrygian: sensor chirps climb this ladder.
const LADDER = [0, 3, 5, 7, 10, 12, 15, 17, 19];
const SIGNATURE = { hazard: "buzz", hostile: "alert", trap: "clack", anomaly: "wobble", emp: "crackle", swarm: "flutter" };

const pan = (a, p) => (typeof a.panFor === "function" && Number.isInteger(p?.cell) ? a.panFor(p.cell) : 0);
const music = a => a.music || null;

export const CUES = {
  // ---------- Board and actions ----------
  reveal(p, a) {
    const n = Math.max(0, Math.min(8, Number(p.sensorValue) || 0)), x = pan(a, p);
    a.play("chirp", { vel: 0.16, rate: semis(LADDER[n]), pan: x });
    if (n >= 3) a.play("chirp", { t: 0.07, vel: 0.1 + n * 0.01, rate: semis(LADDER[n] + 12), pan: x }); // warning double-chirp
    if ((p.count || 1) >= 6) a.play("scan", { t: 0.04, vel: 0.05, rate: 1.2, pan: x });                    // big area opened
  },
  trigger(p, a) {
    a.play("stab", { vel: 0.1, pan: pan(a, p) });
    if (SIGNATURE[p.type]) a.play(SIGNATURE[p.type], { t: 0.03, vel: 0.08, pan: pan(a, p) });
  },
  probe(p, a) {
    const x = pan(a, p);
    a.play("scan", { vel: 0.08, pan: x });
    if (p.threatType) a.play(SIGNATURE[p.threatType] || "stab", { t: 0.2, vel: 0.09, pan: x });
    else a.play("clearOk", { t: 0.2, vel: 0.07, pan: x });
  },
  flag(p, a) { a.play("flag", { vel: 0.07, rate: p.flagged ? 1 : semis(-5), pan: pan(a, p) }); },
  move(p, a) { a.play("whirr", { vel: 0.045, rate: semis(Math.random() < 0.5 ? 0 : 2), pan: 0 }); },
  threatCleared(p, a) {
    if (p.by === "trigger") return; // the trigger cue already played
    const x = pan(a, p);
    const chain = p.by === "chain";
    const t = chain ? 0.06 : 0;
    switch (p.type) {
      case "hostile": a.play("zap", { t, vel: 0.09, pan: x }); break;
      case "swarm": a.play("zap", { t, vel: 0.08, rate: semis(-5), pan: x }); a.play("flutter", { t: t + 0.05, vel: 0.04, rate: 0.7, pan: x }); break;
      case "hazard": a.play("crunch", { t, vel: 0.1, pan: x }); break;
      case "anomaly": a.play("crunch", { t, vel: 0.09, rate: semis(3), pan: x }); a.play("wobble", { t: t + 0.04, vel: 0.04, rate: 0.6, pan: x }); break;
      case "emp": a.play("crunch", { t, vel: 0.08, rate: semis(-3), pan: x }); a.play("crackle", { t: t + 0.03, vel: 0.04, rate: 0.6, pan: x }); break;
      case "trap": a.play("snip", { t, vel: 0.08, pan: x }); a.play("chime", { t: t + 0.06, vel: 0.05, pan: x }); break;
      default: a.play("crunch", { t, vel: 0.08, pan: x });
    }
    if (chain) a.play("chime", { t: 0.1, vel: 0.04, rate: semis(7), pan: x });
  },
  invalid(p, a) { a.play("deny", { vel: 0.1 }); },

  // ---------- Damage and squad ----------
  hit(p, a) {
    const amount = Math.max(1, Number(p.amount) || 1);
    a.play("impact", { vel: 0.1 + amount * 0.04, rate: semis(-(amount - 1) * 2) });
    a.duck(0.35, 0.5);
  },
  shield(p, a) { a.play("ping", { vel: 0.06 }); },
  repair(p, a) { [0, 4, 7].forEach((s, i) => a.play("chime", { t: i * 0.06, vel: 0.04, rate: semis(s) })); },
  jam(p, a) { a.play("crackle", { vel: 0.07, rate: 0.8 }); },
  unitDown(p, a) { a.play("down", { t: 0.12, vel: 0.11 }); a.duck(0.6, 1.6); },
  danger(p, a) { music(a)?.setIntensity(Number(p.level) || 0); },

  // ---------- Turns and progression ----------
  turnEnd(p, a) { a.play("beep", { vel: 0.08 }); a.play("beep", { t: 0.09, vel: 0.06, rate: semis(5) }); },
  patrol(p, a) {
    for (let i = 0; i < Math.min(4, p.count || 0); i++) a.play("servo", { t: 0.18 + i * 0.11, vel: 0.13, rate: semis(i % 2 ? -2 : 0) });
  },
  extract(p, a) { a.play("thruster", { vel: 0.12, pan: pan(a, p) }); a.duck(0.55, 1.8); },
  floorClear(p, a) { music(a)?.accent("victory"); },
  runOver(p, a) {
    music(a)?.accent(p.win ? "complete" : "signalLost");
    a.duck(p.win ? 0.3 : 0.5, 1.4);
  },
  upgrade(p, a) { [0, 7, 12].forEach((s, i) => a.play("chime", { t: i * 0.07, vel: 0.05, rate: semis(s) })); },

  // ---------- Interface ----------
  uiClick(p, a) { if (p.target !== "cell") a.play("tick", { vel: 0.05 }); },
  undo(p, a) { a.play("whirr", { vel: 0.05, rate: semis(-7) }); },
  screen(p, a) { music(a)?.setMode?.(p.name); }
};

/** Event names with no cue. Should always be empty for anything the game emits. */
export function unmappedEvents(names) {
  return names.filter(n => !Object.hasOwn(CUES, n));
}

/** Subscribe a sound engine to every event on a bus. Returns an unsubscribe function. */
export function connectAudio(bus, audio) {
  return bus.on("*", (type, payload) => {
    const cue = CUES[type];
    if (cue) cue(payload || {}, audio);
  });
}
