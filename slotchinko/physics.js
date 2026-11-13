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
  const MAX_SPEED = 11,
    BUCKET_LIP = 6,
    FORTUNE_BUCKET = 1.15,
    WELL_MAX_PULL = 0.7;
  const PEG_COOLDOWN_STEPS = 9,
    STUCK_NUDGE_STEPS = 75,
    STUCK_LIMIT_STEPS = 420,
    BALL_LIMIT_STEPS = 900;
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
      this.width = 340;
      this.height = 270;
      this.round = 1;
      this.balls = new Map();
      this.pegs = new Map();
      this.movers = [];
      this.wells = [];
      this.drainPockets = [];
      this.bucketValues = [0.5, 1, 2, 4, 2, 1, 0.5];
      this.clock = 0;
      this.nudges = 0;
      this._bindEvents();
      this._buildBoard();
    }

    step() {
      Engine.update(this.engine, STEP_MS);
    }

    setRound(round) {
      this.round = Math.max(1, Math.floor(Number(round) || 1));
      this.clock = 0;
      this._buildBoard();
    }

    _bindEvents() {
      Events.on(this.engine, "collisionStart", event => {
        for (const pair of event.pairs) {
          const a = pair.bodyA,
            b = pair.bodyB;
          const ball = a.label === "ball" ? a : b.label === "ball" ? b : null;
          if (!ball || !this.balls.has(ball.id)) continue;
          const other = ball === a ? b : a;
          if (other.label === "peg") this._pegInteraction(ball, other);
          else if (other.label === "mover") this.callbacks.onObstacleHit?.({ ball, obstacle: other });
          else if (other.label === "bumper") this._bump(ball, other);
        }
      });
      Events.on(this.engine, "beforeUpdate", () => {
        const t = (this.clock * STEP_MS) / 1000;
        for (const mover of this.movers) this._placeMover(mover, t);
        for (const ball of [...this.balls.values()]) this._updateBall(ball);
        this.clock++;
      });
    }

    _placeMover(mover, t) {
      const p = mover.plugin;
      Body.setPosition(mover, {
        x: this.width / 2 + Math.sin(t * p.speed + p.phase) * p.amplitude,
        y: p.baseY + Math.cos(t * p.speed * 0.7 + p.phase) * 5
      });
    }

    _updateBall(ball) {
      const p = ball.plugin;
      if (this.clock % 2 === 0) this._applyWells(ball);
      if (p.stickyUntil && this.clock >= p.stickyUntil) {
        p.stickyUntil = 0;
        ball.frictionAir = p.baseFrictionAir;
      }
      // A speed cap keeps every ball from tunneling through a peg in one step.
      if (ball.speed > MAX_SPEED)
        Body.setVelocity(ball, {
          x: (ball.velocity.x * MAX_SPEED) / ball.speed,
          y: (ball.velocity.y * MAX_SPEED) / ball.speed
        });
      // Landing is a position check, so no speed can skip a pocket.
      if (ball.position.y + ball.circleRadius >= this.height - BUCKET_LIP) {
        this._finishBall(ball);
        return;
      }
      if (ball.position.y > p.bestY + 2) {
        p.bestY = ball.position.y;
        p.bestYAt = this.clock;
      }
      const idle = this.clock - p.bestYAt;
      if (idle >= STUCK_LIMIT_STEPS || this.clock - p.spawnedAt >= BALL_LIMIT_STEPS) this._finishBall(ball);
      else if (idle && idle % STUCK_NUDGE_STEPS === 0) {
        Body.setVelocity(ball, { x: (this.random() - 0.5) * 3.2, y: 1.2 });
        this.nudges++;
      }
    }

    /* Wells bend a fall; the pull is capped below gravity so they can never hold a ball. */
    _applyWells(ball) {
      // Magnet Core: a gentle sideways pull toward the centre pocket, stronger lower down.
      if (ball.plugin.magnet) {
        const dx = this.width / 2 - ball.position.x,
          depth = clamp(ball.position.y / this.height, 0, 1);
        if (Math.abs(dx) > 2)
          Body.applyForce(ball, ball.position, {
            x:
              Math.sign(dx) *
              ball.mass *
              this.engine.gravity.scale *
              0.09 *
              ball.plugin.magnet *
              depth *
              Math.min(1, Math.abs(dx) / 40),
            y: 0
          });
      }
      for (const well of this.wells) {
        const dx = well.x - ball.position.x,
          dy = well.y - ball.position.y;
        const d = Math.hypot(dx, dy);
        if (d < well.radius && d > 10) {
          const pull = Math.min(WELL_MAX_PULL, well.strength * (ball.plugin.wellPull || 1) * (1 - d / well.radius));
          const force = (ball.mass * this.engine.gravity.scale * pull) / d;
          Body.applyForce(ball, ball.position, { x: dx * force, y: dy * force });
        }
      }
    }

    _pegInteraction(ball, peg) {
      const p = ball.plugin,
        data = peg.plugin;
      if (!p || !data) return;
      // Cooldown stops solver jitter counting one bounce as several hits.
      if (p.lastPeg === peg.id && this.clock - p.lastPegAt < PEG_COOLDOWN_STEPS) return;
      p.lastPeg = peg.id;
      p.lastPegAt = this.clock;
      p.pegHits = (p.pegHits || 0) + 1;
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

    /* Bumper: kicks the ball up and sideways, away from itself. Each kick adds to the ball's score, up to a cap. */
    _bump(ball, bumper) {
      const p = ball.plugin,
        B = window.SlotchinkoData.BALANCE;
      if (p.lastBump != null && this.clock - p.lastBump < PEG_COOLDOWN_STEPS) return;
      p.lastBump = this.clock;
      p.bumps = Math.min(B.BUMP_CAP, (p.bumps || 0) + 1);
      const dir = Math.sign(ball.position.x - bumper.position.x) || (this.random() < 0.5 ? -1 : 1);
      const k = this.bumpKick || [2, 1, -1];
      Body.setVelocity(ball, { x: dir * (k[0] + this.random() * k[1]), y: Math.min(ball.velocity.y, k[2]) });
      bumper.plugin.hitAt = this.clock;
      this.callbacks.onObstacleHit?.({ ball, obstacle: bumper });
    }
    /* Tilt: one shove toward the middle for every ball in play. */
    tilt() {
      for (const ball of this.balls.values()) {
        const dx = this.width / 2 - ball.position.x;
        Body.setVelocity(ball, {
          x: ball.velocity.x * 0.3 + Math.sign(dx) * Math.min(4.5, Math.abs(dx) / 14),
          y: Math.min(ball.velocity.y, 0.5) - 1
        });
      }
      this.tiltAt = this.clock;
    }
    /* Golden Peg: one random standing peg turns gold for the drop and cannot break. */
    gildPeg(random = this.random) {
      const list = [...this.pegs.values()];
      if (!list.length) return null;
      const peg = list[Math.floor(random() * list.length)];
      peg.plugin.gold = true;
      peg.plugin.hpSaved = peg.plugin.hp;
      peg.plugin.hp = 999;
      return peg;
    }
    ungild() {
      for (const peg of this.pegs.values())
        if (peg.plugin.gold) {
          peg.plugin.gold = false;
          peg.plugin.hp = peg.plugin.hpSaved || peg.plugin.maxHp;
        }
    }

    _splitBall(parent) {
      const p = parent.plugin;
      const offset = 7;
      const child = this._createBall(
        clamp(parent.position.x + (this.random() < 0.5 ? -offset : offset), 10, this.width - 10),
        parent.position.y - 2,
        Math.max(3.7, parent.circleRadius * 0.82),
        {
          ...p,
          parentId: parent.id,
          splitsLeft: p.chain ? 1 : 0,
          chain: false,
          splitAt: 1,
          pegHits: 0,
          glass: 0,
          lastPeg: null,
          lastBump: null,
          multiplier: (p.multiplier || 1) * 0.65
        }
      );
      Body.setVelocity(child, {
        x: parent.velocity.x + (this.random() - 0.5) * 2.2,
        y: Math.max(0.5, parent.velocity.y * 0.78)
      });
      this.callbacks.onBallSpawn?.({ ball: child, parent, reason: "split" });
    }

    _createBall(x, y, radius, plugin = {}) {
      const element = plugin.element || "heart";
      const frictionAir = plugin.sticky ? 0.018 : 0.002;
      const bounce =
        (plugin.heavy ? 0.34 : plugin.sticky ? 0.42 : 0.7) * (1 - (plugin.plating || 0)) * (1 + (plugin.bounce || 0));
      const ball = Bodies.circle(x, y, radius, {
        label: "ball",
        restitution: bounce,
        friction: plugin.sticky ? 0.18 : 0.012,
        frictionAir,
        density: plugin.heavy ? 0.004 : 0.0015,
        render: { fillStyle: PlinkoPhysics.COLORS[element] || "#45f3e2", strokeStyle: "#ffffff", lineWidth: 1 },
        collisionFilter: { category: 0x0001, mask: 0x0002 }
      });
      ball.plugin = {
        ...plugin,
        element,
        baseFrictionAir: frictionAir,
        spawnedAt: this.clock,
        bestY: y,
        bestYAt: this.clock,
        charge: plugin.charge || 0
      };
      this.balls.set(ball.id, ball);
      Composite.add(this.world, ball);
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

    /* Pocket edges in world x (8 values for 7 pockets). Wide Jackpot gives the x4 pocket the inner
       half of each neighbour. Drawing and scoring both read these, so what you see is what scores. */
    pocketEdges(wide = this.wideCenter) {
      const bw = this.width / 7,
        e = [0, 1, 2, 3, 4, 5, 6, 7].map(i => i * bw);
      if (wide) {
        e[3] = 2.5 * bw;
        e[4] = 4.5 * bw;
      }
      return e;
    }
    pocketAt(x, wide = this.wideCenter) {
      const e = this.pocketEdges(wide);
      for (let i = 0; i < 7; i++) if (x < e[i + 1]) return i;
      return 6;
    }
    /* What a pocket pays before per-ball bonuses (fortune, charge). Labels and scoring both read this.
       centerMult: Jackpot Funnel on the x4 pocket; the board keeps the owned value for drawing. */
    pocketValue(i, p = {}) {
      const v = this.bucketValues[i],
        m = p.centerMult ?? this.centerMult ?? 1;
      if (this.mystery && i === this.mystery.index) return this.mystery.value;
      // Loaded Die doubles its pocket, but never whichever pocket holds the top value.
      const die = i === this.die && v < Math.max(...this.bucketValues) ? window.SlotchinkoData.BALANCE.DIE_MULT : 1;
      return (i === 3 ? v * m : v) * die;
    }
    /* Turns Wide Jackpot on or off for the board: moves the two centre dividers to the new edges. */
    setWideCenter(on) {
      this.wideCenter = !!on;
      const e = this.pocketEdges();
      (this.dividers || []).forEach((d, k) => Body.setPosition(d, { x: e[k + 1], y: d.position.y }));
    }

    /* The pocket comes from x; on drain rounds the two outer pockets are hazards. */
    _finishBall(ball) {
      if (!ball || !this.balls.has(ball.id)) return;
      this.balls.delete(ball.id);
      Composite.remove(this.world, ball);
      const bw = this.width / 7,
        p = ball.plugin;
      let pocket = this.pocketAt(clamp(ball.position.x, 0, this.width - 0.01), this.wideCenter || !!p.wideCenter),
        nudged = false;
      // Nudge: a ball bound for a drain or a x0.5 pocket moves one pocket inward.
      if (p.nudge && (this.drainPockets.includes(pocket) || this.bucketValues[pocket] < 1)) {
        pocket += pocket < 3 ? 1 : -1;
        nudged = true;
      }
      const drained = this.drainPockets.includes(pocket);
      let value = this.pocketValue(pocket, p);
      if (!drained && p.fortune) value *= FORTUNE_BUCKET;
      value *= p.multiplier || 1;
      if (!drained && p.charge) value *= 1 + Math.min(0.15, p.charge * 0.05);
      this.callbacks.onBucket?.({ ball, index: pocket, multiplier: value, drained, nudged, element: p.element });
    }
  }

  PlinkoPhysics.MAX_BALLS = MAX_BALLS;
  PlinkoPhysics.COLORS = {
    heart: "#ff5c91",
    spade: "#c4d5ff",
    diamond: "#ffbd55",
    club: "#75f2b0",
    neutral: "#7186aa",
    hazard: "#ff4fa3",
    well: "#a78bfa"
  };
  window.PlinkoPhysics = PlinkoPhysics;
})();
