// Loom's soundscape: warm notes that swell in and fade slowly, in a soft room,
// and a sound that follows the weaving. Everything is synthesized; nothing is loaded.
//
// A note has no strike. It rises over about a fifth of a second, like a hummed
// note or a soft organ pipe, and then fades for a second or more. It is built
// from three pure sines:
//  - the pitch itself, 294-494 Hz, a range every speaker plays cleanly
//  - a little of the octave above, so the note is a tone and not a beep
//  - a quieter octave below, which headphones and larger speakers add as warmth
// A short, dark room (a generated reverb) gives each note a tail, so it fades
// into space instead of stopping.
//
// The sound reacts to play in three ways:
//  - the cloth hums back: the optional background is made from the colours on
//    the board. An empty loom is silent; the hum fills out as the cloth does
//  - the finished piece plays itself: the cloth is read row by row as a tune
//  - it follows the pace: unhurried play rings longer, quick taps are shorter
//    and softer so they never pile up
//
// Nothing may sound discordant. Every pitch comes from one five-note scale
// (D E F# A B), which has no half steps. The only close intervals left in it
// are the whole steps D-E, E-F# and A-B, and two notes a whole step apart are
// never held together:
//  - when a new note is a whole step from one still ringing, the earlier note
//    steps aside (fades quickly) instead of smearing into it
//  - the hum sounds one "family" of colours at a time and no family contains a
//    whole step; it moves between families through a shared note, letting the
//    old notes go before the new ones arrive
//  - a hum voice a whole step from a note dips until that note has faded
//  - a weave adds a second note a fifth or a fourth above, from the same scale
//
// Other rules (all checked by tests/loom/audio.test.mjs):
//  - sine waves only; every part of a note starts from silence and swells in
//  - nothing bright: the whole mix passes a 3 kHz low-pass
//  - a colour keeps its note at every tier; a higher tier fades more slowly
//  - the same colour twice in a row is softer the second time, and the earlier
//    note hands over to the new one, as a string does when plucked twice
//  - no compressor: quiet sounds are never turned up. One limiter sits at the
//    end as a safety net and does nothing at normal levels

// D major pentatonic: D4 E4 F#4 A4 B4, one note per colour.
export const NOTES = [293.66, 329.63, 369.99, 440.0, 493.88];
export const freqFor = (color) => NOTES[color];
// [multiple of the pitch, loudness relative to the pitch]
export const PARTIALS = [[1, 1], [2, 0.10], [0.5, 0.38]];
// `swell` is the time constant of the rise: 63% of full level after this long, 95% after three times it.
export const ENVELOPE = { swell: 0.07, settle: 0.2, fade: 1.0 };
// The second note of a weave, per colour: [its colour, its pitch]. D>A, E>B, F#>B, A>E, B>F#.
export const PARTNERS = [[3, 440.0], [4, 493.88], [4, 493.88], [1, 659.26], [2, 739.99]];
// The hum's pitch for each colour (D4 E5 F#5 A4 B4), spaced widely so its chords are open.
export const HUM_PITCH = [293.66, 659.26, 739.99, 440.0, 493.88];
// Colours the hum may sound together: D F# A, D F# B, B E, A E. Neighbours share a note.
export const FAMILIES = [[0, 2, 3], [0, 2, 4], [4, 1], [3, 1]];
// The finished-piece tune: seconds per square, the pause after each row, and the pause before it starts.
export const TUNE = { step: 0.34, breath: 0.4, lead: 0.8 };
const STEPS = new Set(["0,1", "1,0", "1,2", "2,1", "3,4", "4,3"]);
/** True when two colours' notes are a whole step apart: the one interval that must never be held. */
export const isStep = (a, b) => STEPS.has(`${a},${b}`);

const PEAK = 0.058;      // level of the pitch partial of a full note, before the master volume
const ROOM = { seconds: 2.4, cutoff: 1800, mix: 0.38 };
const OUTPUT = 2.0;      // master gain at volume 100; the default volume is 30
const HUM = { level: 0.028, cutoff: 1000, drift: 16, breath: [13, 17, 19, 23, 29] };
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const later = (fn, ms) => { const t = setTimeout(fn, ms); t?.unref?.(); return t; };

