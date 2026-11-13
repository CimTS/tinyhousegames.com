/* Slotchinko board drawing. Reads the simulation, never changes it. The canvas scales the
 * fixed logical world to its CSS size, so a resize or rotation cannot disturb a drop. */
(() => {
  "use strict";
  const COLORS = window.PlinkoPhysics.COLORS;
  const FLOAT_MS = 800;

  class BoardView {
    constructor(canvas, getPhysics, reducedMotion) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.getPhysics = getPhysics;
      this.reducedMotion = reducedMotion;
      this.floats = [];
      this.flashes = new Map();
      this.scale = 1;
      this.resize();
      if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => this.resize()).observe(canvas);
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(rect.width * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
      this.scale = this.canvas.width / this.getPhysics().width;
    }

    /* Floating "+points" over the pocket a ball landed in. */
    score(pocket, text, good) {
      const e =
        this.getPhysics().pocketEdges?.() || [0, 1, 2, 3, 4, 5, 6, 7].map(i => (i * this.getPhysics().width) / 7);
      this.floats.push({
        x: (e[pocket] + e[pocket + 1]) / 2,
        y: this.getPhysics().height - 40,
        text,
        good,
        born: performance.now()
      });
      if (this.floats.length > 14) this.floats.shift();
      this.flashes.set(pocket, performance.now());
    }

    draw() {
      const { ctx } = this,
        ph = this.getPhysics(),
        now = performance.now();
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      ctx.clearRect(0, 0, ph.width, ph.height);
      for (const well of ph.wells) {
        ctx.beginPath();
        ctx.arc(well.x, well.y, well.radius, 0, Math.PI * 2);
        ctx.strokeStyle = "#a78bfa33";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      this._buckets(ph, now);
      for (const peg of ph.pegs.values()) {
        if (!peg.plugin.gold) {
          this._circle(peg, peg.render.fillStyle, "#dbe8ff", 0.55);
          continue;
        }
        // Golden Peg: gold, with a ring so it reads at a glance.
        this._circle(peg, "#ffd166", "#fff6cf", 1);
        ctx.beginPath();
        ctx.arc(peg.position.x, peg.position.y, peg.circleRadius + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffd166cc";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      for (const b of ph.bumpers || []) {
        const lit = ph.clock - b.plugin.hitAt < 8 && !this.reducedMotion();
        this._circle(b, lit ? "#c8fff8" : "#123b44", "#45f3e2", 1.6);
        ctx.beginPath();
        ctx.arc(b.position.x, b.position.y, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = "#45f3e2";
        ctx.fill();
      }
      for (const mover of ph.movers) this._circle(mover, COLORS.hazard, "#ffd1e6", 1);
      for (const ball of ph.balls.values()) this._circle(ball, ball.render.fillStyle, "#ffffff", 1);
      this._floats(now);
    }

    _circle(body, fill, stroke, width) {
      const { ctx } = this;
      ctx.beginPath();
      ctx.arc(body.position.x, body.position.y, body.circleRadius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    _buckets(ph, now) {
      const { ctx } = this,
        top = ph.height - 37,
        e = ph.pocketEdges(),
        wide = ph.wideCenter;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ph.bucketValues.forEach((value, i) => {
        const x0 = e[i],
          w = e[i + 1] - e[i],
          mid = x0 + w / 2,
          big = wide && i === 3;
        const drain = ph.drainPockets.includes(i),
          lit = now - (this.flashes.get(i) || -1e6);
        const my = ph.mystery && ph.mystery.index === i ? ph.mystery : null,
          die = ph.die === i && !my;
        ctx.fillStyle = drain ? "#ff4fa31f" : my ? "#a78bfa38" : die ? "#45f3e22e" : big ? "#ffd16630" : "#ffd16610";
        ctx.fillRect(x0 + 1.5, top, w - 3, 37);
        if (my || die) {
          ctx.strokeStyle = my ? "#a78bfacc" : "#45f3e2cc";
          ctx.lineWidth = 1;
          ctx.strokeRect(x0 + 2, top + 0.5, w - 4, 36);
        }
        if (big) {
          ctx.strokeStyle = "#ffd166aa";
          ctx.lineWidth = 1;
          ctx.strokeRect(x0 + 2, top + 0.5, w - 4, 36);
        }
        if (lit < 260 && !this.reducedMotion()) {
          ctx.fillStyle = `rgba(255,209,102,${0.4 * (1 - lit / 260)})`;
          ctx.fillRect(x0 + 1.5, top, w - 3, 37);
        }
        ctx.fillStyle = drain ? "#ff8cc4" : my ? "#d6c8ff" : die ? "#8ff8ec" : "#ffd166";
        // Narrow neighbours of a wide x4 get a smaller label so it still fits.
        ctx.font = `700 ${drain ? 11 : big ? 15 : w < 30 ? 10 : 13}px 'Barlow Condensed',sans-serif`;
        ctx.fillText(
          drain ? "DRAIN" : my && !my.shown ? "?" : `×${+(ph.pocketValue?.(i) ?? value).toFixed(2)}`,
          mid,
          ph.height - 14
        );
        if (die) {
          ctx.font = "700 9px 'Barlow Condensed',sans-serif";
          ctx.fillText("DIE ×2", mid, top + 8);
        }
        if (i) {
          ctx.fillStyle = "#34445f";
          ctx.fillRect(x0 - 1.5, top, 3, 19);
        }
      });
    }

    _floats(now) {
      const { ctx } = this;
      this.floats = this.floats.filter(f => now - f.born < FLOAT_MS);
      ctx.font = "800 15px 'Barlow Condensed',sans-serif";
      ctx.textAlign = "center";
      for (const f of this.floats) {
        const t = (now - f.born) / FLOAT_MS,
          rise = this.reducedMotion() ? 0 : 26 * t;
        ctx.globalAlpha = 1 - t * t;
        ctx.fillStyle = f.good ? "#45f3e2" : "#ff8cc4";
        ctx.fillText(f.text, f.x, f.y - rise);
        ctx.globalAlpha = 1;
      }
    }
  }
  window.BoardView = BoardView;
})();
