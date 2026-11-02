/* Dronesweeper sound engine. Ported from Slotchinko's sound.js: procedural ZzFX SFX plus adaptive
 * Web Audio music (music.js), no audio files. Same output chain, buses, voice pool, mute and volume
 * design. Changes from the original: ES module with its environment injected (so it runs under
 * node --test with a fake AudioContext), Dronesweeper storage keys, and the Slotchinko-only cues
 * replaced by a patch table (sfx.js) played through the same zplay() path. Game hookup is the event
 * bus (cues.js / hooks.js), not prototype wrapping, so game logic stays untouched either way. */
import { ZZFX } from "./vendor/zzfx/zzfx-build.js";
import { PATCHES, LEVELS } from "./sfx.js";

export const MUTE_KEY = "dronesweeper-muted", VOLUME_KEY = "dronesweeper-audio";
// Volume sliders scale the tuned bus levels; 1 (100%) is the mix as designed.
// Balanced against the score with tools in docs/AUDIO.md: gameplay effects land ~+4 to +9 dB over
// in-run music in the 300 Hz-5 kHz band a phone speaker reproduces.
export const BASE = { music: 0.26, sfx: 1.1 };
const MASTER = 0.35, MAX_VOICES = 6;
const clamp = v => Math.min(1, Math.max(0, Number(v) || 0));

