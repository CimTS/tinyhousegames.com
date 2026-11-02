/* Synth voices for the score. Every envelope starts at 0 and lands on 0 before its source stops
 * (no clicks). Each voice calls mark(name) so tests can see which parts played in a bar.
 * The pulse bass follows the pattern of Slotchinko's Vice pulseBass (saw + sub through a
 * resonant low-pass with a filter envelope); everything else is new. */
import { hz } from "./score.js";

export function makeVoices(ctx, n, rnd, mark) {
  function env(g, t, a, peak, hold, r) {
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
    g.gain.linearRampToValueAtTime(0, t + a + hold + r + 0.01);
  }
  const osc = (type, f, t, end) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); o.stop(end); return o; };

  return {
    // TRON-style pulsing analog bass: saw + sub, resonant low-pass with a snappy filter envelope.
    bass(t, semi, dur, vel, bright) {
      mark("bass");
      const end = t + dur + 0.04, g = ctx.createGain(), lp = ctx.createBiquadFilter(), cut = 140 + bright * 700;
      lp.type = "lowpass"; lp.Q.value = 9;
      lp.frequency.setValueAtTime(cut + 900 + bright * 1400, t); lp.frequency.exponentialRampToValueAtTime(cut, t + 0.12);
      const saw = osc("sawtooth", hz(semi - 12), t, end), sub = osc("sine", hz(semi - 24), t, end);
      const sg = ctx.createGain(); sg.gain.value = 0.5;
      saw.connect(lp); sub.connect(sg).connect(lp); lp.connect(g).connect(n.layer.bass);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.005);
      g.gain.setValueAtTime(vel, t + Math.max(0.01, dur - 0.025)); g.gain.linearRampToValueAtTime(0, t + dur);
    },
    // Glassy pad: detuned saws under a gentle low-pass, plus a sine shimmer an octave up.
    pad(t, semi, dur, vel, bright, dest) {
      mark("pad");
      const g = ctx.createGain(), f = ctx.createBiquadFilter(), end = t + dur + 2.2;
      f.type = "lowpass"; f.frequency.value = 700 + bright * 1600; f.Q.value = 0.6;
      [-8, 7].forEach(c => { const o = osc("sawtooth", hz(semi), t, end); o.detune.value = c + (rnd() - 0.5) * 3; const og = ctx.createGain(); og.gain.value = 0.4; o.connect(og).connect(f); });
      const shimmer = osc("sine", hz(semi + 12), t, end), sg = ctx.createGain(); sg.gain.value = 0.18; shimmer.connect(sg).connect(g);
      f.connect(g).connect(dest || n.layer.pad);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + Math.min(1.2, dur * 0.4));
      g.gain.setValueAtTime(vel, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 2);
    },
    // Digital arp pluck: triangle + quiet square an octave up, bright then closing.
    arp(t, semi, dur, vel, dest, name = "arp") {
      mark(name);
      const g = ctx.createGain(), f = ctx.createBiquadFilter(), end = t + dur + 0.12;
      f.type = "lowpass"; f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(900, t + dur);
      osc("triangle", hz(semi), t, end).connect(f);
      const sq = osc("square", hz(semi + 12), t, end), qg = ctx.createGain(); qg.gain.value = 0.07; sq.connect(qg).connect(f);
      f.connect(g).connect(dest || n.layer.arp);
      env(g, t, 0.004, vel, 0.01, dur);
    },
    // Motif lead: two detuned saws with delayed vibrato (cool, not shrill).
    lead(t, semi, dur, vel, dest) {
      mark("lead");
      const g = ctx.createGain(), f = ctx.createBiquadFilter(), end = t + dur + 0.35;
      f.type = "lowpass"; f.Q.value = 2; f.frequency.setValueAtTime(3600, t); f.frequency.exponentialRampToValueAtTime(1500, t + Math.max(0.2, dur));
      const vib = osc("sine", 5, t, end), vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(10, t + 0.4);
      [-7, 7].forEach(c => { const o = osc("sawtooth", hz(semi), t, end); o.detune.value = c; vib.connect(vg).connect(o.detune); const og = ctx.createGain(); og.gain.value = 0.4; o.connect(og).connect(f); });
      f.connect(g).connect(dest || n.layer.lead);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.02);
      g.gain.setValueAtTime(vel * 0.85, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.3);
    },
    // Low brass-like swell: stacked saws, filter opening slowly with the volume.
    brass(t, semis, dur, vel) {
      mark("brass");
      const g = ctx.createGain(), f = ctx.createBiquadFilter(), end = t + dur + 0.6;
      f.type = "lowpass"; f.Q.value = 1.2; f.frequency.setValueAtTime(220, t); f.frequency.linearRampToValueAtTime(1300, t + dur * 0.7); f.frequency.linearRampToValueAtTime(400, t + dur + 0.5);
      for (const s of semis) { const o = osc("sawtooth", hz(s - 12), t, end); o.detune.value = (rnd() - 0.5) * 10; o.connect(f); }
      f.connect(g).connect(n.layer.brass);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + dur * 0.65); g.gain.linearRampToValueAtTime(0, t + dur + 0.5);
    },
    // Tight cinematic kick: sine drop with a click.
    kick(t, vel) {
      mark("kick");
      const o = osc("sine", 120, t, t + 0.4), g = ctx.createGain();
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.16);
      env(g, t, 0.003, vel, 0.02, 0.28); o.connect(g).connect(n.layer.drums);
    },
    snare(t, vel) {
      mark("snare");
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = n.noise; f.type = "bandpass"; f.frequency.value = 2200; f.Q.value = 0.9;
      env(g, t, 0.002, vel, 0.008, 0.14); s.connect(f).connect(g).connect(n.layer.drums); s.start(t, rnd() * 0.5); s.stop(t + 0.22);
      const body = osc("triangle", 200, t, t + 0.12), bg = ctx.createGain(); body.frequency.exponentialRampToValueAtTime(150, t + 0.06);
      env(bg, t, 0.002, vel * 0.5, 0, 0.08); body.connect(bg).connect(n.layer.drums);
    },
    // Ticking sequencer: very short high-passed noise clicks.
    tick(t, vel) {
      mark("tick");
      const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = n.noise; hp.type = "highpass"; hp.frequency.value = 7000;
      env(g, t, 0.001, vel, 0, 0.025); s.connect(hp).connect(g).connect(n.layer.hats); s.start(t, rnd() * 0.5); s.stop(t + 0.06);
    },
    // Low tom for fills.
    tom(t, semi, vel) {
      mark("fill");
      const o = osc("sine", hz(semi - 12), t, t + 0.35), g = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(hz(semi - 17), t + 0.25);
      env(g, t, 0.003, vel, 0.01, 0.25); o.connect(g).connect(n.layer.drums);
    },
    // Comms beep accent: two short sine blips, like a radio check.
    comms(t, vel) {
      mark("comms");
      [0, 0.09].forEach((d, k) => { const o = osc("sine", k ? 2349 : 1760, t + d, t + d + 0.08), g = ctx.createGain(); env(g, t + d, 0.003, vel, 0.03, 0.03); o.connect(g).connect(n.layer.hats); });
    },
    // Critical-danger alarm: a soft two-tone pulse, filtered so it nags without scaring.
    alarm(t, beat, vel) {
      mark("alarm");
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1700; f.connect(n.layer.alarm);
      [[19, 0], [15, 2]].forEach(([semi, at]) => {
        const s = t + at * beat, o = osc("square", hz(semi), s, s + beat * 1.6), g = ctx.createGain();
        env(g, s, 0.02, vel, beat * 1.2, 0.2); o.connect(g).connect(f);
      });
    },
    // Noise riser into big moments.
    riser(t, dest, seconds = 0.9) {
      mark("riser");
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = n.noise; s.loop = true; f.type = "bandpass"; f.Q.value = 3;
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(5000, t + seconds);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + seconds * 0.8); g.gain.linearRampToValueAtTime(0, t + seconds + 0.2);
      s.connect(f).connect(g).connect(dest); s.start(t); s.stop(t + seconds + 0.3);
    },
    // "Signal lost": a saw sliding down two octaves while its filter closes, like a system powering off.
    powerDown(t, dest) {
      mark("powerDown");
      const o = osc("sawtooth", hz(12), t, t + 1.7), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.frequency.setValueAtTime(hz(12), t); o.frequency.exponentialRampToValueAtTime(hz(-12), t + 1.4);
      f.type = "lowpass"; f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(120, t + 1.5);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.03); g.gain.linearRampToValueAtTime(0, t + 1.6);
      o.connect(f).connect(g).connect(dest);
    }
  };
}