// The room: two channels of fading, low-passed noise. It builds over 30 ms, so it
// has no slap, and the fixed seed makes it the same room every time.
function roomImpulse(ctx) {
  const sr = ctx.sampleRate, n = Math.floor(ROOM.seconds * sr), buf = ctx.createBuffer(2, n, sr);
  const smooth = Math.exp(-2 * Math.PI * ROOM.cutoff / sr);
  let s = 7;
  const rand = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1;
  };
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      y = (1 - smooth) * rand() + smooth * y;
      d[i] = y * Math.min(1, t / 0.03) * Math.exp(-t * 6.9 / ROOM.seconds);
    }
  }
  return buf;
}

export class LoomAudio {
  constructor(settings, makeContext = null) {
    this.settings = settings;
    this.makeContext = makeContext || (() => {
      const C = globalThis.AudioContext || globalThis.webkitAudioContext;
      return C ? new C() : null;
    });
    this.ctx = null;
    this.maxVoices = 12;
    this.voices = [];        // when each note can be heard: { from, until }
    this.ringing = [];       // recent notes: { t, color, f, gains, oscs, gone }
    this.lastColor = null;
    this.lastAt = -99;
    // the hum
    this.hum = null;
    this.humOn = false;
    this.weights = [0, 0, 0, 0, 0];
    this.family = 0;
    this.arriveAt = [0, 0, 0, 0, 0];
    this.dips = [[], [], [], [], []];
  }

  // Must be called from a user gesture (browsers keep audio locked until then).
  async unlock() {
    if (!this.ctx) {
      const ctx = this.makeContext();
      if (!ctx) return;
      this.ctx = ctx;
      // notes → bus → low-pass → (direct + room) → master → safety limiter → out
      this.bus = ctx.createGain();
      this.tone = ctx.createBiquadFilter();
      this.tone.type = "lowpass"; this.tone.frequency.value = 3000; this.tone.Q.value = 0.5;
      this.room = ctx.createConvolver(); this.room.buffer = roomImpulse(ctx);
      this.roomLevel = ctx.createGain(); this.roomLevel.gain.value = ROOM.mix;
      this.master = ctx.createGain(); this.master.gain.value = 0;
      // The limiter comes last, after the volume. A threshold close to full scale
      // means it adds almost no gain of its own and only acts on a peak that
      // would otherwise clip.
      this.limit = ctx.createDynamicsCompressor();
      this.limit.threshold.value = -1; this.limit.knee.value = 0; this.limit.ratio.value = 20;
      this.limit.attack.value = 0.003; this.limit.release.value = 0.25;
      this.bus.connect(this.tone);
      this.tone.connect(this.master);
      this.tone.connect(this.room); this.room.connect(this.roomLevel); this.roomLevel.connect(this.master);
      this.master.connect(this.limit); this.limit.connect(ctx.destination);
      // The very first sound fades in over 1.5 s rather than starting abruptly.
      this.master.gain.setValueAtTime(0, ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(this.level(), ctx.currentTime + 1.5);
      this.fresh = true;
    }
    if (this.ctx.state !== "running" && this.settings.sound) {
      try { await this.ctx.resume(); } catch { /* the browser refused; stay quiet */ }
    }
    if (!this.fresh) this.setVolume();
    this.fresh = false;
  }

  level() { return this.settings.sound ? (this.settings.volume / 100) * OUTPUT : 0; }

  setVolume() {
    if (!this.ctx) return;
    // Volume changes glide over ~0.3 s so a slider never causes a jump.
    this.master.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.1);
  }

  async mute(muted) {
    this.settings.sound = !muted;
    if (!this.ctx) return;
    this.setVolume();
    if (muted) later(() => { if (!this.settings.sound) this.ctx.suspend().catch(() => {}); }, 600);
    else { await this.ctx.resume().catch(() => {}); this.setVolume(); }
  }