export function createSound(env = {}) {
  const AC = env.AudioContext ?? globalThis.AudioContext ?? globalThis.webkitAudioContext;
  const store = env.storage ?? globalThis.localStorage;
  const doc = env.document ?? globalThis.document;
  const makeMusic = env.music ?? null;
  const read = k => { try { return store?.getItem(k) ?? null; } catch { return null; } };
  const write = (k, v) => { try { store?.setItem(k, v); } catch { /* private mode */ } };

  function readVolume() {
    try {
      const d = JSON.parse(read(VOLUME_KEY));
      if (d && typeof d === "object") return { music: d.music === undefined ? 1 : clamp(d.music), sfx: d.sfx === undefined ? 1 : clamp(d.sfx) };
    } catch { /* bad or missing save: defaults */ }
    return { music: 1, sfx: 1 };
  }

  let volume = readVolume(), muted = read(MUTE_KEY) === "1";
  let ctx = null, master, sfx, mus, sting, duckGain, music = null;
  const Z = {};
  const active = [], lastHit = new Map(), log = [], listeners = new Set();
  const hidden = () => Boolean(doc?.hidden);

  function init() {
    if (ctx) return ctx;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 9000; lp.Q.value = 0.3;
    master = ctx.createGain(); master.gain.value = muted ? 0 : MASTER;
    // Brick-wall limiter last in the chain so stacked sounds can never clip the output.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.1;
    const mk = ctx.createGain(); mk.gain.value = 1.3 / Math.tanh(1.3); // same small-signal level as Slotchinko's soft-clip curve
    lp.connect(comp).connect(mk).connect(master);
    master.connect(limiter).connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = BASE.sfx * volume.sfx; sfx.connect(lp);
    // Music runs through a duck stage so big moments can dip it without touching the user's volume.
    duckGain = ctx.createGain(); duckGain.gain.value = 1; duckGain.connect(lp);
    mus = ctx.createGain(); mus.gain.value = BASE.music * volume.music; mus.connect(duckGain);
    // Music-engine stingers are effects: they follow the Effects volume.
    sting = ctx.createGain(); sting.gain.value = 0.9 * BASE.music * volume.sfx; sting.connect(lp);
    ZZFX.sampleRate = ctx.sampleRate;
    prewarm();
    if (makeMusic) music = makeMusic(ctx, mus, null, { out: sting, on: () => !muted && volume.sfx > 0 });
    return ctx;
  }

  // Patches render lazily (first use) and pre-warm one at a time in the background, so the first
  // tap never pays for rendering all of them at once (~0.3 s on a throttled phone CPU).
  function patch(name) {
    if (!Z[name] && PATCHES[name]) {
      const d = ZZFX.buildSamples(...PATCHES[name]), b = ctx.createBuffer(1, Math.max(1, d.length), ctx.sampleRate);
      b.getChannelData(0).set(d); Z[name] = b;
    }
    return Z[name];
  }
  function prewarm() {
    const queue = Object.keys(PATCHES);
    const step = () => { const name = queue.shift(); if (!name) return; patch(name); setTimeout(step, 40); };
    setTimeout(step, 400);
  }

  function unlock() {
    if (!init()) return;
    if (ctx.state === "suspended") ctx.resume?.();
    if (music && !music.state.running && !hidden()) music.start();
  }

  function onVisibility() {
    if (!ctx) return;
    if (hidden()) { ctx.suspend?.(); }
    else if (!muted) { ctx.resume?.(); }
  }

  function ramp(param, value, tc = 0.03) {
    if (!ctx || !param) return;
    param.cancelScheduledValues(ctx.currentTime); param.setTargetAtTime(value, ctx.currentTime, tc);
  }

  function setMuted(m) {
    muted = Boolean(m); write(MUTE_KEY, muted ? "1" : "0");
    if (ctx) ramp(master.gain, muted ? 0 : MASTER, 0.08);
    emitChange();
  }
  function setVolume(kind, v) {
    if (!(kind in BASE)) return;
    volume[kind] = clamp(v);
    write(VOLUME_KEY, JSON.stringify(volume));
    if (ctx) {
      ramp((kind === "sfx" ? sfx : mus).gain, BASE[kind] * volume[kind]);
      if (kind === "sfx") ramp(sting.gain, 0.9 * BASE.music * volume.sfx);
    }
    emitChange();
  }
  function emitChange() { for (const fn of listeners) fn({ muted, volume: { ...volume } }); }

  /** Dip the music by `amount` (0..1) for `seconds`, then recover. Used under big moments. */
  function duck(amount = 0.5, seconds = 1.2) {
    if (!ctx) return;
    const g = duckGain.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(1 - amount, now, 0.04);
    g.setTargetAtTime(1, now + seconds, 0.35);
  }

  const ok = () => Boolean(ctx) && !muted && volume.sfx > 0 && !hidden() && ctx.state === "running";

  // Voice pool: at most MAX_VOICES sfx at once; the oldest fades out quickly to make room.
  function addVoice(src, g, at, peak) {
    const v = { src, g, at, peak }; active.push(v);
    src.onended = () => { const i = active.indexOf(v); if (i >= 0) active.splice(i, 1); };
    while (active.length > MAX_VOICES) steal(active.shift());
  }
  function steal(v) {
    const now = ctx.currentTime, p = v.g.gain;
    if (v.at > now) { p.cancelScheduledValues(now); p.setValueAtTime(0, now); try { v.src.stop(now); } catch { /* stopped */ } return; }
    // Hold the envelope where it is. Never read p.value (it can still be the node default of 1.0).
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(now);
    else { p.cancelScheduledValues(now); p.setValueAtTime(Math.min(p.value, v.peak), now); }
    p.linearRampToValueAtTime(0, now + 0.015);
    try { v.src.stop(now + 0.02); } catch { /* already stopped */ }
  }

  /** Play a pre-rendered ZzFX patch. rate re-pitches it (target Hz / base Hz). */
  function play(name, { t = 0, vel = 0.1, rate = 1, pan = 0 } = {}) {
    if (!ok() || !PATCHES[name]) return false;
    vel *= LEVELS[name] ?? 1;
    const buf = patch(name), at = ctx.currentTime + t, key = name + Math.round(rate * 1000), prev = lastHit.get(key);
    if (prev !== undefined && Math.abs(at - prev) < 0.03) return false; // same sound retriggered within 30 ms
    lastHit.set(key, at);
    vel *= Math.min(1, Math.sqrt(2 / (active.length + 1))); // keep stacked voices from summing hot
    const s = ctx.createBufferSource(), g = ctx.createGain(), end = at + buf.duration / rate;
    s.buffer = buf; s.playbackRate.value = rate;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vel, at + 0.005);
    g.gain.setValueAtTime(vel, Math.max(at + 0.005, end - 0.01)); g.gain.linearRampToValueAtTime(0, end + 0.005);
    let node = s.connect(g);
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(sfx); s.start(at); s.stop(end + 0.02); addVoice(s, g, at, vel);
    log.push({ name, t, vel, rate, pan }); if (log.length > 64) log.shift();
    return true;
  }

  return {
    init, unlock, onVisibility, play, duck, setMuted, setVolume,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get ctx() { return ctx; }, get music() { return music; }, get muted() { return muted; },
    get volume() { return { ...volume }; }, get voices() { return active.length; }, get log() { return log; },
    get nodes() { return { sfx, music: mus, master, stingers: sting, duck: duckGain }; }
  };
}
