/* Adaptive music. Engine ported from Slotchinko's music.js (buses, pad chorus, ping-pong delay,
 * per-bar offline pre-rendering for phones, layer ramps); the composition is new (score.js).
 * API: createMusic(ctx, out, shared, fx) -> { start(), stop(), setIntensity(0..1), setMode(name),
 *   accent(type), renderTimeline(seconds, fn), state }
 * modes: title | run | debrief | over. accents: victory | complete | signalLost | reset | big */
import { BPM, PROGRESSION, MOTIF, MODES, motifBar, arrangement } from "./score.js";
import { makeVoices } from "./voices.js";

export { BPM, MOTIF, PROGRESSION, MODES };
export { SCALE } from "./score.js";
const LAYERS = ["pad", "bass", "drums", "hats", "arp", "lead", "brass", "alarm"];
const MOTIF_NOTES = MOTIF.filter(([s]) => s !== null).map(([s]) => s);

function build(ctx, out) {
  const bus = ctx.createGain(); bus.gain.value = 0.9; bus.connect(out);
  const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 1400; tone.Q.value = 0.5; tone.connect(bus);
  // pad chorus: short modulated delays L/R
  const padIn = ctx.createGain(), merger = ctx.createChannelMerger(2);
  [0, 1].forEach(ch => {
    const d = ctx.createDelay(0.05); d.delayTime.value = 0.012 + ch * 0.006;
    const lfo = ctx.createOscillator(), dep = ctx.createGain();
    lfo.frequency.value = 0.23 + ch * 0.11; dep.gain.value = 0.0025; lfo.connect(dep).connect(d.delayTime); lfo.start();
    padIn.connect(d); d.connect(merger, 0, ch);
  });
  const dry = ctx.createGain(); dry.gain.value = 0.6; padIn.connect(dry).connect(tone);
  const wet = ctx.createGain(); wet.gain.value = 0.55; merger.connect(wet).connect(tone);
  // ping-pong delay (dotted eighth) for arps and lead: the neon-grid echo
  const ppIn = ctx.createGain(), dl = ctx.createDelay(1), dr = ctx.createDelay(1), fb = ctx.createGain(), pm = ctx.createChannelMerger(2), damp = ctx.createBiquadFilter();
  dl.delayTime.value = dr.delayTime.value = (60 / BPM) * 0.75; fb.gain.value = 0.34; damp.type = "lowpass"; damp.frequency.value = 3000;
  ppIn.connect(dl); dl.connect(damp).connect(dr); dr.connect(fb).connect(dl); dl.connect(pm, 0, 0); dr.connect(pm, 0, 1);
  const ppWet = ctx.createGain(); ppWet.gain.value = 0.32; pm.connect(ppWet).connect(tone);
  const leadBus = ctx.createGain(); leadBus.connect(tone); leadBus.connect(ppIn);
  const layer = {};
  for (const k of LAYERS) { layer[k] = ctx.createGain(); layer[k].gain.value = 0; }
  layer.pad.connect(padIn); layer.brass.connect(padIn); layer.alarm.connect(tone);
  layer.bass.connect(tone); layer.drums.connect(bus); layer.hats.connect(bus);
  layer.arp.connect(leadBus); layer.lead.connect(leadBus);
  const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
  let seed = 7; for (let i = 0; i < nd.length; i++) { seed = (seed * 16807) % 2147483647; nd[i] = seed / 1073741823.5 - 1; }
  return { bus, tone, layer, noise: nb };
}

