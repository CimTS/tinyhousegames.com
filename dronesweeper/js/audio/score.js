/* The Dronesweeper score, as data. Original composition: neon-grid electronica meets a
 * techno-thriller briefing. E phrygian, 108 BPM. Semitones are relative to E3 (164.81 Hz). */
export const BPM = 108;
export const ROOT = 164.81; // E3
export const hz = semi => ROOT * Math.pow(2, semi / 12);

// E phrygian: E F G A B C D. The flat second (F) is the techno-thriller colour.
export const SCALE = [0, 1, 3, 5, 7, 8, 10];

// One chord per bar, 8-bar cycle: Em F Em Dm | C F Am Bdim -> back to Em.
export const PROGRESSION = [
  [0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 1, 5],
  [-4, 0, 3], [1, 5, 8], [5, 8, 12], [7, 10, 13]
];

// The briefing motif: [semitone, beats], 8 bars. A rising fifth-and-octave call, the phrygian
// F-over-E "cry", and a cadence that falls F -> E. Played an octave up by the lead.
export const MOTIF = [
  [0, 1], [7, 1], [12, 2],
  [13, 1], [12, 1], [10, 2],
  [7, 1.5], [8, .5], [7, 1], [3, 1],
  [0, 4],
  [0, 1], [7, 1], [12, 1], [15, 1],
  [13, 2], [12, 1], [10, 1],
  [8, 1], [7, 1], [5, 1], [3, 1],
  [1, 2], [0, 2]
];

/** Motif notes that start in bar `bar` (0-7): [semi, beatOffset, beats]. */
export function motifBar(bar) {
  const out = [];
  let beat = 0;
  for (const [semi, len] of MOTIF) {
    if (Math.floor(beat / 4) === bar % 8 && semi !== null) out.push([semi, beat % 4, len]);
    beat += len;
  }
  return out;
}

export const MODES = new Set(["title", "run", "debrief", "over"]);

/**
 * Layer levels and arrangement switches for a mode at intensity i (0..1).
 * Run mode is the stealth arrangement that builds with danger.
 */
export function arrangement(mode, i, mood) {
  if (mood === "lost" || mode === "over") {
    return { pad: .1, bass: .08, drums: 0, hats: 0, arp: mood === "lost" ? 0 : .03, lead: 0, brass: 0, alarm: 0, filter: mood === "lost" ? 520 : 1600 };
  }
  if (mode === "title") {
    return { pad: .1, bass: .3, drums: .5, hats: .05, arp: .07, lead: .1, brass: .06, alarm: 0, filter: 4600 };
  }
  if (mode === "debrief") {
    return { pad: .13, bass: .12, drums: 0, hats: 0, arp: .05, lead: 0, brass: 0, alarm: 0, filter: 2200 };
  }
  // run
  return {
    pad: .05 + i * .04,
    bass: .14 + i * .18,
    drums: i >= .4 ? .4 + (i - .4) * .5 : 0,
    hats: .035 + i * .03,
    arp: i >= .15 ? .04 + i * .05 : 0,
    lead: 0,
    brass: i >= .5 ? .05 + (i - .5) * .12 : 0,
    alarm: i >= .85 ? .035 : 0,
    filter: 700 + i * i * 5500
  };
}
