/* ZzFX patch table for Dronesweeper SFX (data only). Each patch is rendered once to a buffer and
 * re-pitched with playbackRate. Same idea as Slotchinko's ZP table, new sounds.
 * Param order: [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide,
 *   deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay,
 *   sustainVolume, decay, tremolo, filter]
 * shape: 0 sine, 1 triangle, 2 saw, 3 tan, 4 noise, 5 square. filter > 0 high-pass, < 0 low-pass.
 * randomness is 0 everywhere so the tests and the mix are repeatable. */
export const PATCHES = {
  // Sensors and scanning
  chirp:   [1, 0, 1200, .002, .012, .06, 0, 1, 0, 0, 600, .025],                      // crisp sensor chirp (pitch hop up)
  scan:    [1, 0, 320, .01, .1, .1, 2, 1, 38, 0, 0, 0, 0, 0, 0, 0, 0, .55, 0, 0, -2600],  // rising scanner sweep
  clearOk: [1, 0, 880, .002, .03, .08, 1, 1, 0, 0, 440, .05],                         // two-step "all clear" blip
  // Threat signatures (probe readouts, triggers)
  buzz:    [1, 0, 220, .005, .12, .1, 2, 1, 0, 0, 0, 0, 0, 0, 40, 0, 0, .7, 0, 0, -1800], // hazard: modulated buzz
  alert:   [1, 0, 660, .003, .06, .05, 5, .5, 0, 0, -165, .07],                       // hostile: two-tone drop
  clack:   [1, 0, 500, 0, .01, .03, 4, 1, 0, 0, 0, 0, .05, 0, 0, 0, 0, 1, 0, 0, 1200],    // trap: click-clack
  wobble:  [1, 0, 520, .01, .15, .2, 0, 1, 0, 0, 0, 0, 0, 0, 9, 0, 0, .8],               // anomaly: warbling sine
  crackle: [1, 0, 900, 0, .08, .12, 4, 1, 0, 0, 0, 0, 0, .6, 0, .3, 0, .8, 0, 0, -6000],  // emp: bit-crushed static
  flutter: [1, 0, 300, .01, .15, .1, 4, 1, 0, 0, 0, 0, .03, .4, 0, 0, 0, .7, 0, .5, 800],  // swarm: fluttering hiss
  stab:    [1, 0, 330, .002, .04, .12, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -2000],  // something went off
  // Damage and squad
  impact:  [1, 0, 150, .002, .03, .2, 2, 1, -6, 0, 0, 0, 0, .5, 0, 0, 0, 1, 0, 0, -2400], // punchy thud with a gritty edge
  ping:    [1, 0, 1500, .001, .01, .3, 0, 1, 0, 0, 0, 0, 0, 0, 40, 0, 0, 1],             // armor: metallic ping
  down:    [1, 0, 900, .005, .2, .4, 5, .5, -6, 0, 0, 0, 0, 0, 0, .15, 0, .7, 0, 0, -4000],  // unit power-down
  // Clearing
  zap:     [1, 0, 700, .002, .05, .18, 5, .5, -14, 0, 0, 0, 0, 0, 0, 0, 0, .8, 0, 0, -4000],  // disable: power-down zap
  crunch:  [1, 0, 320, .002, .06, .18, 4, 1, -2, 0, 0, 0, 0, .8, 0, .2, 0, .8, 0, 0, -4200],  // push: debris crunch
  snip:    [1, 0, 1600, 0, .005, .04, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 3000],     // defuse: wire snip
  chime:   [1, 0, 1320, .003, .04, .35, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, .06],              // reward chime with echo
  // Movement and turns
  whirr:   [1, 0, 240, .01, .06, .06, 2, 1, 6, 0, 0, 0, 0, 0, 0, 0, 0, .5, 0, 0, -1400],   // drone move
  servo:   [1, 0, 300, .004, .04, .05, 5, .3, 8, 0, 0, 0, 0, .1, 0, 0, 0, .6, 0, 0, -3000], // patrol step
  thruster:[1, 0, 80, .25, .3, .4, 4, 1, 4, 0, 0, 0, 0, .3, 0, 0, 0, .8, 0, 0, -1800],    // extract lift-off
  beep:    [1, 0, 1760, .003, .05, .04, 0, 1],                                          // comms beep
  // Interface
  tick:    [1, 0, 2400, 0, 0, .02, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1800],      // Slotchinko's reel click
  flag:    [1, 0, 900, .002, .01, .05, 1, 1, 0, 0, 300, .03],                            // marker tick
  deny:    [1, 0, 220, .003, .05, .04, 5, .5, 0, 0, 0, 0, .08, 0, 0, 0, 0, .8, 0, 0, -2400]   // refused: double buzz
};

// Per-patch level trims so every patch lands at the same RMS before the cue's own velocity.
// Measured offline with `node tools/measure-sfx.mjs` (target RMS 0.25); rerun after editing a patch.
export const LEVELS = {
  chirp: .53, scan: .81, clearOk: .61, buzz: .76, alert: .3, clack: .46, wobble: .56, crackle: .44,
  flutter: .88, stab: .58, impact: .7, ping: .6, down: .44, zap: .44, crunch: .57, snip: .48,
  chime: 1.3, whirr: .95, servo: .5, thruster: .81, beep: .43, tick: .53, flag: .65, deny: .37
};

/** Semitone offset to playbackRate. */
export const semis = s => Math.pow(2, s / 12);