function create(ctx, out, shared, fx) {
  const n = build(ctx, out);
  const st = shared || { intensity: 0.1, target: 0.1, bar: 0, mode: "title", mood: "play", seed: 1, nextBar: 0, timer: null, running: false, voices: [], fq: 1400 };
  if (shared && st.lv) { for (const k in st.lv) n.layer[k].gain.value = st.lv[k]; n.tone.frequency.value = st.fq; }
  const rnd = () => { st.seed = (st.seed * 48271) % 2147483647; return st.seed / 2147483647; };
  const mark = name => st.voices.push(name);
  const v = makeVoices(ctx, n, rnd, mark);
  const beat = () => 60 / BPM;
  const FX = fx ? fx.out : n.bus, fxOn = () => !fx || fx.on();

  // Pre-render (default; ?music=live opts out): each bar plus its tails is rendered ahead in an
  // OfflineAudioContext with the same state, then played as one buffer (~1-3 sources on a phone).
  // Chunks go through a live low-pass so danger changes are heard at once, not 3 bars later.
  const PR = !shared && typeof location !== "undefined" && !/[?&]music=live(&|$)/.test(location.search) && typeof OfflineAudioContext !== "undefined";
  const PR_AHEAD = 3, PR_FADE = 0.015, PR_TAIL = 4.5;
  const live = ctx.createBiquadFilter(); live.type = "lowpass"; live.frequency.value = 18000; live.Q.value = 0.4; live.connect(out);
  let prBusy = false;
  function prPump() {
    if (!st.running || prBusy || st.nextBar > ctx.currentTime + PR_AHEAD * 4 * beat()) return;
    prBusy = true;
    const T = st.nextBar, barLen = 4 * beat(), sr = ctx.sampleRate;
    st.nextBar = T + barLen;
    const oc = new OfflineAudioContext(2, Math.ceil(sr * (barLen + PR_TAIL)), sr);
    create(oc, oc.destination, st).renderTimeline(0.05 + barLen - 0.001);
    oc.startRendering().then(buf => {
      const fl = Math.floor(sr * 0.1);
      for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < fl; i++) d[d.length - 1 - i] *= i / fl; }
      const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; s.connect(g).connect(live);
      const at = T - 0.05, now = ctx.currentTime;
      if (at >= now) s.start(at);
      else { g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + PR_FADE); s.start(now, now - at); st.late = (st.late || 0) + 1; }
      s.onended = () => { s.disconnect(); g.disconnect(); };
    }).catch(e => console.warn("[music] prerender failed", e)).finally(() => { prBusy = false; prPump(); });
  }
  function liveFilter() {
    if (!PR) return;
    const f = st.mode === "run" && st.mood !== "lost" ? 2400 + st.target * 15600 : 18000;
    live.frequency.cancelScheduledValues(ctx.currentTime); live.frequency.setTargetAtTime(f, ctx.currentTime, 0.4);
  }

  function setLayers(t, a) {
    const r = (k, val) => {
      const p = n.layer[k].gain;
      if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(st.lv?.[k] ?? p.value, t); }
      p.linearRampToValueAtTime(val, t + 1.2); (st.lv || (st.lv = {}))[k] = val;
    };
    for (const k of LAYERS) r(k, a[k]);
    const f = n.tone.frequency; f.cancelScheduledValues(t); f.setValueAtTime(st.fq, t); f.exponentialRampToValueAtTime(a.filter, t + 2); st.fq = a.filter;
  }

  function scheduleBar(t) {
    st.voices = [];
    const b = beat(), bar = st.bar, i = st.intensity = st.intensity + (st.target - st.intensity) * 0.6;
    const mode = st.mode, lost = st.mood === "lost", a = arrangement(mode, i, st.mood);
    const chord = PROGRESSION[bar % 8], root = chord[0];
    setLayers(t, a);
    // Pads: whole-bar chord (debrief and title lean on these).
    chord.forEach(s => v.pad(t, s, b * 3.7, 0.2, mode === "run" ? i * 0.6 : 0.7));
    if (lost) { st.bar++; return t + 4 * b; }
    // Pulse bass: eighths, sixteenth gallop as danger rises, octave hop on the last eighth.
    const calm = mode === "debrief" || mode === "over";
    if (calm) v.bass(t, root, b * 3.6, 0.5, 0.1);
    else {
      const gallop = mode === "title" || i > 0.5, steps = gallop ? [0, .5, .75, 1, 1.5, 1.75, 2, 2.5, 2.75, 3, 3.5, 3.75] : [0, .5, 1, 1.5, 2, 2.5, 3, 3.5];
      for (const s of steps) v.bass(t + s * b, root + (s === 3.5 && (i > 0.35 || mode === "title") ? 12 : 0), b * (gallop ? 0.22 : 0.42), s % 1 === 0 ? 0.8 : 0.55, mode === "title" ? 0.6 : i);
    }
    // Ticking sequencer: soft sixteenths, a little louder on the beat.
    if (mode === "run" || mode === "title") for (let s = 0; s < 4; s += 0.25) v.tick(t + s * b, (s % 1 === 0 ? 0.7 : 0.35) * (0.8 + rnd() * 0.2));
    // Percussion: kick and tight snare once danger rises (always in title), tom fills that vary.
    const drums = mode === "title" || (mode === "run" && i >= 0.4);
    if (drums) {
      const four = mode === "run" && i >= 0.7;
      for (let k = 0; k < 4; k++) if (k % 2 === 0 || four) v.kick(t + k * b, 0.85);
      if (mode === "title" || i >= 0.5) { v.snare(t + b, 0.3); v.snare(t + 3 * b, 0.35); }
      if (bar % 4 === 3 && rnd() > 0.3) {
        const pat = [[3, 0], [3.25, -3], [3.5, -5], [3.75, -7]].slice(Math.floor(rnd() * 2));
        for (const [at, s] of pat) v.tom(t + at * b, root + s, 0.5);
      }
    }
    // Arps: glassy chord tones two octaves up. Sparse in stealth, sixteenths at high danger or title.
    if (a.arp > 0) {
      const step = mode === "title" || i > 0.65 ? 0.25 : 0.5, tones = [...chord, chord[0] + 12];
      for (let x = 0, k = 0; x < 4; x += step, k++) {
        if (mode === "run" && i < 0.4 && k % 2 === 1) continue; // stealth: half the notes
        v.arp(t + x * b, tones[(k * (k % 3 === 2 ? 2 : 1)) % tones.length] + 24, step * b * 1.3, mode === "debrief" ? 0.35 : 0.5);
      }
    }
    // Lead: the briefing motif, title only.
    if (mode === "title") for (const [s, at, len] of motifBar(bar)) v.lead(t + at * b, s + 12, len * b * 0.95, 0.6);
    // Brass swells every other bar once things get serious (and opening each title phrase).
    if ((mode === "run" && i >= 0.5 && bar % 2 === 0) || (mode === "title" && bar % 4 === 0)) v.brass(t, [root, root + 7], b * 3.4, 0.5);
    if (mode === "run" && i >= 0.85) v.alarm(t, b, 0.5);
    if (mode === "run" && bar % 4 === 1) v.comms(t + 3.5 * b, 0.05);
    st.bar++;
    return t + 4 * b;
  }

  function sweep(t) {
    const f = n.tone.frequency; f.cancelScheduledValues(t); f.setValueAtTime(st.fq, t);
    f.exponentialRampToValueAtTime(7000, t + 0.35); f.exponentialRampToValueAtTime(Math.max(400, st.fq), t + 2.2);
  }
  function tick() { while (st.nextBar < ctx.currentTime + 0.4) st.nextBar = scheduleBar(Math.max(st.nextBar, ctx.currentTime + 0.05)); }

  const ACCENTS = {
    // "Mission accomplished": the motif's opening call, fast, landing on a bright E major (Picardy) chord.
    victory(t) {
      const notes = MOTIF_NOTES.slice(0, 3).concat([16, 19]);
      st.lastAccent = { type: "victory", notes };
      sweep(t);
      if (!fxOn()) return;
      notes.forEach((s, k) => v.arp(t + k * 0.1, s + 12, 0.9, 0.16, FX, "victory"));
      [0, 4, 7, 12].forEach(s => v.pad(t + 0.4, s, 1.6, 0.08, 0.9, FX));
    },
    // Full run cleared: the first two motif bars over a riser and a held chord.
    complete(t) {
      const notes = MOTIF_NOTES.slice(0, 6);
      st.lastAccent = { type: "complete", notes };
      sweep(t);
      if (!fxOn()) return;
      v.riser(t, FX, 0.6);
      notes.forEach((s, k) => v.lead(t + 0.6 + k * 0.16, s + 12, 0.3, 0.12, FX));
      [0, 4, 7, 11, 16].forEach(s => v.pad(t + 1.6, s, 2.4, 0.07, 0.9, FX));
    },
    // "Signal lost": everything powers down; the bed thins to a closed-filter pad.
    signalLost(t) {
      st.lastAccent = { type: "signalLost", notes: [] };
      st.mood = "lost"; st.mode = "over"; st.target = 0.05;
      setLayers(t, arrangement("over", 0, "lost"));
      if (fxOn()) v.powerDown(t, FX);
    },
    reset() { st.mood = "play"; st.target = 0.1; st.lastAccent = { type: "reset", notes: [] }; },
    big(t) { st.lastAccent = { type: "big", notes: [] }; sweep(t); if (fxOn()) v.riser(t, FX); }
  };

  const api = {
    get state() { return st; },
    start() {
      if (st.running) return;
      st.running = true; st.nextBar = ctx.currentTime + (PR ? 0.35 : 0.1);
      if (PR) { prPump(); st.timer = setInterval(prPump, 250); } else { tick(); st.timer = setInterval(tick, 100); }
    },
    stop() { st.running = false; clearInterval(st.timer); },
    setIntensity(val) { st.target = Math.max(0, Math.min(1, Number(val) || 0)); liveFilter(); },
    setMode(name) {
      if (!MODES.has(name)) return;
      if (name !== "over" && st.mood === "lost") st.mood = "play";
      st.mode = name; liveFilter();
    },
    accent(type, at) { const fn = ACCENTS[type]; if (fn) fn(at ?? ctx.currentTime + 0.02); },
    /** Schedule bars from t=0.05 until `seconds`; fn(t) may return { intensity, accent, mode }. */
    renderTimeline(seconds, fn) {
      let t = 0.05;
      while (t < seconds) {
        const e = fn ? fn(t) : null;
        if (e) { if (e.mode) api.setMode(e.mode); if (e.intensity != null) api.setIntensity(e.intensity); if (e.accent) api.accent(e.accent, t); }
        t = scheduleBar(t);
      }
    }
  };
  return api;
}

export const createMusic = create;
