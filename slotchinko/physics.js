/*
 * Slotchinko plinko simulation. Matter.js 0.19, stepped manually at a fixed 60 Hz in a
 * fixed logical world, so a seed plays out the same on every screen size. Drawing lives
 * in boardview.js and board construction in board.js.
 * API: new PlinkoPhysics(callbacks, randomStream), setRound(round), drop(options), step().
 */
(() => {
  "use strict";
  const { Engine, Bodies, Body, Composite, Events } = window.Matter;
  const MAX_BALLS = 22;
  const MAX_SPEED = 11, BUCKET_LIP = 6, FORTUNE_BUCKET = 1.15, WELL_MAX_PULL = 0.7;
  const PEG_COOLDOWN_STEPS = 9, STUCK_NUDGE_STEPS = 75, STUCK_LIMIT_STEPS = 420, BALL_LIMIT_STEPS = 900;
  const STEP_MS = 1000 / 60;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  class PlinkoPhysics {
    constructor(callbacks = {}, random = Math.random) {
      this.callbacks = callbacks;
      this.random = random;
      this.engine = Engine.create();
      this.engine.gravity.y = 1;
      this.engine.positionIterations = 5;
      this.engine.velocityIterations = 4;
      this.engine.constraintIterations = 2;
      this.world = this.engine.world;
      this.width = 340; this.height = 270; this.round = 1;
      this.balls = new Map(); this.pegs = new Map(); this.movers = [];
      this.wells = []; this.drainPockets = []; this.bucketValues = [0.5, 1, 2, 4, 2, 1, 0.5];
      this.clock = 0; this.nudges = 0;
      this._bindEvents();
      this._buildBoard();
    }

    step() { Engine.update(this.engine, STEP_MS); }

    setRound(round) {
      this.round = Math.max(1, Math.floor(Number(round) || 1));
      this.clock = 0;
      this._buildBoard();
    }

    _bindEvents() {
      Events.on(this.engine, "collisionStart", event => {
        for (const pair of event.pairs) {
          const a = pair.bodyA, b = pair.bodyB;
          const ball = a.label === "ball" ? a : b.label === "ball" ? b : null;
          if (!ball || !this.balls.has(ball.id)) continue;
          const other = ball === a ? b : a;
          if (other.label === "peg") this._pegInteraction(ball, other);
          else if (other.label === "mover") this.callbacks.onObstacleHit?.({ ball, obstacle: other });
        }
      });
      Events.on(this.engine, "beforeUpdate", () => {
        const t = this.clock * STEP_MS / 1000;
        for (const mover of this.movers) this._placeMover(mover, t);
        for (const ball of [...this.balls.values()]) this._updateBall(ball);
        this.clock++;
      });
    }

    _placeMover(mover, t) {
      const p = mover.plugin;
      Body.setPosition(mover, { x: this.width / 2 + Math.sin(t * p.speed + p.phase) * p.amplitude,
        y: p.baseY + Math.cos(t * p.speed * 0.7 + p.phase) * 5 });
    }

    _updateBall(ball) {
      const p = ball.plugin;
      if (this.clock % 2 === 0) this._applyWells(ball);
      if (p.stickyUntil && this.clock >= p.stickyUntil) { p.stickyUntil = 0; ball.frictionAir = p.baseFrictionAir; }
      // A speed cap keeps every ball from tunneling through a peg in one step.
      if (ball.speed > MAX_SPEED) Body.setVelocity(ball, { x: ball.velocity.x * MAX_SPEED / ball.speed, y: ball.velocity.y * MAX_SPEED / ball.speed });
      // Landing is a position check, so no speed can skip a pocket.
      if (ball.position.y + ball.circleRadius >= this.height - BUCKET_LIP) { this._finishBall(ball); return; }
      if (ball.position.y > p.bestY + 2) { p.bestY = ball.position.y; p.bestYAt = this.clock; }
      const idle = this.clock - p.bestYAt;
      if (idle >= STUCK_LIMIT_STEPS || this.clock - p.spawnedAt >= BALL_LIMIT_STEPS) this._finishBall(ball);
      else if (idle && idle % STUCK_NUDGE_STEPS === 0) {
        Body.setVelocity(ball, { x: (this.random() - 0.5) * 3.2, y: 1.2 });
        this.nudges++;
      }
    }

    /* Wells bend a fall; the pull is capped below gravity so they can never hold a ball. */
    _applyWells(ball) {
      for (const well of this.wells) {
        const dx = well.x - ball.position.x, dy = well.y - ball.position.y;
        const d = Math.hypot(dx, dy);
        if (d < well.radius && d > 10) {
          const pull = Math.min(WELL_MAX_PULL, well.strength * (ball.plugin.wellPull || 1) * (1 - d / well.radius));
          const force = ball.mass * this.engine.gravity.scale * pull / d;
          Body.applyForce(ball, ball.position, { x: dx * force, y: dy * force });
        }
      }
    }

    _pegInteraction(ball, peg) {
      const p = ball.plugin, data = peg.plugin;
      if (!p || !data) return;
      // Cooldown stops solver jitter counting one bounce as several hits.
      if (p.lastPeg === peg.id && this.clock - p.lastPegAt < PEG_COOLDOWN_STEPS) return;
      p.lastPeg = peg.id; p.lastPegAt = this.clock; p.pegHits = (p.pegHits || 0) + 1;
      this.callbacks.onPegHit?.(ball, peg);
      data.hp -= p.damage || 1;
      if (p.fortune || data.element === "diamond") {
        data.charge = Math.min(3, (data.charge || 0) + 1);
        p.charge = Math.min(3, (p.charge || 0) + 1);
      }
      if (p.sticky || data.element === "club") {
        p.stickyUntil = this.clock + 27;
        ball.frictionAir = 0.045;
        const keep = 0.78 * (1 - (p.sticky ? p.stick || 0 : 0));
        Body.setVelocity(ball, { x: ball.velocity.x * keep, y: ball.velocity.y * keep });
      }
      if (p.splitsLeft > 0 && p.pegHits >= p.splitAt && this.balls.size < MAX_BALLS) {
        p.splitsLeft--;
        this._splitBall(ball);
      }
      if (data.hp <= 0) {
        this.pegs.delete(peg.id);
        Composite.remove(this.world, peg);
        this.callbacks.onPegDestroyed?.({ peg, element: data.element, ball });
      } else if (data.charge) {
        peg.render.fillStyle = data.charge >= 2 ? "#fff0a6" : "#ffbd55";
      }
    }

    _splitBall(parent) {
      const p = parent.plugin;
      const offset = 7;
      const child = this._createBall(clamp(parent.position.x + (this.random() < 0.5 ? -offset : offset), 10, this.width - 10),
        parent.position.y - 2, Math.max(3.7, parent.circleRadius * 0.82), {
          ...p, parentId: parent.id, splitsLeft: p.chain ? 1 : 0, chain: false, splitAt: 1, pegHits: 0, glass: 0,
          lastPeg: null, multiplier: (p.multiplier || 1) * 0.65
        });
      Body.setVelocity(child, { x: parent.velocity.x + (this.random() - 0.5) * 2.2, y: Math.max(0.5, parent.velocity.y * 0.78) });
      this.callbacks.onBallSpawn?.({ ball: child, parent, reason: "split" });
    }

    _createBall(x, y, radius, plugin = {}) {
      const element = plugin.element || "heart";
      const frictionAir = plugin.sticky ? 0.018 : 0.002;
      const bounce = (plugin.heavy ? 0.34 : plugin.sticky ? 0.42 : 0.7) * (1 - (plugin.plating || 0));
      const ball = Bodies.circle(x, y, radius, {
        label: "ball", restitution: bounce,
        friction: plugin.sticky ? 0.18 : 0.012, frictionAir,
        density: plugin.heavy ? 0.004 : 0.0015,
        render: { fillStyle: PlinkoPhysics.COLORS[element] || "#45f3e2", strokeStyle: "#ffffff", lineWidth: 1 },
        collisionFilter: { category: 0x0001, mask: 0x0002 }
      });
      ball.plugin = { ...plugin, element, baseFrictionAir: frictionAir, spawnedAt: this.clock,
        bestY: y, bestYAt: this.clock, charge: plugin.charge || 0 };
      this.balls.set(ball.id, ball); Composite.add(this.world, ball);
      return ball;
    }

    /* options: x, element, heavy, fortune, sticky, damage, wellPull, plating, stick,
       splitsLeft, splitAt, chain, multiplier, suits. Null when the board is full. */
    drop(options = {}) {
      if (this.balls.size >= MAX_BALLS) return null;
      const { x = this.width / 2, heavy = false } = options;
      const ball = this._createBall(clamp(x, 12, this.width - 12), 13, heavy ? 7 : 5.5, { multiplier: 1, ...options });
      Body.setVelocity(ball, { x: (this.random() - 0.5) * 1.3, y: 1 });
      this.callbacks.onBallSpawn?.({ ball, reason: "drop" });
      return ball;
    }

    /* The pocket comes from x; on drain rounds the two outer pockets are hazards. */
    _finishBall(ball) {
      if (!ball || !this.balls.has(ball.id)) return;
      this.balls.delete(ball.id); Composite.remove(this.world, ball);
      const pocket = clamp(Math.floor(ball.position.x / (this.width / 7)), 0, 6);
      const drained = this.drainPockets.includes(pocket);
      const p = ball.plugin;
      let value = this.bucketValues[pocket];
      if (!drained && p.fortune) value *= FORTUNE_BUCKET;
      value *= p.multiplier || 1;
      if (!drained && p.charge) value *= 1 + Math.min(0.15, p.charge * 0.05);
      this.callbacks.onBucket?.({ ball, index: pocket, multiplier: value, drained, element: p.element });
    }
  }

  PlinkoPhysics.MAX_BALLS = MAX_BALLS;
  PlinkoPhysics.COLORS = {
    heart: "#ff5c91", spade: "#c4d5ff", diamond: "#ffbd55", club: "#75f2b0",
    neutral: "#7186aa", hazard: "#ff4fa3", well: "#a78bfa"
  };
  window.PlinkoPhysics = PlinkoPhysics;
})();
