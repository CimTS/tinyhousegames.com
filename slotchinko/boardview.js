/* Slotchinko board drawing. Reads the simulation, never changes it. The canvas scales the
 * fixed logical world to its CSS size, so a resize or rotation cannot disturb a drop. */
(() => {
  "use strict";
  const COLORS = window.PlinkoPhysics.COLORS;
  const FLOAT_MS = 800;

  class BoardView {
    constructor(canvas, getPhysics, reducedMotion) {
      this.canvas = canvas; this.ctx = canvas.getContext("2d");
      this.getPhysics = getPhysics; this.reducedMotion = reducedMotion;
      this.floats = []; this.flashes = new Map(); this.scale = 1;
      this.resize();
      if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => this.resize()).observe(canvas);
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect(); if (!rect.width) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(rect.width * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
      this.scale = this.canvas.width / this.getPhysics().width;
    }

    /* Floating "+points" over the pocket a ball landed in. */
    score(pocket, text, good) {
      const w = this.getPhysics().width / 7;
      this.floats.push({ x: (pocket + 0.5) * w, y: this.getPhysics().height - 40, text, good, born: performance.now() });
      if (this.floats.length > 14) this.floats.shift();
      this.flashes.set(pocket, performance.now());
    }

    draw() {
      const { ctx } = this, ph = this.getPhysics(), now = performance.now();
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      ctx.clearRect(0, 0, ph.width, ph.height);
      for (const well of ph.wells) {
        ctx.beginPath(); ctx.arc(well.x, well.y, well.radius, 0, Math.PI * 2);
        ctx.strokeStyle = "#a78bfa33"; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
      }
      this._buckets(ph, now);
      for (const peg of ph.pegs.values()) this._circle(peg, peg.render.fillStyle, "#dbe8ff", 0.55);
      for (const mover of ph.movers) this._circle(mover, COLORS.hazard, "#ffd1e6", 1);
      for (const ball of ph.balls.values()) this._circle(ball, ball.render.fillStyle, "#ffffff", 1);
      this._floats(now);
    }

    _circle(body, fill, stroke, width) {
      const { ctx } = this;
      ctx.beginPath(); ctx.arc(body.position.x, body.position.y, body.circleRadius, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke();
    }

    _buckets(ph, now) {
      const { ctx } = this, w = ph.width / 7, top = ph.height - 37;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ph.bucketValues.forEach((value, i) => {
        const drain = ph.drainPockets.includes(i), lit = now - (this.flashes.get(i) || -1e6);
        ctx.fillStyle = drain ? "#ff4fa31f" : "#ffd16610"; ctx.fillRect(i * w + 1.5, top, w - 3, 37);
        if (lit < 260 && !this.reducedMotion()) { ctx.fillStyle = `rgba(255,209,102,${0.4 * (1 - lit / 260)})`; ctx.fillRect(i * w + 1.5, top, w - 3, 37); }
        ctx.fillStyle = drain ? "#ff8cc4" : "#ffd166";
        ctx.font = `700 ${drain ? 11 : 13}px 'Barlow Condensed',sans-serif`;
        ctx.fillText(drain ? "DRAIN" : `×${value}`, (i + 0.5) * w, ph.height - 14);
        if (i) { ctx.fillStyle = "#34445f"; ctx.fillRect(i * w - 1.5, top, 3, 19); }
      });
    }

    _floats(now) {
      const { ctx } = this;
      this.floats = this.floats.filter(f => now - f.born < FLOAT_MS);
      ctx.font = "800 15px 'Barlow Condensed',sans-serif"; ctx.textAlign = "center";
      for (const f of this.floats) {
        const t = (now - f.born) / FLOAT_MS, rise = this.reducedMotion() ? 0 : 26 * t;
        ctx.globalAlpha = 1 - t * t; ctx.fillStyle = f.good ? "#45f3e2" : "#ff8cc4";
        ctx.fillText(f.text, f.x, f.y - rise); ctx.globalAlpha = 1;
      }
    }
  }
  window.BoardView = BoardView;
})();
