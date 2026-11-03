// Loom's soundscape: soft, round "felt mallet" tones and a slow drone.
// Everything is synthesized; nothing is loaded.
//
// Phone speakers barely reproduce anything below ~400 Hz, so a tone built on
// a low fundamental is heard on a phone only through its overtones, which
// sounds thin and sharp. Each voice here is therefore two pure sines: a body
// an octave up (294-494 Hz, which phones play cleanly) and a quieter low
// octave beneath it that headphones and desktop speakers add as warmth.
// Nothing sounds above 600 Hz.
//
// Design rules (checked by tests/audio.test.js):
//  - pure sine waves only, no noise, nothing above 600 Hz
//  - every voice fades in over at least 80 ms and releases slowly
//  - tiers keep their color's note; a higher tier simply rings longer
//  - every kind of event lands at about the same loudness
//  - the ambient line follows a fixed sequence, never random jumps

// D major pentatonic, third octave: D3 E3 F#3 A3 B3 (the warm low layer).
export const NOTES = [146.83, 164.81, 185.0, 220.0, 246.94];
export const ENVELOPE = { attack: 0.09, release: 1.3 };
const TIER_RING = { 1: 1.3, 2: 1.9, 3: 2.6 };
export const freqFor = (color) => NOTES[color];
// A slow, stepwise line around the drone (D3 F#3 A3 B3 A3 F#3 E3 F#3).
export const AMBIENT_SEQUENCE = [146.83, 185.0, 220.0, 246.94, 220.0, 185.0, 164.81, 185.0];
// Higher notes carry further on small speakers, so they are played a little
// softer to keep every color equally loud.
const balance = f => Math.pow(NOTES[0] / f, 0.3);
const later = (fn, ms) => { const t = setTimeout(fn, ms); t?.unref?.(); return t; };

export class LoomAudio {
  constructor(settings, makeContext = null) {
    this.settings = settings;
    this.makeContext = makeContext || (() => {
      const C = globalThis.AudioContext || globalThis.webkitAudioContext;
      return C ? new C() : null;
    });
    this.ctx = null;
    this.active = 0;
    this.maxVoices = 6;
    this.ambient = null;
  }

  // Must be called from a user gesture (browsers keep audio locked until then).
  async unlock() {
    if (!this.ctx) {
      const ctx = this.makeContext();
      if (!ctx) return;
      this.ctx = ctx;
      // voices → bus → warm low-pass → compressor → limiter → master → out
      this.bus = ctx.createGain(); this.bus.gain.value = 0.9;
      this.tone = ctx.createBiquadFilter();
      this.tone.type = "lowpass"; this.tone.frequency.value = 1500; this.tone.Q.value = 0.5;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -30; this.comp.knee.value = 18; this.comp.ratio.value = 10;
      this.comp.attack.value = 0.05; this.comp.release.value = 0.5;
      this.limit = ctx.createDynamicsCompressor();
      this.limit.threshold.value = -6; this.limit.knee.value = 6; this.limit.ratio.value = 20;
      this.limit.attack.value = 0.005; this.limit.release.value = 0.2;
      this.master = ctx.createGain(); this.master.gain.value = 0;
      this.bus.connect(this.tone); this.tone.connect(this.comp); this.comp.connect(this.limit);
      this.limit.connect(this.master); this.master.connect(ctx.destination);
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

  level() { return this.settings.sound ? (this.settings.volume / 100) * 0.7 : 0; }

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

  // One soft voice: a body one octave above `base` plus `base` itself.
  voice(base, { peak = 0.12, attack = ENVELOPE.attack, release = ENVELOPE.release, delay = 0, warmth = 0.55 } = {}) {
    if (!this.ready || this.active >= this.maxVoices) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(Math.min(peak * balance(base), 0.2), t + Math.max(attack, 0.08));
    env.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    env.connect(this.bus);
    const oscs = [[2, 1], [1, warmth]].map(([mult, amp]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = base * mult; g.gain.value = amp;
      o.connect(g); g.connect(env);
      o.start(t); o.stop(t + attack + release + 0.05);
      return [o, g];
    });
    this.active++;
    later(() => {
      this.active = Math.max(0, this.active - 1);
      try { oscs.forEach(([o, g]) => { o.disconnect(); g.disconnect(); }); env.disconnect(); } catch { /* already gone */ }
    }, (delay + attack + release + 0.1) * 1000);
  }

  place(tile) { this.voice(freqFor(tile.c), { release: TIER_RING[tile.t] }); }
  // Picking a thread up is shown on screen; it makes no sound.
  tap() {}
  undo(tile) { if (tile) this.voice(freqFor(tile.c), { peak: 0.08, release: 1.0 }); }

  merge(source, target, result) {
    // One tone, a touch slower to bloom, ringing longer for higher tiers.
    this.voice(freqFor(result.c), { peak: 0.13, attack: 0.14, release: TIER_RING[result.t] + 0.4, warmth: 0.7 });
  }

  card() {
    // Two gentle notes rising a fifth (D then A), well spaced.
    this.voice(NOTES[0], { peak: 0.09, attack: 0.12, release: 1.6 });
    this.voice(NOTES[3], { peak: 0.09, attack: 0.12, release: 1.8, delay: 0.32 });
  }

  finish() {
    // D, F#, A placed one after another so they never arrive at once.
    [NOTES[0], NOTES[2], NOTES[3]].forEach((f, i) =>
      this.voice(f, { peak: 0.08, attack: 0.25, release: 3.2, delay: i * 0.4, warmth: 0.7 }));
  }

  // Ambient: a low D/A drone that breathes slowly, with one quiet note of
  // a fixed line every few seconds. Fades in and out over several seconds.
  startAmbient() {
    if (!this.ready || this.ambient) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const pad = ctx.createGain();
    pad.gain.setValueAtTime(0.0001, t);
    pad.gain.linearRampToValueAtTime(0.035, t + 6);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 0.3;
    pad.connect(lp); lp.connect(this.bus);
    // D3 and A3 with a faint D4 so a phone hears the drone too.
    const drones = [[146.83, 0.8], [220, 0.45], [293.66, 0.35]].map(([f, amp], i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f; o.detune.value = i % 2 ? 3 : -3; g.gain.value = amp;
      o.connect(g); g.connect(pad); o.start(t);
      return o;
    });
    // very slow breathing (one cycle every ~25 s)
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.type = "sine"; lfo.frequency.value = 0.04; depth.gain.value = 0.01;
    lfo.connect(depth); depth.connect(pad.gain); lfo.start(t);
    let step = 0;
    const playNext = () => {
      this.voice(AMBIENT_SEQUENCE[step % AMBIENT_SEQUENCE.length], { peak: 0.035, attack: 1.5, release: 5 });
      step++;
    };
    const timer = setInterval(playNext, 6000);
    timer?.unref?.();
    later(playNext, 2500);
    this.ambient = { pad, lp, drones, lfo, depth, timer };
  }

  stopAmbient() {
    const a = this.ambient;
    if (!a) return;
    this.ambient = null;
    clearInterval(a.timer);
    const t = this.ctx.currentTime;
    a.pad.gain.cancelScheduledValues(t);
    a.pad.gain.setTargetAtTime(0.0001, t, 1);
    later(() => {
      try { [...a.drones, a.lfo].forEach(o => o.stop()); a.pad.disconnect(); a.lp.disconnect(); a.depth.disconnect(); } catch { /* fine */ }
    }, 4000);
  }
}
