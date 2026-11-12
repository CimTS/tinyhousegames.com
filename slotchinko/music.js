/* Slotchinko adaptive music. Procedural Web Audio, no files.
 * API: SlotchinkoMusic(ctx, out) -> { start(), stop(), setIntensity(0..1), setMood(name), accent(type), chordAt(time), stats(), renderTimeline(seconds,fn) }
 * accent types: "big" (big hand / x4 bucket), "win" (round cleared), "fail" (run over), "reset" (new round).
 * moods: "play" (a blind), "boss" (a boss blind), "last" (the last hand of a blind), "shop", "fail".
 * Every 8 bars is a section: it picks a drum pattern, an arpeggio shape and a lead motif, so no two stretches
 * of a run are arranged the same way. Everything stays in A minor pentatonic over diatonic chords. */
(() => {
  "use strict";
  const A = 220, BPM = 79; // was 88; slowed ~10% (owner, 2026-11-01)
  const hz = semi => A * Math.pow(2, semi / 12);
  // Progressions in A minor (semitones from A3). Chords as triads + bass root.
  const PROGS = [
    [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],   // Am  F  C  G
    [[0, 3, 7], [5, 8, 12], [-4, 0, 3], [-2, 2, 7]],   // Am  Dm F  G(sus)
    [[-4, 0, 3], [3, 7, 10], [-2, 2, 5], [0, 3, 7]],   // F   C  G  Am
    [[0, 3, 7], [3, 7, 10], [-4, 0, 3], [-2, 2, 5]],   // Am  C  F  G
    [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]],  // Am  G  F  Em
    [[5, 8, 12], [-2, 2, 5], [3, 7, 10], [0, 3, 7]],   // Dm  G  C  Am
  ];
  // Boss blinds stay on the minor side and never settle on C.
  const BOSS_PROGS = [
    [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-5, -2, 2]],   // Am  Am F  Em
    [[0, 3, 7], [-4, 0, 3], [5, 8, 12], [-5, -2, 2]],  // Am  F  Dm Em
  ];
  // The shop is a lounge: seventh chords, no drums.
  const SHOP_PROGS = [
    [[3, 7, 10, 14], [-4, 0, 3, 7], [5, 8, 12, 15], [-2, 2, 5, 10]], // Cmaj7 Fmaj7 Dm7 G7
    [[-4, 0, 3, 7], [3, 7, 10, 14], [0, 3, 7, 10], [-2, 2, 5, 10]],  // Fmaj7 Cmaj7 Am7 G7
  ];
  const progsFor = mood => mood === "boss" ? BOSS_PROGS : mood === "shop" ? SHOP_PROGS : PROGS;
  // Arpeggio shapes: which chord tone the k-th step plays, for a chord of n tones.
  const ARPS = [
    (k, n) => (k * (k % 3 === 2 ? 2 : 1)) % n,                 // the original skip pattern
    (k, n) => k % n,                                           // up
    (k, n) => n - 1 - (k % n),                                 // down
    (k, n) => { const p = k % (2 * n - 2); return p < n ? p : 2 * n - 2 - p; }, // up and back
  ];
  // Lead rhythms: [beat, length in beats].
  const LEAD_RHYTHMS = [[[0, 1], [1.5, 0.5], [2, 1.5]], [[0, 0.5], [0.5, 0.5], [1, 1], [2.5, 1.5]], [[0.5, 0.5], [1, 0.5], [2, 1], [3, 1]]];
  const WIN_CHORD = [3, 7, 10, 15];                      // C major lift
  const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];    // A minor pentatonic

  function build(ctx, out) {
    const bus = ctx.createGain(); bus.gain.value = 0.9; bus.connect(out);
    // master filter opened by intensity
    const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 1400; tone.Q.value = 0.5; tone.connect(bus);
    // chorus for pad: short modulated delays L/R
    const padIn = ctx.createGain(); padIn.gain.value = 1;
    const merger = ctx.createChannelMerger(2);
    [0, 1].forEach(ch => {
      const d = ctx.createDelay(0.05); d.delayTime.value = 0.012 + ch * 0.006;
      const lfo = ctx.createOscillator(), dep = ctx.createGain();
      lfo.frequency.value = 0.23 + ch * 0.11; dep.gain.value = 0.0025; lfo.connect(dep).connect(d.delayTime); lfo.start();
      padIn.connect(d); d.connect(merger, 0, ch);
    });
    const dry = ctx.createGain(); dry.gain.value = 0.6; padIn.connect(dry).connect(tone);
    const wet = ctx.createGain(); wet.gain.value = 0.55; merger.connect(wet).connect(tone);
    // ping-pong delay for lead + arp
    const ppIn = ctx.createGain(), dl = ctx.createDelay(1), dr = ctx.createDelay(1), fb = ctx.createGain(), pm = ctx.createChannelMerger(2), damp = ctx.createBiquadFilter();
    const beat = 60 / BPM; dl.delayTime.value = beat * 0.75; dr.delayTime.value = beat * 0.75; fb.gain.value = 0.32;
    damp.type = "lowpass"; damp.frequency.value = 2600;
    ppIn.connect(dl); dl.connect(damp).connect(dr); dr.connect(fb).connect(dl);
    dl.connect(pm, 0, 0); dr.connect(pm, 0, 1);
    const ppWet = ctx.createGain(); ppWet.gain.value = 0.35; pm.connect(ppWet).connect(tone);
    const leadBus = ctx.createGain(); leadBus.connect(tone); leadBus.connect(ppIn);
    // sub/bass bypasses chorus, mono
    const bassBus = ctx.createGain(); bassBus.gain.value = 1; bassBus.connect(bus);
    const drumBus = ctx.createGain(); drumBus.gain.value = 1; drumBus.connect(bus);
    // layer gains (ramped)
    const layer = {};
    ["pad", "bass", "drums", "hats", "arp", "lead"].forEach(k => { layer[k] = ctx.createGain(); layer[k].gain.value = 0; });
    layer.pad.connect(padIn); layer.bass.connect(bassBus); layer.drums.connect(drumBus); layer.hats.connect(drumBus);
    layer.arp.connect(leadBus); layer.lead.connect(leadBus);
    // shared noise
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
    let seed = 7; for (let i = 0; i < nd.length; i++) { seed = (seed * 16807) % 2147483647; nd[i] = seed / 1073741823.5 - 1; }
    return { bus, tone, layer, noise: nb };
  }

  function env(ctx, g, t, a, peak, hold, r) {
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
    g.gain.linearRampToValueAtTime(0, t + a + hold + r + 0.01); // land on true zero before the source stops
  }

  // fx (optional): { out, on() } — event stingers (big-hand chord, win flourish/chord, riser) are effects,
  // so they play into fx.out (the Effects volume) and only while fx.on(). Without fx they use the music bus.
  function create(ctx, out, shared, fx) {
    const n = build(ctx, out);
    const st = shared || { intensity: 0.15, target: 0.15, prog: 0, bar: 0, tempo: 1, mood: "play", seed: 1, nextBar: 0, timer: null, running: false, pendingBig: 0, late: 0, bars: 0, slow: 0, tl: [] };
    // Pre-rendered chunk contexts share st: start their layers/filter where the previous bar left them.
    if (shared && st.lv) { for (const k in st.lv) n.layer[k].gain.value = st.lv[k]; if (st.fq) n.tone.frequency.value = st.fq; }
    const rnd = () => { st.seed = (st.seed * 48271) % 2147483647; return st.seed / 2147483647; };
    const beat = () => 60 / (BPM * st.tempo);
    // Optional "Vice" voice set (?music=vice): same composition, different voices, through a tape-wow bus.
    const V = typeof location !== "undefined" && /[?&]music=vice(&|$)/.test(location.search) && window.SlotchinkoVice ? window.SlotchinkoVice(ctx, n, rnd, hz) : null;
    if (V) { n.bus.disconnect(); n.bus.connect(V.tape(out).input); }
    // Pre-render mode is the default (?music=live opts out): each bar (plus its tails) is rendered ahead of time in an
    // OfflineAudioContext with the same voices and state, then played as one AudioBuffer. Chunks overlap by
    // their tails, so they sum seamlessly; the phone runs ~1-3 buffer sources instead of ~150 live nodes.
    const PR = !shared && typeof location !== "undefined" && !/[?&]music=(live|vice)(&|$)/.test(location.search) && typeof OfflineAudioContext !== "undefined";
    const PR_AHEAD = 3, PR_FADE = 0.015; // bars rendered ahead (was 2: a busy phone main thread made chunks late)
    const PR_TAIL = 5; // seconds after the bar: pad release (2.6 s) and the ping-pong delay die out
    let prBusy = false, prFlush = false;
    const chunks = []; // bars rendered and waiting to play: { T, s, snap }
    const SNAP = ["bar", "prog", "seed", "intensity", "fq", "drum", "arp", "motif", "rhythm", "pendingBig"];
    const snapshot = () => { const o = { lv: { ...(st.lv || {}) } }; for (const k of SNAP) o[k] = Array.isArray(st[k]) ? [...st[k]] : st[k]; return o; };
    /* A change of mood should be heard at the next bar line, not three bars later: bars already rendered
       but not yet started are thrown away and rendered again in the new mood. */
    function flush() {
      if (!PR || !st.running) return;
      if (prBusy) { prFlush = true; return; }
      prFlush = false;
      const cut = ctx.currentTime + 0.3, drop = chunks.filter(c => c.T > cut).sort((a, b) => a.T - b.T);
      if (!drop.length) return;
      for (const c of drop) { try { c.s.stop(); } catch (e) { /* never started */ } chunks.splice(chunks.indexOf(c), 1); }
      const first = drop[0]; Object.assign(st, first.snap, { lv: { ...first.snap.lv } });
      st.nextBar = first.T; st.tl = st.tl.filter(x => x.t < first.T - 0.01);
      prPump();
    }
    function prPump() {
      if (!st.running || prBusy || st.nextBar > ctx.currentTime + PR_AHEAD * 4 * beat()) return;
      prBusy = true;
      const T = st.nextBar, barLen = 4 * beat(), sr = ctx.sampleRate, snap = snapshot(), began = typeof performance !== "undefined" ? performance.now() : 0;
      st.nextBar = T + barLen; st.gT = T;
      const oc = new OfflineAudioContext(2, Math.ceil(sr * (barLen + PR_TAIL)), sr);
      create(oc, oc.destination, st).renderTimeline(0.05 + barLen - 0.001); // exactly one bar at local 0.05
      st.gT = null;
      oc.startRendering().then(buf => {
        if (began) st.slow = Math.max(st.slow || 0, Math.round(performance.now() - began));
        st.bars = (st.bars || 0) + 1;
        const fl = Math.floor(sr * 0.1); // 100 ms fade on the (already near-silent) tail end
        for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < fl; i++) d[d.length - 1 - i] *= i / fl; }
        const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; s.connect(g).connect(out);
        const at = T - 0.05, now = ctx.currentTime;
        if (at >= now) s.start(at);
        else {
          // Late chunk: joining mid-waveform is a hard click (snare hits were the worst). Fade it in over 15 ms.
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + PR_FADE);
          s.start(now, now - at); st.late = (st.late || 0) + 1;
        }
        const chunk = { T, s, snap }; chunks.push(chunk);
        s.onended = () => { s.disconnect(); g.disconnect(); const i = chunks.indexOf(chunk); if (i >= 0) chunks.splice(i, 1); };
      }).catch(e => console.warn("[music] prerender failed", e)).finally(() => { prBusy = false; if (prFlush) flush(); else prPump(); });
    }

    function padVoice(t, semi, dur, vel, bright, dest) {
      if (V && !dest) return V.pad(t, semi, dur, vel, bright);
      const g = ctx.createGain(), f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.setValueAtTime(500 + bright * 1800, t); f.Q.value = 0.7;
      [-9, 0, 8].forEach((cents, i) => {
        const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(semi); o.detune.value = cents + (rnd() - 0.5) * 3;
        const og = ctx.createGain(); og.gain.value = i === 1 ? 0.5 : 0.35; o.connect(og).connect(f); o.start(t); o.stop(t + dur + 2.6);
      });
      f.connect(g).connect(dest || n.layer.pad);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + Math.min(1.4, dur * 0.4));
      g.gain.setValueAtTime(vel, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 2.4);
    }
    function bass(t, semi, dur, vel) {
      if (V) return V.bass(t, semi, dur, vel);
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "sine"; o.frequency.value = hz(semi - 24); o2.type = "triangle"; o2.frequency.value = hz(semi - 12);
      const g2 = ctx.createGain(); g2.gain.value = 0.18; f.type = "lowpass"; f.frequency.value = 320;
      o.connect(g); o2.connect(g2).connect(f).connect(g); g.connect(n.layer.bass);
      env(ctx, g, t, 0.02, vel, dur * 0.6, dur * 0.5); o.start(t); o2.start(t); o.stop(t + dur * 1.3); o2.stop(t + dur * 1.3);
    }
    function kick(t, vel) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine";
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      env(ctx, g, t, 0.004, vel, 0.02, 0.32); o.connect(g).connect(n.layer.drums); o.start(t); o.stop(t + 0.45);
    }
    function snare(t, vel) {
      if (V) return V.snare(t, vel);
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = n.noise; f.type = "bandpass"; f.frequency.value = 1700; f.Q.value = 0.8;
      env(ctx, g, t, 0.003, vel, 0.01, 0.2); s.connect(f).connect(g).connect(n.layer.drums); s.start(t, rnd() * 0.5); s.stop(t + 0.3);
    }
    function hat(t, vel, open) {
      const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = n.noise; hp.type = "highpass"; hp.frequency.value = 6500; lp.type = "lowpass"; lp.frequency.value = 9500;
      env(ctx, g, t, 0.002, vel, 0, open ? 0.22 : 0.05);
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      s.connect(hp).connect(lp).connect(g); if (p) { p.pan.value = 0.25; g.connect(p).connect(n.layer.hats); } else g.connect(n.layer.hats);
      s.start(t, rnd() * 0.5); s.stop(t + 0.3);
    }
    function pluck(t, semi, dur, vel, dest, type) {
      if (V && dest !== FX) return V.pluck(t, semi, dur, vel, dest);
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = type || "triangle"; o2.type = "sine"; o.frequency.value = hz(semi); o2.frequency.value = hz(semi + 12); o2.detune.value = 4;
      const g2 = ctx.createGain(); g2.gain.value = 0.25; f.type = "lowpass"; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(900, t + dur);
      o.connect(f); o2.connect(g2).connect(f); f.connect(g).connect(dest);
      env(ctx, g, t, 0.008, vel, 0.02, dur); o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
    }

    function setLayers(t, i) {
      // Hold the real level at t (not a stale .value read) before ramping.
      const r = (k, v) => { const p = n.layer[k].gain; if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(st.lv && st.lv[k] != null ? st.lv[k] : p.value, t); } n.layer[k].gain.linearRampToValueAtTime(v, t + 1.2); (st.lv || (st.lv = {}))[k] = v; };
      const fail = st.mood === "fail", shop = st.mood === "shop", boss = st.mood === "boss", last = st.mood === "last";
      r("pad", shop ? 0.13 : 0.11); r("bass", fail ? 0.12 : shop ? 0.24 : boss ? 0.36 : 0.32);
      // The last hand always has its heartbeat; the shop never has drums.
      r("drums", fail || shop ? 0 : last ? 0.5 : i > 0.33 ? 0.5 + (i - 0.33) * 0.5 : 0);
      r("hats", fail || shop || last ? 0 : i > 0.4 ? 0.045 + (i - 0.4) * 0.05 : 0);
      r("arp", fail ? 0 : shop ? 0.07 : i > 0.2 ? 0.07 + i * 0.05 : 0);
      r("lead", fail ? 0 : shop ? 0.07 : i > 0.7 ? 0.09 : 0);
      const fq = fail ? 500 : shop ? 2600 : (1100 + i * i * 5200) * (last ? 0.6 : 1);
      n.tone.frequency.cancelScheduledValues(t); n.tone.frequency.setValueAtTime(n.tone.frequency.value, t); n.tone.frequency.exponentialRampToValueAtTime(fq, t + 2); st.fq = fq;
    }

    function scheduleBar(t) {
      const b = beat(), bar = b * 4, i = st.intensity = st.intensity + (st.target - st.intensity) * 0.6;
      const mood = st.mood, shop = mood === "shop", boss = mood === "boss", last = mood === "last";
      // A new section every 8 bars: its own drum pattern, arpeggio shape, lead motif and rhythm.
      if (st.bar % 8 === 0 || st.motif == null) {
        st.drum = Math.floor(rnd() * 3); st.arp = Math.floor(rnd() * ARPS.length); st.rhythm = Math.floor(rnd() * LEAD_RHYTHMS.length);
        let idx = 4 + Math.floor(rnd() * 3); st.motif = [idx];
        for (let k = 0; k < 3; k++) { idx = Math.max(2, Math.min(9, idx + Math.floor(rnd() * 3) - 1)); st.motif.push(idx); }
      }
      const set = progsFor(mood), chord = set[st.prog % set.length][st.bar % 4];
      st.tl.push({ t: st.gT != null ? st.gT : t, chord }); if (st.tl.length > 16) st.tl.shift();
      setLayers(t, i);
      chord.forEach(s => padVoice(t, s, bar * 0.92, chord.length > 3 ? 0.18 : 0.22, shop ? 0.5 : i));
      padVoice(t, chord[0] - 12, bar * 0.92, 0.12, i * 0.5);
      // bass: root on 1 and 3 with a fifth touch at mid intensity; a boss drives it in eighths; the shop walks to the fifth
      if (boss) for (let x = 0; x < 4; x += 0.5) bass(t + x * b, chord[0], b * 0.42, x % 1 ? 0.42 : 0.7);
      else {
        bass(t, chord[0], b * 1.8, 0.8);
        bass(t + b * 2, shop ? chord[2] - 12 : chord[0], b * 1.2, 0.6);
        if (i > 0.45 && !shop && !last) bass(t + b * 3.5, chord[0] + 7, b * 0.45, 0.45);
      }
      // drums: three patterns; the last hand is a heartbeat; a fill closes every section
      if (last) for (let k = 0; k < 4; k += 2) { kick(t + k * b, 0.8); kick(t + (k + 0.38) * b, 0.5); }
      else if (!shop) {
        const busy = i > 0.55;
        for (let k = 0; k < 4; k++) {
          if (st.drum === 2 && busy) kick(t + k * b, k % 2 ? 0.6 : 0.85);               // four on the floor
          else if (k === 0 || (k === 2 && busy && st.drum === 0)) kick(t + k * b, 0.85);  // the original
          if (k === 1 || k === 3) snare(t + k * b, boss ? 0.22 : 0.18);
        }
        if (st.drum === 1 && busy) { kick(t + b * 1.5, 0.55); kick(t + b * 2.5, 0.7); }  // pushed
        if (i > 0.75 && st.drum !== 2) kick(t + b * 2.5, 0.5);
        if (st.bar % 8 === 7 && i > 0.5) for (let k = 0; k < 4; k++) snare(t + (3 + k * 0.25) * b, 0.07 + k * 0.035); // fill
        const hatStep = i > 0.75 ? 0.25 : 0.5;
        for (let x = 0; x < 4; x += hatStep) hat(t + x * b + (Math.round(x / hatStep) % 2 ? b * 0.03 : 0), (x % 1 === 0 ? 0.5 : 0.8) * (0.7 + rnd() * 0.3), x === 3.5);
      }
      // arp: chord tones up an octave, 8ths -> 16ths at high intensity, in this section's shape
      const step = i > 0.7 && !shop ? 0.25 : 0.5, tones = chord.concat(chord[0] + 12), shape = ARPS[shop ? 1 : st.arp];
      for (let x = 0, k = 0; x < 4; x += step, k++) pluck(t + x * b, tones[shape(k, tones.length)] + 12, step * b * 1.4, 0.5, n.layer.arp);
      // lead: the section's motif answers on bars 2 and 4, its last note free to move; a third joins it at the top
      const leadBar = shop ? st.bar % 4 === 3 : st.bar % 2 === 1;
      if (leadBar) {
        const pat = LEAD_RHYTHMS[st.rhythm];
        pat.forEach(([at, len], k) => {
          let idx = st.motif[k % st.motif.length]; if (k === pat.length - 1) idx = Math.max(2, Math.min(9, idx + Math.floor(rnd() * 3) - 1));
          pluck(t + at * b, PENTA[idx] + 12, len * b, 0.7, n.layer.lead, "sine");
          if (i > 0.85 && !shop) pluck(t + at * b, PENTA[Math.min(9, idx + 2)] + 12, len * b, 0.3, n.layer.lead, "sine");
        });
      }
      if (st.pendingBig && !fx) { riser(t, n.bus); st.pendingBig = 0; }
      st.bar++; if (st.bar % 8 === 0) st.prog = (st.prog + 1) % 6;
      return t + bar;
    }

    function riser(t, dest) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = n.noise; s.loop = true; f.type = "bandpass"; f.Q.value = 3;
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(5000, t + 0.9);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.7); g.gain.linearRampToValueAtTime(0, t + 1.1);
      s.connect(f).connect(g).connect(dest); s.start(t); s.stop(t + 1.2);
    }
    function sweep(t) {
      const fq = n.tone.frequency; fq.cancelScheduledValues(t); fq.setValueAtTime(fq.value, t);
      fq.exponentialRampToValueAtTime(7000, t + 0.35); fq.exponentialRampToValueAtTime(1100 + st.intensity * st.intensity * 5200, t + 2.2);
    }
    function flourish(t, notes, gap, vel) { notes.forEach((s, k) => pluck(t + k * gap, s, 1.4, vel, FX, "triangle")); }

    function tick() {
      while (st.nextBar < ctx.currentTime + 0.4) st.nextBar = scheduleBar(Math.max(st.nextBar, ctx.currentTime + 0.05));
    }
    const FX = fx ? fx.out : n.bus, fxOn = () => !fx || fx.on();
    const api = {
      get state() { return st; },
      // Pre-render starts 0.7 s out: time to prepare the first bar, so it is not joined late.
      start() { if (st.running) return; if (PR) { st.running = true; st.nextBar = ctx.currentTime + 0.7; prPump(); st.timer = setInterval(prPump, 250); return; } st.running = true; st.nextBar = ctx.currentTime + 0.1; tick(); st.timer = setInterval(tick, 100); },
      stop() { st.running = false; clearInterval(st.timer); },
      setIntensity(v) { st.target = Math.max(0, Math.min(1, Number(v) || 0)); },
      /* The mood re-arranges the same music: boss, last hand, shop, play. Heard from the next bar line. */
      setMood(mood) {
        if (!["play", "boss", "last", "shop", "fail"].includes(mood) || st.mood === mood) return;
        st.mood = mood; st.tempo = mood === "fail" ? 0.8 : 1; flush();
      },
      /* The chord sounding at a time (now by default), as semitones from A: lets the effects play in key. */
      chordAt(time = ctx.currentTime) {
        let hit = null; for (const x of st.tl) if (x.t <= time + 0.02) hit = x;
        return hit ? [...hit.chord] : [0, 3, 7];
      },
      /* How the music is keeping up: bars played, bars that arrived late, and the slowest bar to prepare (ms). */
      stats() { return { bars: st.bars || 0, late: st.late || 0, slow: st.slow || 0, prerender: PR, mood: st.mood }; },
      accent(type, at, step) {
        const t = at ?? ctx.currentTime + 0.02;
        if (type === "big") {
          sweep(t);
          if (!fx) st.pendingBig = 1; else if (fxOn()) riser(t + 0.1, FX); // live: the riser plays right away as an effect
          if (fxOn()) WIN_CHORD.forEach(s => pluck(t, s + 12, 1.2, 0.09, FX, "sine"));
        }
        else if (type === "sweep") { sweep(t); if (!fx) st.pendingBig = 1; else if (fxOn()) riser(t + 0.1, FX); }
        else if (type === "chord") { if (fxOn()) WIN_CHORD.forEach(s => pluck(t, s + 12, 1.2, 0.09, FX, "sine")); }
        else if (type === "climb") {
          // The chord the music is on, turned over once more for each x4 ball in the drop, so the stab climbs.
          if (!fxOn()) return;
          const notes = api.chordAt(t).slice(0, 4).sort((a, b) => a - b);
          for (let k = 0; k < Math.min(6, step || 0); k++) notes.push(notes.shift() + 12);
          notes.forEach(s => { let v = s + 12; while (v > 36) v -= 12; pluck(t, v, 1.2, 0.09, FX, "sine"); });
        }
        else if (type === "win") { sweep(t); if (fxOn()) { flourish(t, [3, 7, 10, 15, 19], 0.09, 0.14); WIN_CHORD.forEach(s => padVoice(t, s, 2.2, 0.1, 0.8, fx ? FX : null)); } st.prog = (st.prog + 1) % 6; st.bar = 0; }
        else if (type === "fail") { st.mood = "fail"; st.tempo = 0.8; setLayers(t, 0); st.target = 0.1; flush(); }
        else if (type === "reset") { if (st.mood === "fail") { st.mood = "play"; st.tempo = 1; flush(); } st.target = 0.15; }
      },
      // Offline render helper: fn(seconds) -> optional {intensity, accent}
      renderTimeline(seconds, fn) {
        let t = 0.05; const evs = [];
        while (t < seconds) { const e = fn ? fn(t) : null; if (e) { if (e.intensity != null) api.setIntensity(e.intensity); if (e.accent) api.accent(e.accent, t); } t = scheduleBar(t); }
        return evs;
      },
    };
    return api;
  }
  window.SlotchinkoMusic = create;
})();
