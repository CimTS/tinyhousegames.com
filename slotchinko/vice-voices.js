/* Slotchinko "Vice" voice set (opt-in with ?music=vice). Web Audio only, no files.
 * Voices: gatedSnare, junoPad, pulseBass, brightLead, createTapeWow.
 * Every envelope starts at 0 and lands on 0 before its sources stop (no clicks).
 * Phone-light: one shared noise buffer and ONE shared gated-reverb convolver per context. */
(() => {
  "use strict";
  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
  function disconnectAll(nodes) {
    for (const n of nodes)
      if (n) {
        try {
          n.disconnect();
        } catch (e) {
          /* gone */
        }
      }
  }

  // White noise, one buffer per (ctx, length), never per note.
  const noiseCache = new WeakMap();
  function noiseBuffer(ctx, seconds) {
    let m = noiseCache.get(ctx);
    if (!m) {
      m = new Map();
      noiseCache.set(ctx, m);
    }
    if (m.has(seconds)) return m.get(seconds);
    const n = Math.max(1, Math.floor(ctx.sampleRate * seconds)),
      buf = ctx.createBuffer(1, n, ctx.sampleRate),
      d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    m.set(seconds, buf);
    return buf;
  }
  // Gated-reverb impulse: noise with exp decay, hard gate at the tail, 6 ms fade so the gate doesn't click.
  const irCache = new WeakMap();
  function gatedIR(ctx, tail) {
    let m = irCache.get(ctx);
    if (!m) {
      m = new Map();
      irCache.set(ctx, m);
    }
    if (m.has(tail)) return m.get(tail);
    const sr = ctx.sampleRate,
      fade = 0.006,
      len = Math.floor(sr * (tail + fade)),
      buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        let g = t < tail ? 1 : 1 - (t - tail) / fade;
        if (g < 0) g = 0;
        d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 7) * g;
      }
    }
    m.set(tail, buf);
    return buf;
  }
  // Shared gated-verb send (one convolver for every snare).
  function createGatedVerb(ctx, destination, opts = {}) {
    const input = ctx.createGain(),
      conv = ctx.createConvolver(),
      wet = ctx.createGain();
    conv.buffer = gatedIR(ctx, num(opts.tail, 0.25));
    wet.gain.value = num(opts.wet, 0.7);
    input.connect(conv);
    conv.connect(wet);
    wet.connect(destination);
    return {
      input,
      dispose() {
        disconnectAll([input, conv, wet]);
      }
    };
  }

  // GATED-REVERB SNARE
  function gatedSnare(ctx, destination, time, opts = {}) {
    const volume = num(opts.volume, 1),
      tone = num(opts.tone, 185),
      pan = num(opts.pan, 0),
      life = 0.2;
    const out = ctx.createGain();
    out.gain.value = volume;
    const nodes = [out];
    let dest = destination;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(destination);
      dest = p;
      nodes.push(p);
    }
    out.connect(dest);
    const bus = ctx.createGain();
    // noise crack
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx, 1);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1100;
    hp.Q.value = 0.6;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0, time);
    nGain.gain.linearRampToValueAtTime(0.85, time + 0.003);
    nGain.gain.exponentialRampToValueAtTime(0.02, time + 0.09);
    nGain.gain.exponentialRampToValueAtTime(0.0005, time + 0.14);
    nGain.gain.linearRampToValueAtTime(0, time + 0.15);
    noise.connect(hp);
    hp.connect(nGain);
    nGain.connect(bus);
    // shell tone with a tiny pitch drop
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(tone * 1.7, time);
    osc.frequency.exponentialRampToValueAtTime(tone, time + 0.05);
    const oGain = ctx.createGain();
    oGain.gain.setValueAtTime(0, time);
    oGain.gain.linearRampToValueAtTime(0.5, time + 0.004);
    oGain.gain.exponentialRampToValueAtTime(0.0008, time + 0.12);
    oGain.gain.linearRampToValueAtTime(0, time + 0.13);
    osc.connect(oGain);
    oGain.connect(bus);
    // dry + gated verb (shared send if given, else a private convolver)
    const dry = ctx.createGain();
    dry.gain.value = 0.55;
    bus.connect(dry);
    dry.connect(out);
    nodes.push(noise, hp, nGain, osc, oGain, dry, bus);
    if (opts.verb) {
      const send = ctx.createGain();
      send.gain.value = volume;
      bus.connect(send);
      send.connect(opts.verb.input);
      nodes.push(send);
    } else {
      const conv = ctx.createConvolver(),
        w = ctx.createGain();
      conv.buffer = gatedIR(ctx, num(opts.tail, 0.25));
      w.gain.value = num(opts.wet, 0.7);
      bus.connect(conv);
      conv.connect(w);
      w.connect(out);
      nodes.push(conv, w);
    }
    noise.start(time);
    osc.start(time);
    noise.stop(time + life);
    osc.stop(time + life);
    noise.onended = () => disconnectAll(nodes);
  }

  // JUNO-60 CHORUSED PAD
  function junoPad(ctx, destination, time, opts = {}) {
    const freq = num(opts.freq, 220),
      dur = num(opts.dur, 2),
      volume = num(opts.volume, 0.16),
      cutoff = num(opts.cutoff, 1400);
    const q = num(opts.q, 1.1),
      detune = num(opts.detune, 9),
      attack = num(opts.attack, 0.15),
      release = num(opts.release, 0.7);
    const useChorus = opts.chorus !== false,
      end = time + dur + release,
      holdEnd = Math.max(time + attack, time + dur);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(volume, time + attack);
    amp.gain.setValueAtTime(volume, holdEnd);
    amp.gain.linearRampToValueAtTime(0, end);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = q;
    lp.frequency.setValueAtTime(Math.min(cutoff * 2.4, 18000), time);
    lp.frequency.exponentialRampToValueAtTime(cutoff, time + 0.9);
    const o1 = ctx.createOscillator(),
      o2 = ctx.createOscillator();
    o1.type = o2.type = "sawtooth";
    o1.frequency.value = o2.frequency.value = freq;
    o1.detune.value = -detune;
    o2.detune.value = detune;
    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    o1.connect(mix);
    o2.connect(mix);
    mix.connect(lp);
    lp.connect(amp);
    const out = ctx.createGain();
    out.connect(destination);
    const nodes = [o1, o2, mix, lp, amp, out];
    if (useChorus) {
      const dry = ctx.createGain();
      dry.gain.value = 0.7;
      amp.connect(dry);
      dry.connect(out);
      const lfo = ctx.createOscillator();
      lfo.type = "triangle";
      lfo.frequency.value = 0.55;
      const dL = ctx.createDelay(0.1),
        dR = ctx.createDelay(0.1);
      dL.delayTime.value = 0.0125;
      dR.delayTime.value = 0.0175;
      const gL = ctx.createGain(),
        gR = ctx.createGain();
      gL.gain.value = 0.0032;
      gR.gain.value = -0.0028;
      lfo.connect(gL);
      gL.connect(dL.delayTime);
      lfo.connect(gR);
      gR.connect(dR.delayTime);
      const wL = ctx.createGain(),
        wR = ctx.createGain();
      wL.gain.value = wR.gain.value = 0.5;
      const pL = ctx.createStereoPanner(),
        pR = ctx.createStereoPanner();
      pL.pan.value = -0.85;
      pR.pan.value = 0.85;
      amp.connect(dL);
      dL.connect(wL);
      wL.connect(pL);
      pL.connect(out);
      amp.connect(dR);
      dR.connect(wR);
      wR.connect(pR);
      pR.connect(out);
      lfo.start(time);
      lfo.stop(end + 0.02);
      nodes.push(dry, lfo, dL, dR, gL, gR, wL, wR, pL, pR);
    } else amp.connect(out);
    o1.start(time);
    o2.start(time);
    o1.stop(end + 0.02);
    o2.stop(end + 0.02);
    o1.onended = () => disconnectAll(nodes);
  }

  // PULSING OCTAVE BASS
  function pulseBass(ctx, destination, time, opts = {}) {
    const freq = num(opts.freq, 55),
      dur = num(opts.dur, 0.22),
      volume = num(opts.volume, 0.5),
      cutoff = num(opts.cutoff, 160);
    const envAmt = num(opts.envAmt, 1600),
      q = num(opts.q, 11),
      decay = num(opts.decay, 0.16),
      sub = opts.sub !== false;
    const tA = time + 0.006,
      tR = time + Math.max(0.03, dur),
      end = tR + 0.03;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(volume, tA);
    amp.gain.setValueAtTime(volume, Math.max(tA, tR - 0.03));
    amp.gain.linearRampToValueAtTime(0, tR);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = q;
    lp.frequency.setValueAtTime(Math.min(cutoff + envAmt, 20000), time);
    lp.frequency.exponentialRampToValueAtTime(cutoff, time + decay);
    const saw = ctx.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.value = freq;
    const sawG = ctx.createGain();
    sawG.gain.value = 0.7;
    saw.connect(sawG);
    sawG.connect(lp);
    const nodes = [saw, sawG];
    if (sub) {
      const s = ctx.createOscillator();
      s.type = "sine";
      s.frequency.value = freq * 0.5;
      const sG = ctx.createGain();
      sG.gain.value = 0.5;
      s.connect(sG);
      sG.connect(lp);
      s.start(time);
      s.stop(end);
      nodes.push(s, sG);
    }
    lp.connect(amp);
    amp.connect(destination);
    saw.start(time);
    saw.stop(end);
    nodes.push(lp, amp);
    saw.onended = () => disconnectAll(nodes);
  }

  // BRIGHT DETUNED LEAD
  function brightLead(ctx, destination, time, opts = {}) {
    const freq = num(opts.freq, 440),
      dur = num(opts.dur, 1.2),
      volume = num(opts.volume, 0.22);
    const cut0 = num(opts.cutoffStart, 5200),
      cut1 = num(opts.cutoffEnd, 1400),
      q = num(opts.q, 6),
      detune = num(opts.detune, 11);
    const vibRate = num(opts.vibRate, 5.2),
      vibDepth = num(opts.vibDepth, 14),
      vibDelay = num(opts.vibDelay, 0.25);
    const attack = num(opts.attack, 0.02),
      release = num(opts.release, 0.25);
    const end = time + dur + release,
      holdEnd = Math.max(time + attack, time + dur);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(volume, time + attack);
    amp.gain.linearRampToValueAtTime(volume * 0.82, time + Math.max(attack, Math.min(dur * 0.4, 0.6)));
    amp.gain.setValueAtTime(volume * 0.82, holdEnd);
    amp.gain.linearRampToValueAtTime(0, end);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = q;
    lp.frequency.setValueAtTime(cut0, time);
    lp.frequency.exponentialRampToValueAtTime(cut1, time + Math.max(0.3, dur));
    const o1 = ctx.createOscillator(),
      o2 = ctx.createOscillator();
    o1.type = o2.type = "sawtooth";
    o1.frequency.value = o2.frequency.value = freq;
    o1.detune.value = -detune;
    o2.detune.value = detune;
    const mix = ctx.createGain();
    mix.gain.value = 0.45;
    o1.connect(mix);
    o2.connect(mix);
    mix.connect(lp);
    lp.connect(amp);
    amp.connect(destination);
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = vibRate;
    const lfoG = ctx.createGain();
    lfoG.gain.setValueAtTime(0, time);
    lfoG.gain.linearRampToValueAtTime(vibDepth, time + vibDelay + 0.2);
    lfo.connect(lfoG);
    lfoG.connect(o1.detune);
    lfoG.connect(o2.detune);
    lfo.start(time);
    lfo.stop(end + 0.02);
    o1.start(time);
    o2.start(time);
    o1.stop(end + 0.02);
    o2.stop(end + 0.02);
    o1.onended = () => disconnectAll([o1, o2, mix, lp, amp, lfo, lfoG]);
  }

  // TAPE WOW (bus insert, create once, not per note)
  function createTapeWow(ctx, destination, opts = {}) {
    const base = num(opts.base, 0.008),
      mix = num(opts.mix, 1),
      wowRate = num(opts.wowRate, 0.33),
      wowDep = num(opts.wowDepth, 0.0022);
    const flutRate = num(opts.flutterRate, 6.7),
      flutDep = num(opts.flutterDepth, 0.00012);
    const input = ctx.createGain(),
      delay = ctx.createDelay(0.5);
    delay.delayTime.value = base;
    const wow = ctx.createOscillator();
    wow.type = "sine";
    wow.frequency.value = wowRate;
    const wowG = ctx.createGain();
    wowG.gain.value = wowDep;
    wow.connect(wowG);
    wowG.connect(delay.delayTime);
    const flut = ctx.createOscillator();
    flut.type = "sine";
    flut.frequency.value = flutRate;
    const flutG = ctx.createGain();
    flutG.gain.value = flutDep;
    flut.connect(flutG);
    flutG.connect(delay.delayTime);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 11000;
    lp.Q.value = 0.4;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 35;
    const wet = ctx.createGain();
    wet.gain.value = mix;
    input.connect(delay);
    delay.connect(lp);
    lp.connect(hp);
    hp.connect(wet);
    wet.connect(destination);
    const nodes = [input, delay, wow, wowG, flut, flutG, lp, hp, wet];
    if (mix < 1) {
      const dry = ctx.createGain();
      dry.gain.value = 1 - mix;
      input.connect(dry);
      dry.connect(destination);
      nodes.push(dry);
    }
    wow.start();
    flut.start();
    return {
      input,
      dispose() {
        try {
          wow.stop();
          flut.stop();
        } catch (e) {
          /* stopped */
        }
        disconnectAll(nodes);
      }
    };
  }

  /* Adapter used by music.js in ?music=vice mode. Same calls, same timing, same notes as the default
   * voices; only the timbre changes. `rnd` is music.js's seeded RNG: we draw the same number of values
   * the default voices would, so the generated melody stays identical. Levels are matched to the default mix. */
  function SlotchinkoVice(ctx, n, rnd, hz) {
    const verb = createGatedVerb(ctx, n.layer.drums, { tail: 0.25, wet: 0.7 });
    return {
      tape: out => createTapeWow(ctx, out),
      pad(t, semi, dur, vel, bright) {
        rnd();
        rnd();
        // default pad draws 3 detune values
        rnd();
        junoPad(ctx, n.layer.pad, t, {
          freq: hz(semi),
          dur,
          volume: vel * 1.29,
          cutoff: 600 + bright * 1600,
          attack: Math.min(1.4, dur * 0.4),
          release: 2.4,
          chorus: false
        });
      },
      bass(t, semi, dur, vel) {
        pulseBass(ctx, n.layer.bass, t, {
          freq: hz(semi - 12),
          dur: dur * 0.9,
          volume: vel * 0.64,
          cutoff: 150,
          envAmt: 1400,
          q: 9
        });
      },
      snare(t, vel) {
        rnd();
        gatedSnare(ctx, n.layer.drums, t, { volume: vel * 1.05, verb });
      },
      pluck(t, semi, dur, vel, dest) {
        brightLead(ctx, dest, t, {
          freq: hz(semi),
          dur: dur * 0.7,
          volume: vel * 0.64,
          release: Math.min(0.25, dur * 0.3),
          vibDelay: 0.25
        });
      }
    };
  }
  Object.assign(SlotchinkoVice, { gatedSnare, junoPad, pulseBass, brightLead, createTapeWow, createGatedVerb });
  window.SlotchinkoVice = SlotchinkoVice;
})();