  get ready() { return Boolean(this.ctx && this.settings.sound); }

  /** How many notes can be heard at time `t` (now, by default). */
  heardAt(t = this.ctx?.currentTime ?? 0) { return this.voices.filter(v => v.from <= t && t < v.until).length; }
  get active() { return this.heardAt(); }

  // ---- notes -------------------------------------------------------------

  // One note at pitch `f`. It swells in, holds for `hold` seconds, then fades with
  // time constant `fade` (about a third of its level is left after that long).
  // Returns its parts, or null if it was not played.
  note(f, { level = 1, hold = 0.25, fade = ENVELOPE.fade, swell = ENVELOPE.swell, delay = 0 } = {}) {
    if (!this.ready) return null;
    const ctx = this.ctx, now = ctx.currentTime, t = now + delay;
    const release = t + ENVELOPE.settle + hold, end = release + fade * 7;
    // A note counts toward the limit while it can be heard (three fade times).
    this.voices = this.voices.filter(v => v.until > now);
    if (this.heardAt(t) >= this.maxVoices) return null;
    this.voices.push({ from: t, until: release + fade * 3 });
    const gains = [], oscs = [];
    for (const [mult, amp] of PARTIALS) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f * mult;
      // Silent until told otherwise, so nothing can ever start at full level.
      g.gain.value = 0;
      g.gain.setValueAtTime(0, t);
      g.gain.setTargetAtTime(PEAK * level * amp, t, swell);
      g.gain.setTargetAtTime(0, release, fade);
      o.connect(g); g.connect(this.bus);
      o.start(t); o.stop(end);
      gains.push(g); oscs.push(o);
    }
    later(() => {
      try { oscs.forEach(o => o.disconnect()); gains.forEach(g => g.disconnect()); } catch { /* already gone */ }
    }, (end - now + 0.1) * 1000);
    return { gains, oscs };
  }

  // Fades a note out from time `t`, replacing whatever it was going to do after that.
  release(r, t, quick) {
    r.gone = true;
    for (const g of r.gains) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, quick); }
  }

  // A note that belongs to a colour. This is where "never discordant" is enforced:
  // a note a whole step away steps aside, the same note hands over, and the hum makes room.
  sound(color, f, opts = {}) {
    if (!this.ready) return null;
    const now = this.ctx.currentTime, t = now + (opts.delay || 0);
    this.ringing = this.ringing.filter(r => r.t > now - 8);
    const meets = r => !r.gone && (isStep(r.color, color) || (r.color === color && r.f === f));
    for (const r of this.ringing) {
      if (r.t <= t && meets(r)) this.release(r, t, isStep(r.color, color) ? 0.1 : 0.22);
    }
    if (this.humOn) {
      const until = t + 0.3 + Math.min(5, (opts.fade ?? ENVELOPE.fade) * 3);
      let dipped = false;
      for (let c = 0; c < 5; c++) if (isStep(c, color)) { this.addDip(c, t, until); dipped = true; }
      if (dipped) this.steerHum();
    }
    const made = this.note(f, opts);
    if (!made) return null;
    const mine = { t, color, f, ...made, gone: false };
    // A note already scheduled to start later takes over from this one when it arrives.
    const next = this.ringing.filter(r => r.t > t && meets(r)).sort((a, b) => a.t - b.t)[0];
    if (next) this.release(mine, next.t, isStep(next.color, color) ? 0.1 : 0.22);
    this.ringing.push(mine);
    return made;
  }

  // How unhurried the player is: `calm` is 0 for quick taps and 1 after a pause of
  // 2.5 s or more; `soft` turns quick taps down.
  pace() {
    const now = this.ctx?.currentTime ?? 0, dt = now - this.lastAt;
    this.lastAt = now;
    return { calm: clamp((dt - 0.35) / 2.15, 0, 1), soft: 0.6 + 0.4 * clamp((dt - 0.3) / 0.9, 0, 1) };
  }

  place(tile) {
    if (!this.ready) return;
    const { calm, soft } = this.pace();
    const again = tile.c === this.lastColor;
    this.lastColor = tile.c;
    this.sound(tile.c, freqFor(tile.c), {
      level: (again ? 0.75 : 1) * soft,
      fade: (0.8 + tile.t * 0.2) * (0.55 + 0.75 * calm),
      hold: 0.05 + 0.15 * calm
    });
  }
  // Picking a thread up is shown on screen; it makes no sound.
  tap() {}
  undo(tile) {
    if (!tile) return;
    this.lastColor = null;
    this.sound(tile.c, freqFor(tile.c), { level: 0.55, fade: 0.7, hold: 0.05 });
  }

  merge(source, target, result) {
    if (!this.ready) return;
    // The colour's note, then a quieter fifth or fourth above it a quarter of a second later.
    const { calm, soft } = this.pace();
    this.lastColor = null;
    const fade = (1.2 + result.t * 0.3) * (0.7 + 0.5 * calm);
    const [partnerColor, partnerPitch] = PARTNERS[result.c];
    this.sound(result.c, freqFor(result.c), { level: soft, fade, hold: 0.3 });
    this.sound(partnerColor, partnerPitch, { level: 0.5 * soft, fade: fade + 0.1, hold: 0.3, delay: 0.25 });
  }

  card() {
    // Two gentle notes rising a fifth (D then A), after the move that completed the pattern.
    this.sound(0, NOTES[0], { level: 0.7, fade: 1.6, delay: 0.45 });
    this.sound(3, NOTES[3], { level: 0.65, fade: 1.8, delay: 0.9 });
  }

  // The finished piece plays itself. The cloth is read like a page: left to right,
  // top row first, five squares and then a breath. An empty square is a rest.
  // It ends on D then A, the home notes, so every tune comes to rest.
  // Returns how long the tune lasts, in seconds.
  finish(cells = []) {
    if (!this.ready) return 0;
    let when = TUNE.lead, prev = null;
    for (let i = 0; i < 25 && cells.length; i++) {
      const tile = cells[i];
      if (tile) {
        this.sound(tile.c, freqFor(tile.c), {
          level: (0.5 + 0.06 * tile.t) * (prev === tile.c ? 0.8 : 1),
          fade: 0.4 + 0.1 * tile.t, hold: 0, delay: when
        });
        prev = tile.c;
      }
      when += TUNE.step + (i % 5 === 4 ? TUNE.breath : 0);
    }
    this.sound(0, NOTES[0], { level: 0.62, fade: 2.2, hold: 0.5, delay: when + 0.2 });
    this.sound(3, NOTES[3], { level: 0.5, fade: 2.6, hold: 0.5, delay: when + 0.9 });
    return when + 0.9;
  }

  // Quietly ends whatever is sounding or still to come (a tune, a ringing note).
  // Called when a new piece starts.
  hush() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const r of this.ringing) {
      this.release(r, now, 0.15);
      for (const o of r.oscs) { try { o.stop(now + 1.2); } catch { /* already stopped */ } }
    }
    this.ringing = []; this.voices = [];
    this.dips = [[], [], [], [], []];
    this.lastColor = null;
    this.steerHum();
  }

  // ---- the cloth hums back ---------------------------------------------------

  // Tell the engine what is on the cloth. More of a colour, and finer weaves,
  // make that colour's voice fuller.
  setCloth(cells) {
    const sum = [0, 0, 0, 0, 0];
    for (const tile of cells) if (tile) sum[tile.c] += tile.t;
    this.weights = sum.map(s => Math.min(1, Math.sqrt(s / 6)));
    // If the family that has the floor is not on the cloth at all, hand over at once.
    if (!this.present(this.family)) {
      const next = this.nextFamily();
      if (next !== undefined) this.family = next;
    }
    this.steerHum();
  }
  present(family) { return FAMILIES[family].some(c => this.weights[c] > 0); }
  nextFamily() { return [1, 2, 3].map(k => (this.family + k) % FAMILIES.length).find(f => this.present(f)); }

  // Every so often the hum moves to the next family that is on the cloth. The
  // notes that are leaving go first; the new ones arrive four seconds later.
  drift() {
    const next = this.nextFamily();
    if (next === undefined) return;
    const now = this.ctx?.currentTime ?? 0, from = FAMILIES[this.family];
    for (const c of FAMILIES[next]) if (!from.includes(c)) this.arriveAt[c] = now + 4;
    this.family = next;
    this.steerHum();
  }

  // A hum voice stays silent between `from` and `until` to make room for a note.
  addDip(c, from, until) {
    const rest = [];
    for (const d of this.dips[c]) {
      if (d[1] < from || d[0] > until) rest.push(d);
      else { from = Math.min(from, d[0]); until = Math.max(until, d[1]); }
    }
    rest.push([from, until]);
    this.dips[c] = rest.sort((a, b) => a[0] - b[0]);
  }

  // Sets every hum voice from the current state: whether the hum is on, the cloth,
  // the family that has the floor, voices still waiting to arrive, and dips.
  steerHum() {
    if (!this.hum) return;
    const now = this.ctx.currentTime, family = FAMILIES[this.family];
    for (let c = 0; c < 5; c++) {
      const g = this.hum[c].gain, want = this.humOn && family.includes(c) ? this.weights[c] : 0;
      g.cancelScheduledValues(now);
      this.dips[c] = this.dips[c].filter(d => d[1] > now);
      if (want === 0) { g.setTargetAtTime(0, now, 1.4); continue; }
      const arrive = Math.max(now, this.arriveAt[c]);
      if (this.dips[c].some(d => d[0] <= now)) g.setTargetAtTime(0, now, 0.15);
      else g.setTargetAtTime(want, arrive, arrive > now ? 2.5 : 1.5);
      for (const [from, until] of this.dips[c]) {
        if (from > now) g.setTargetAtTime(0, from, 0.15);
        g.setTargetAtTime(want, Math.max(until, arrive), 1.5);
      }
    }
  }

  // One quiet voice per colour, each breathing on its own slow cycle. The cycles
  // have different lengths, so the hum never repeats and has no beat.
  buildHum() {
    const ctx = this.ctx, t = ctx.currentTime, sources = [];
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = HUM.cutoff; lp.Q.value = 0.4;
    const level = ctx.createGain(); level.gain.value = HUM.level;
    lp.connect(level); level.connect(this.bus);
    this.hum = HUM_PITCH.map((f, i) => {
      const voice = ctx.createGain(); voice.gain.value = 0;
      const breath = ctx.createGain(); breath.gain.value = 0.72;
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.type = "sine"; lfo.frequency.value = 1 / HUM.breath[i]; depth.gain.value = 0.28;
      lfo.connect(depth); depth.connect(breath.gain); lfo.start(t); sources.push(lfo);
      // Higher notes carry further, so they are played softer.
      const balance = Math.pow(HUM_PITCH[0] / f, 0.7);
      for (const [mult, amp] of [[1, 1], [0.5, 0.45]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = f * mult; g.gain.value = amp * balance;
        o.connect(g); g.connect(breath); o.start(t); sources.push(o);
      }
      breath.connect(voice); voice.connect(lp);
      return voice;
    });
    this.humParts = { sources, lp, level };
  }

  startAmbient() {
    if (!this.ready || this.humOn) return;
    this.humOn = true;
    if (!this.hum) this.buildHum();
    this.steerHum();
    this.driftTimer = setInterval(() => this.drift(), HUM.drift * 1000);
    this.driftTimer?.unref?.();
  }

  stopAmbient() {
    if (!this.humOn) return;
    this.humOn = false;
    clearInterval(this.driftTimer);
    this.steerHum();   // every voice fades to silence
    const parts = this.humParts, voices = this.hum;
    later(() => {
      if (this.humOn || this.hum !== voices) return;   // turned back on in the meantime
      try { parts.sources.forEach(o => o.stop()); parts.level.disconnect(); parts.lp.disconnect(); } catch { /* fine */ }
      this.hum = null; this.humParts = null;
    }, 6000);
  }
}
