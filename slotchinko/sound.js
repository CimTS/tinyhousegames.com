/* Slotchinko sound: procedural SFX + adaptive music (music.js). No audio files.
 * Hooks wrap SlotchinkoGame methods, so game logic is untouched. */
(() => {
  "use strict";
  const KEY = "slotchinko-muted",
    VKEY = "slotchinko-audio";
  // Volume sliders scale the tuned bus levels; 1 (100%) is the mix as designed.
  const BASE = { music: 0.55, sfx: 0.135 };
  const clamp = v => Math.min(1, Math.max(0, Number(v) || 0));
  function readVolume() {
    try {
      const d = JSON.parse(localStorage.getItem(VKEY));
      if (d && typeof d === "object")
        return { music: d.music === undefined ? 1 : clamp(d.music), sfx: d.sfx === undefined ? 1 : clamp(d.sfx) };
    } catch {
      /* bad or missing save: defaults */
    }
    return { music: 1, sfx: 1 };
  }
  const volume = readVolume();
  let mus = null,
    sting = null;
  // Music-engine stingers are effects: same level they had on the music bus (bus 0.9 x music 0.55), Effects volume.
  const STING = 0.9 * 0.55;
  // A minor pentatonic, matches music
  const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27];
  const hz = s => 440 * Math.pow(2, s / 12);
  const FEAT_RUN = [3, 7, 10, 15, 19],
    // C major, up through two octaves, then held
    FEAT_CHORD = [3, 10, 15, 19, 22];
  let ctx = null,
    master,
    sfx,
    music = null,
    muted = localStorage.getItem(KEY) === "1";
  // Phone speaker mode: most of this mix's energy is deep bass (kick and sub, under 150 Hz). A phone speaker cannot
  // play that; driven hard it rattles and distorts, and the limiter ducks everything else in time with a bass
  // nobody can hear. The mode trims the deep bass before the compressor. On by default on phones; a Settings switch.
  const SKEY = "slotchinko-speaker";
  const phoneLike = () => {
    try {
      return (
        !!window.matchMedia && window.matchMedia("(max-width:699px),(max-height:599px) and (max-width:999px)").matches
      );
    } catch {
      return false;
    }
  };
  let small = (() => {
    let v = null;
    try {
      v = localStorage.getItem(SKEY);
    } catch {
      /* private mode */
    }
    return v === "small" ? true : v === "full" ? false : phoneLike();
  })();
  let bassCut = [];
  const CUT = { small: 105, full: 24 };
  const MAX_VOICES = 5,
    active = [],
    lastHit = new Map();
  let lastPeg = 0,
    pegRate = 0;
  // Scoring plays in key: each ball that scores in a drop climbs one step up the chord the music is on.
  let combo = 0,
    lastBig = -9,
    stolen = 0;
  // highest scoring note, in semitones above A4 (C7, 2093 Hz): above this a phone speaker turns notes into chirps
  const TOP = 27;
  // How a scoring ball sounds. ?score= picks one to compare: classic (the original: a fixed bright sound per pocket),
  // inkey (the original shape, tuned to the music's chord), climb (the original sound, each scoring ball a step higher),
  // ladder (low chord tones that climb).
  const SCORE = (m => (m ? m[1] : "classic"))(
    typeof location !== "undefined" && /[?&]score=(classic|inkey|climb|ladder)(?:&|$)/.exec(location.search)
  );
  // A7, 3520 Hz: the tuned styles fold anything higher down an octave
  const CAP = 36;
  function scoreNotes(mult) {
    const step = mult >= 4 ? 10 : mult >= 2 ? 7 : mult >= 1 ? 4 : 0,
      root = PENTA[step] + (mult >= 1 ? 0 : -12);
    const fold = list =>
      list.map(s => {
        while (s > CAP) s -= 12;
        return s;
      });
    if (mult < 1 || SCORE === "classic") return [root, root + 12, root + 19];
    if (SCORE === "ladder") {
      const k = Math.min(5, combo++);
      return ladder([k, k + 1, k + 2]);
    }
    if (SCORE === "inkey") {
      // the chord tone nearest the original note, then its octave and fifth as before
      const pcs = (music && music.chordAt ? music.chordAt() : [0, 3, 7]).map(s => ((s % 12) + 12) % 12);
      let best = root;
      for (let d = 0; d < 7; d++) {
        if (pcs.includes((((root + d) % 12) + 12) % 12)) {
          best = root + d;
          break;
        }
        if (pcs.includes((((root - d) % 12) + 12) % 12)) {
          best = root - d;
          break;
        }
      }
      return fold([best, best + 12, best + 19]);
    }
    // climb: the original sound, starting a little lower and stepping up the scale with each scoring ball
    const start = mult >= 4 ? 8 : mult >= 2 ? 6 : 4,
      r = PENTA[Math.min(PENTA.length - 1, start + Math.min(3, combo++))];
    return fold([r, r + 12, r + 19]);
  }
  function ladder(steps) {
    const ch = (music && music.chordAt ? music.chordAt() : [0, 3, 7])
      .map(s => ((s % 12) + 12) % 12)
      .sort((a, b) => a - b);
    const tones = [...ch, ...ch.map(s => s + 12), ...ch.map(s => s + 24)];
    return steps.map(k => {
      let s = tones[Math.min(tones.length - 1, k)];
      while (s > TOP) s -= 12;
      return s;
    });
  }
  // ?sfx=zzfx: comparison mode, sfx from pre-rendered ZzFX buffers (vendor/zzfx) through the same chain.
  const ZMODE = typeof location !== "undefined" && !/[?&]sfx=classic(&|$)/.test(location.search);
  let Z = null;

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    // Soft clip with 4x input headroom: same tanh curve as before for normal levels, but loud bursts
    // saturate smoothly instead of slamming into the curve's hard edge (that edge was the crackle).
    const clipIn = ctx.createGain();
    clipIn.gain.value = 0.25;
    const clip = ctx.createWaveShaper(),
      N = 4096,
      c = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = (i / ((N - 1) / 2) - 1) * 4;
      c[i] = Math.tanh(1.3 * x) / Math.tanh(1.3);
    }
    clip.curve = c;
    clip.oversample = "2x";
    // soft clip only with ?clip=on
    const clipOff = !(typeof location !== "undefined" && /[?&]clip=on(&|$)/.test(location.search));
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 9000;
    lp.Q.value = 0.3;
    bassCut = [0, 1].map(() => {
      const h = ctx.createBiquadFilter();
      h.type = "highpass";
      h.Q.value = 0.71;
      h.frequency.value = small ? CUT.small : CUT.full;
      return h;
    });
    bassCut[0].connect(bassCut[1]);
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.35;
    // Brick-wall limiter last in the chain so stacked sounds can never clip the output.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    if (clipOff) {
      const mk = ctx.createGain();
      // same small-signal level as the curve
      mk.gain.value = 1.3 / Math.tanh(1.3);
      lp.connect(bassCut[0]);
      bassCut[1].connect(comp).connect(mk).connect(master);
    } else {
      lp.connect(bassCut[0]);
      bassCut[1].connect(comp).connect(clipIn).connect(clip).connect(master);
    }
    master.connect(limiter).connect(ctx.destination);
    sfx = ctx.createGain();
    sfx.gain.value = BASE.sfx * volume.sfx;
    sfx.connect(lp);
    if (ZMODE && window.ZzfxBuild) Z = buildZ();
    mus = ctx.createGain();
    mus.gain.value = BASE.music * volume.music;
    mus.connect(lp);
    sting = ctx.createGain();
    sting.gain.value = STING * volume.sfx;
    sting.connect(lp);
    if (window.SlotchinkoMusic)
      music = window.SlotchinkoMusic(ctx, mus, null, { out: sting, on: () => !muted && volume.sfx > 0 });
    return ctx;
  }
  function unlock() {
    if (!init()) return;
    if (ctx.state === "suspended") ctx.resume();
    if (music && !music.state.running && !document.hidden) music.start();
  }
  ["pointerdown", "touchend", "keydown", "click"].forEach(e =>
    window.addEventListener(e, unlock, { capture: true, passive: true })
  );
  if (document.readyState === "complete") unlock();
  else window.addEventListener("load", unlock);
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (!muted) ctx.resume();
  });
  function setMuted(m) {
    muted = m;
    localStorage.setItem(KEY, m ? "1" : "0");
    if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(m ? 0 : 0.35, ctx.currentTime, 0.08);
    }
    syncUI();
  }
  function setSmallSpeaker(on) {
    small = !!on;
    try {
      localStorage.setItem(SKEY, small ? "small" : "full");
    } catch {
      /* private mode */
    }
    if (ctx)
      for (const h of bassCut) {
        h.frequency.cancelScheduledValues(ctx.currentTime);
        h.frequency.setTargetAtTime(small ? CUT.small : CUT.full, ctx.currentTime, 0.05);
      }
    syncUI();
  }
  function setVolume(kind, v) {
    if (!(kind in BASE)) return;
    volume[kind] = clamp(v);
    try {
      localStorage.setItem(VKEY, JSON.stringify(volume));
    } catch {
      /* private mode */
    }
    const node = kind === "sfx" ? sfx : mus;
    if (ctx && node) {
      node.gain.cancelScheduledValues(ctx.currentTime);
      node.gain.setTargetAtTime(BASE[kind] * volume[kind], ctx.currentTime, 0.03);
    }
    if (ctx && sting && kind === "sfx") {
      sting.gain.cancelScheduledValues(ctx.currentTime);
      sting.gain.setTargetAtTime(STING * volume.sfx, ctx.currentTime, 0.03);
    }
    syncUI();
  }
  // Settings panel (index.html #settings-screen) mirrors the saved state.
  function syncUI() {
    if (!document.getElementById) return;
    const el = id => document.getElementById(id);
    for (const k of ["music", "sfx"]) {
      const r = el(k + "-volume"),
        o = el(k + "-volume-value"),
        pct = Math.round(volume[k] * 100);
      if (r) {
        r.value = String(pct);
        r.style.setProperty("--fill", pct + "%");
        r.setAttribute("aria-valuetext", pct ? pct + "%" : "off");
      }
      if (o) {
        o.textContent = pct ? pct + "%" : "OFF";
        o.parentElement?.classList.toggle("is-off", !pct);
      }
    }
    const t = el("mute-toggle");
    if (t) t.checked = muted;
    const sp = el("speaker-toggle");
    if (sp) sp.checked = small;
    const au = el("audio-readout");
    if (au) {
      const a = stats();
      au.textContent = ctx
        ? `AUDIO ${Math.round(a.rate / 1000)}K · ${a.bars || 0} BARS · ${a.late || 0} LATE · SLOWEST ${a.slow || 0} MS · ${a.cut} CUT`
        : "";
    }
    el("settings-screen")?.classList.toggle("is-muted", muted);
    const b = el("settings-button");
    if (b) {
      b.classList.toggle("is-muted", muted);
      b.title = muted ? "Sound settings (muted)" : "Sound settings";
    }
  }
  const ok = () => ctx && !muted && volume.sfx > 0 && !document.hidden && ctx.state === "running";

  // Voice pool: at most MAX_VOICES sfx at once; the oldest fades out quickly to make room.
  // ?keep=1: scoring notes are never the ones cut.
  const KEEP = typeof location !== "undefined" && /[?&]keep=1(?:&|$)/.test(location.search);
  let keepNext = false;
  function addVoice(src, g, at, peak) {
    const v = { src, g, at, peak, keep: KEEP && keepNext };
    active.push(v);
    src.onended = () => {
      const i = active.indexOf(v);
      if (i >= 0) active.splice(i, 1);
    };
    while (active.length > MAX_VOICES + (KEEP ? 3 : 0)) {
      let i = active.findIndex(x => !x.keep && x !== v);
      if (i < 0) i = 0;
      steal(active.splice(i, 1)[0]);
      stolen++;
    }
  }
  function steal(v) {
    const now = ctx.currentTime,
      p = v.g.gain;
    if (v.at > now) {
      p.cancelScheduledValues(now);
      p.setValueAtTime(0, now);
      try {
        v.src.stop(now);
      } catch (e) {
        /* stopped */
      }
      return;
    }
    // Hold the envelope where it is. Never read p.value: before the next render quantum it can still be the
    // node default of 1.0, which made stolen notes spike to full volume during bursts.
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(now);
    else {
      p.cancelScheduledValues(now);
      p.setValueAtTime(Math.min(p.value, v.peak), now);
    }
    p.linearRampToValueAtTime(0, now + 0.015);
    try {
      v.src.stop(now + 0.02);
    } catch (e) {
      /* already stopped */
    }
  }

  // One gentle tone: sine/triangle with soft envelope.
  function tone(freq, { t = 0, dur = 0.25, vel = 0.2, type = "sine", pan = 0, attack = 0.006, bend = 0 } = {}) {
    const at = ctx.currentTime + t,
      key = type + Math.round(freq),
      prev = lastHit.get(key);
    // same sound retriggered within 30 ms
    if (prev !== undefined && Math.abs(at - prev) < 0.03) return;
    lastHit.set(key, at);
    // keep stacked voices from summing hot
    vel *= Math.min(1, Math.sqrt(2 / (active.length + 1)));
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (bend) o.frequency.exponentialRampToValueAtTime(freq * bend, at + dur);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vel, at + Math.max(0.005, attack));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    g.gain.linearRampToValueAtTime(0, at + dur + 0.015);
    let node = o.connect(g);
    if (ctx.createStereoPanner && pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(sfx);
    o.start(at);
    o.stop(at + dur + 0.05);
    addVoice(o, g, at, vel);
  }
  function noiseTick(t, vel, freq) {
    const at = ctx.currentTime + t,
      len = Math.floor(ctx.sampleRate * 0.02),
      b = ctx.createBuffer(1, len, ctx.sampleRate),
      d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const s = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    s.buffer = b;
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = 2;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vel, at + 0.004);
    g.gain.setValueAtTime(vel, at + 0.018);
    g.gain.linearRampToValueAtTime(0, at + 0.03);
    s.connect(f).connect(g).connect(sfx);
    s.start(at);
    s.stop(at + 0.035);
    addVoice(s, g, at, vel);
  }

  // ZzFX params: [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide,
  //  pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo, filter]
  // Pitched sounds are rendered once and re-pitched with playbackRate (rate = target Hz / base Hz).
  const ZP = {
    // soft triangle ping
    peg: [1, 0, 440, 0.004, 0, 0.2, 1, 1.4],
    // ping with a short echo
    bucket: [1, 0, 440, 0.005, 0.04, 0.3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0.04],
    // falling thud
    drain: [1, 0, 147, 0.005, 0.05, 0.25, 0, 1, -6],
    // sine blip
    tally: [1, 0, 440, 0.004, 0.02, 0.16],
    // chord / arpeggio tone
    note: [1, 0, 220, 0.015, 0.2, 0.55, 1, 1],
    // reel click (noise, high-passed)
    tick: [1, 0, 2400, 0, 0, 0.02, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1800],
    // tiny confirm blip
    hold: [1, 0, 1320, 0.003, 0.01, 0.04],
    // coin: two-step blip
    buy: [1, 0, 523, 0.004, 0.03, 0.15, 1, 1, 0, 0, 262, 0.05]
  };
  function buildZ() {
    const zb = window.ZzfxBuild,
      out = {};
    zb.sampleRate = ctx.sampleRate;
    for (const k in ZP) {
      const d = zb.buildSamples(...ZP[k]),
        b = ctx.createBuffer(1, Math.max(1, d.length), ctx.sampleRate);
      b.getChannelData(0).set(d);
      out[k] = b;
    }
    return out;
  }
  // Per-sound level trims so each ZzFX sound matches the RMS of the sound it replaces (measured offline).
  const ZLVL = { peg: 0.79, bucket: 2.5, drain: 0.5, tally: 0.59, note: 0.56, tick: 0.38, hold: 0.48, buy: 0.72 };
  function zplay(name, { t = 0, vel = 0.1, rate = 1, pan = 0 } = {}) {
    vel *= ZLVL[name] || 1;
    const buf = Z[name],
      at = ctx.currentTime + t,
      key = "z" + name + Math.round(rate * 1000),
      prev = lastHit.get(key);
    // same sound retriggered within 30 ms
    if (prev !== undefined && Math.abs(at - prev) < 0.03) return;
    lastHit.set(key, at);
    vel *= Math.min(1, Math.sqrt(2 / (active.length + 1)));
    const s = ctx.createBufferSource(),
      g = ctx.createGain(),
      end = at + buf.duration / rate;
    s.buffer = buf;
    s.playbackRate.value = rate;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vel, at + 0.005);
    g.gain.setValueAtTime(vel, Math.max(at + 0.005, end - 0.01));
    g.gain.linearRampToValueAtTime(0, end + 0.005);
    let node = s.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(sfx);
    s.start(at);
    s.stop(end + 0.02);
    addVoice(s, g, at, vel);
  }
  // ZzFX noise is full-band; the default ticks are band-passed, so scale to a similar level
  const TICK = 0.35;
  const ZS = {
    peg(x01, y01) {
      const now = performance.now(),
        gap = now - lastPeg;
      pegRate = pegRate * 0.9 + (gap < 120 ? 1 : 0) * 0.1 * 10;
      if (gap < 25 || active.length > MAX_VOICES) return;
      lastPeg = now;
      const col = Math.round((1 - y01) * 6 + x01 * 3) % PENTA.length;
      zplay("peg", { rate: hz(PENTA[col] + 12) / 440, vel: 0.11 / (1 + pegRate * 0.35), pan: (x01 - 0.5) * 0.8 });
    },
    reel(count) {
      for (let i = 0, t = 0; i < 9; i++) {
        t += 0.04 + i * i * 0.004;
        zplay("tick", { t, vel: (0.25 - i * 0.02) * TICK, rate: (2400 - i * 90) / 2400 });
      }
      for (let i = 0; i < count; i++)
        zplay("tally", { t: 0.42 + i * 0.05, vel: 0.06, rate: hz(PENTA[(i * 2) % PENTA.length]) / 440 });
    },
    hold(on) {
      zplay("tick", { vel: 0.3 * TICK, rate: on ? 1.33 : 0.92 });
      zplay("hold", { vel: 0.05, rate: on ? 1 : 0.75 });
    },
    hand(power) {
      const n = Math.min(5, 1 + Math.round(power * 0.6)),
        chord = [0, 7, 12, 15, 19, 24];
      for (let i = 0; i < n; i++) zplay("note", { t: i * 0.025, vel: 0.07, rate: hz(chord[i] - 12) / 220 });
    },
    drop() {
      zplay("drain", { vel: 0.07, rate: 330 / 147 });
    },
    bucket(mult, drained) {
      if (drained) {
        zplay("drain", { vel: 0.08 });
        return;
      }
      // one note; a x2 pocket adds a second, a x4 a third
      const n = scoreNotes(mult);
      keepNext = true;
      zplay("bucket", { vel: 0.1, rate: hz(n[0]) / 440 });
      if (mult >= 2) zplay("bucket", { t: 0.05, vel: 0.06, rate: hz(n[1]) / 440 });
      if (mult >= 4) zplay("bucket", { t: 0.1, vel: 0.05, rate: hz(n[2]) / 440 });
      keepNext = false;
    },
    tally(steps) {
      for (let i = 0; i < steps; i++)
        zplay("tally", { t: i * 0.06, vel: 0.05, rate: hz(PENTA[i % PENTA.length]) / 440 });
    },
    win() {
      [0, 4, 7, 12, 16].forEach((s, i) => zplay("note", { t: i * 0.08, vel: 0.07, rate: hz(s + 3 - 12) / 220 }));
    },
    feat() {
      FEAT_RUN.forEach((s, i) => zplay("note", { t: i * 0.11, vel: 0.07, rate: hz(s - 12) / 220 }));
      FEAT_CHORD.forEach(s => zplay("note", { t: 0.62, vel: 0.05, rate: hz(s - 12) / 220 }));
    },
    fail() {
      [7, 3, 0, -5].forEach((s, i) => zplay("note", { t: i * 0.22, vel: 0.06, rate: hz(s - 12) / 220 }));
    },
    buy() {
      zplay("buy", { vel: 0.06 });
    },
    reroll() {
      for (let i = 0; i < 4; i++) zplay("tick", { t: i * 0.05, vel: 0.18 * TICK, rate: (2000 + i * 300) / 2400 });
    }
  };

  const S = {
    peg(x01, y01) {
      if (!ok()) return;
      const now = performance.now(),
        gap = now - lastPeg;
      pegRate = pegRate * 0.9 + (gap < 120 ? 1 : 0) * 0.1 * 10;
      if (gap < 25 || active.length > MAX_VOICES) return;
      lastPeg = now;
      const col = Math.round((1 - y01) * 6 + x01 * 3) % PENTA.length;
      const vel = 0.11 / (1 + pegRate * 0.35);
      tone(hz(PENTA[col] + 12), { dur: 0.22, vel, type: "triangle", pan: (x01 - 0.5) * 0.8 });
      tone(hz(PENTA[col] + 24), { dur: 0.09, vel: vel * 0.25, pan: (x01 - 0.5) * 0.8 });
    },
    reel(count) {
      if (!ok()) return;
      for (let i = 0, t = 0; i < 9; i++) {
        t += 0.04 + i * i * 0.004;
        noiseTick(t, 0.25 - i * 0.02, 2400 - i * 90);
      }
      for (let i = 0; i < count; i++)
        tone(hz(PENTA[(i * 2) % PENTA.length]), { t: 0.42 + i * 0.05, dur: 0.12, vel: 0.06, type: "triangle" });
    },
    hold(on) {
      if (ok()) {
        noiseTick(0, 0.3, on ? 3200 : 2200);
        tone(on ? 1320 : 990, { dur: 0.05, vel: 0.05 });
      }
    },
    hand(power) {
      if (!ok()) return;
      const n = Math.min(5, 1 + Math.round(power * 0.6)),
        chord = [0, 7, 12, 15, 19, 24];
      for (let i = 0; i < n; i++)
        tone(hz(chord[i] - 12), {
          t: i * 0.025,
          dur: 0.6 + power * 0.08,
          vel: 0.07,
          type: i ? "sine" : "triangle",
          attack: 0.02
        });
    },
    drop() {
      if (ok()) tone(330, { dur: 0.18, vel: 0.07, bend: 0.6 });
    },
    bucket(mult, drained) {
      if (!ok()) return;
      if (drained) {
        tone(147, { dur: 0.3, vel: 0.08, bend: 0.8 });
        return;
      }
      const n = scoreNotes(mult);
      tone(hz(n[0]), { dur: 0.35, vel: 0.1, type: mult < 1 ? "sine" : "triangle" });
      if (mult >= 2) tone(hz(n[1]), { t: 0.05, dur: 0.3, vel: 0.06 });
      if (mult >= 4) tone(hz(n[2]), { t: 0.1, dur: 0.5, vel: 0.05 });
    },
    tally(steps) {
      if (ok()) for (let i = 0; i < steps; i++) tone(hz(PENTA[i % PENTA.length]), { t: i * 0.06, dur: 0.2, vel: 0.05 });
    },
    win() {
      if (ok())
        [0, 4, 7, 12, 16].forEach((s, i) =>
          tone(hz(s + 3 - 12), { t: i * 0.08, dur: 0.9, vel: 0.07, type: "triangle", attack: 0.01 })
        );
    },
    /* An achievement: five rising notes (one per Ace of The Cinco), then a held chord. */
    feat() {
      if (!ok()) return;
      FEAT_RUN.forEach((s, i) =>
        tone(hz(s - 12), { t: i * 0.11, dur: 0.5, vel: 0.07, type: "triangle", attack: 0.01 })
      );
      FEAT_CHORD.forEach(s => tone(hz(s - 12), { t: 0.62, dur: 1.8, vel: 0.05, type: "triangle", attack: 0.02 }));
    },
    fail() {
      if (ok()) [7, 3, 0, -5].forEach((s, i) => tone(hz(s - 12), { t: i * 0.22, dur: 0.8, vel: 0.06, attack: 0.04 }));
    },
    buy() {
      if (ok()) {
        tone(hz(15), { dur: 0.12, vel: 0.06 });
        tone(hz(22), { t: 0.06, dur: 0.2, vel: 0.06 });
      }
    },
    reroll() {
      if (ok()) for (let i = 0; i < 4; i++) noiseTick(i * 0.05, 0.18, 2000 + i * 300);
    }
  };

  // In zzfx mode each sfx method plays its ZzFX version; otherwise the original runs untouched.
  for (const k of Object.keys(ZS)) {
    const orig = S[k];
    S[k] = (...a) => (Z ? (ok() ? ZS[k](...a) : undefined) : orig(...a));
  }

  const intensityOf = g => {
    const s = g.state;
    return s.target ? Math.min(1, s.score / s.target) * 0.85 + (s.phase === "drop" ? 0.15 : 0) : 0.2;
  };
  const mood = g => {
    if (music) music.setIntensity(intensityOf(g));
  };

  /* The big-moment sting (filter sweep, riser, chord). When several balls land in the x4 pocket together it
     plays once, not once per ball: stacked risers are noise, and each one is a dozen live nodes on a phone. */
  const BIG_GAP = 1.6;
  // ?sting= compares: all (the original: the whole sting for every x4 ball), once (one sting per burst),
  // chord (the chord for every x4 ball; the sweep and riser once per burst), climb (as chord, but the chord is the
  // one the music is on and it climbs with each x4 ball in the drop).
  // climb is the default: the original stab was always C major, whatever chord the music was on, and repeated
  // unchanged for every ball. Over G or E minor that is a clash, and stacked it was a sharp, unmusical ding.
  const STINGS = (m => (m ? m[1] : "climb"))(
    typeof location !== "undefined" && /[?&]sting=(all|once|chord|climb)(?:&|$)/.exec(location.search)
  );
  // x4 balls so far in this drop
  let bigs = 0;
  function big() {
    if (!music || !ctx) return;
    if (STINGS === "all") {
      music.accent("big");
      return;
    }
    const burst = ctx.currentTime - lastBig < BIG_GAP,
      n = bigs++;
    if (STINGS === "climb") {
      music.accent("climb", undefined, n);
      if (burst) return;
      lastBig = ctx.currentTime;
      music.accent("sweep");
      return;
    }
    if (burst) {
      if (STINGS === "chord") music.accent("chord");
      return;
    }
    lastBig = ctx.currentTime;
    music.accent("big");
  }
  const moodFor = s =>
    s.victory || (s.phase === "roundEnd" && !s.won)
      ? null
      : s.phase === "roundEnd"
        ? "shop"
        : s.handsLeft === 1 && s.round
          ? "last"
          : s.boss
            ? "boss"
            : "play";
  const setMood = g => {
    const m = moodFor(g.state);
    if (m && music && music.setMood) music.setMood(m);
  };
  // One place for what a game event sounds like; the hooks below and the offline recorder both call it.
  function play(e) {
    if (e.k === "hand") {
      combo = 0;
      bigs = 0;
      S.hand(e.power);
      if (e.big) big();
    } else if (e.k === "ball") S.drop();
    else if (e.k === "peg") S.peg(e.x, e.y);
    else if (e.k === "bucket") {
      S.bucket(e.mult, e.drained);
      if (e.gained > 0) S.tally(Math.min(6, 1 + Math.floor(Math.log10(e.gained + 1) * 1.5)));
      if (e.mult >= 4) big();
      if (music && e.target) music.setIntensity(Math.min(1, e.score / e.target) * 0.85 + 0.15);
    } else if (e.k === "finish") {
      setTimeout(e.won ? S.win : S.fail, 300);
      if (music) {
        music.accent(e.won ? "win" : "fail");
        if (e.won && music.setMood) music.setMood("shop");
      }
    } else if (e.k === "next") {
      if (music) {
        music.accent("reset");
        music.setIntensity(0.15);
        if (music.setMood) music.setMood(e.mood || "play");
      }
    } else if (e.k === "mood") {
      if (music && music.setMood) music.setMood(e.mood);
    }
  }
  function wrap(proto, name, before, after) {
    const orig = proto[name];
    if (typeof orig !== "function") {
      console.info("[sound] hook missing:", name);
      return;
    }
    proto[name] = function (...args) {
      const pre = before ? before.apply(this, args) : undefined;
      const r = orig.apply(this, args);
      if (after) after.call(this, pre, ...args);
      return r;
    };
  }
  const G = window.SlotchinkoGame && window.SlotchinkoGame.prototype;
  if (G) {
    wrap(
      G,
      "toggleHold",
      function () {
        return this.state.phase;
      },
      function (ph, i) {
        if (ph === "slot") S.hold(this.state.held[i]);
      }
    );
    wrap(
      G,
      "spin",
      function () {
        return this.state.spins;
      },
      function (prev) {
        if (this.state.spins === prev) return;
        S.reel(5 - this.state.held.filter(Boolean).length);
        const p = this.state.power || 1;
        setTimeout(() => S.hand(p), 520);
        if (p >= 4 && music) setTimeout(big, 520);
      }
    );
    wrap(
      G,
      "startDrop",
      function () {
        return this.state.phase;
      },
      function (ph) {
        if (ph === "slot" && this.state.phase === "drop") {
          combo = 0;
          bigs = 0;
          S.hand(this.state.power || 1);
          mood(this);
        }
      }
    );
    wrap(
      G,
      "_dropNext",
      function () {
        return this.state.ballsLeft;
      },
      function (prev) {
        if (this.state.ballsLeft < prev) S.drop();
      }
    );
    wrap(G, "onPegHit", null, function (_, ball, peg) {
      const p = this.physics,
        pos = (peg && peg.position) || (ball && ball.position) || { x: 0, y: 0 };
      S.peg(pos.x / (p.width || 360), pos.y / (p.height || 260));
    });
    wrap(
      G,
      "onBucket",
      function () {
        return this.state.roundScore;
      },
      function (prev, r) {
        S.bucket(r.multiplier, r.drained);
        const gained = this.state.roundScore - prev;
        if (gained > 0) S.tally(Math.min(6, 1 + Math.floor(Math.log10(gained + 1) * 1.5)));
        if (r.multiplier >= 4) big();
        mood(this);
      }
    );
    wrap(
      G,
      "finishRound",
      function () {
        return this.state.phase;
      },
      function (ph) {
        if (ph !== "drop") return;
        if (this.state.phase === "slot") {
          if (music) {
            music.accent("reset");
            mood(this);
            setMood(this);
          }
          // short, with a hand left: no fail sting
          return;
        }
        if (this.state.won) {
          setTimeout(S.win, 300);
          if (music) music.accent("win");
          setMood(this);
        } else {
          setTimeout(S.fail, 300);
          if (music) music.accent("fail");
        }
      }
    );
    wrap(
      G,
      "purchase",
      function () {
        return this.state.coins;
      },
      function (c) {
        if (this.state.coins < c) S.buy();
      }
    );
    wrap(
      G,
      "sellChip",
      function () {
        return this.state.coins;
      },
      function (c) {
        if (this.state.coins > c) S.buy();
      }
    );
    wrap(
      G,
      "rerollShop",
      function () {
        return this.state.coins;
      },
      function (c) {
        if (this.state.coins < c) S.reroll();
      }
    );
    wrap(G, "achieved", null, function () {
      S.feat();
    });
    wrap(G, "useConsumable", null, function () {
      S.buy();
    });
    wrap(G, "nextRound", null, function () {
      if (music) {
        music.accent("reset");
        mood(this);
        setMood(this);
      }
    });
    wrap(G, "newRun", null, function () {
      combo = 0;
      setMood(this);
    });
  } else console.info("[sound] SlotchinkoGame not found; SFX hooks disabled");

  window.addEventListener("DOMContentLoaded", () => {
    const el = id => document.getElementById(id);
    let lastPreview = 0;
    for (const k of ["music", "sfx"]) {
      el(k + "-volume")?.addEventListener("input", e => {
        unlock();
        setVolume(k, Number(e.target.value) / 100);
        const now = performance.now();
        if (k === "sfx" && now - lastPreview > 120) {
          lastPreview = now;
          // hear the new level
          S.hold(true);
        }
      });
    }
    el("mute-toggle")?.addEventListener("change", e => {
      unlock();
      setMuted(e.target.checked);
      if (!muted) S.hold(true);
    });
    el("speaker-toggle")?.addEventListener("change", e => {
      unlock();
      setSmallSpeaker(e.target.checked);
    });
    // The audio readout refreshes whenever Settings is opened.
    for (const id of ["settings-button", "title-settings"])
      el(id)?.addEventListener("click", () => setTimeout(syncUI, 0));
    setMuted(muted);
  });
  /* How the audio is keeping up on this device, for the readout in Settings. */
  const stats = () => ({
    ...(music && music.stats ? music.stats() : {}),
    cut: stolen,
    rate: ctx ? ctx.sampleRate : 0,
    state: ctx ? ctx.state : "off"
  });
  window.SlotchinkoSound = {
    sfx: S,
    play,
    stats,
    syncMood: g => setMood(g),
    setSmallSpeaker,
    get smallSpeaker() {
      return small;
    },
    get zzfx() {
      return Z;
    },
    get voices() {
      return active.length;
    },
    get music() {
      return music;
    },
    setMuted,
    get muted() {
      return muted;
    },
    setVolume,
    get volume() {
      return { ...volume };
    },
    get nodes() {
      return { sfx, music: mus, master, stingers: sting };
    }
  };
})();
