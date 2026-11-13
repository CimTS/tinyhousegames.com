/* Slotchinko board layout: walls, pegs, bumpers, wells, buckets and drains. */
(() => {
  "use strict";
  const { Bodies, Composite } = window.Matter;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const PlinkoPhysics = window.PlinkoPhysics,
    COLORS = PlinkoPhysics.COLORS;

  // [row, peg from the left]; mirrored on the right.
  PlinkoPhysics.BUMPER_SPOTS = [[6, 3]];
  PlinkoPhysics.prototype._buildBoard = function () {
    Composite.clear(this.world, false);
    this.balls.clear();
    this.pegs.clear();
    this.movers = [];
    this.wells = [];
    this.bumpers = [];
    const w = this.width,
      h = this.height;
    const wallOpts = {
      isStatic: true,
      label: "wall",
      render: { fillStyle: "#26344d" },
      collisionFilter: { category: 0x0002, mask: 0x0001 }
    };
    Composite.add(this.world, [
      Bodies.rectangle(-8, h / 2, 16, h * 4, wallOpts),
      Bodies.rectangle(w + 8, h / 2, 16, h * 4, wallOpts),
      Bodies.rectangle(w / 2, h + 12, w, 24, wallOpts)
    ]);

    const rows = clamp(Math.floor((h - 82) / 24), 5, 8);
    const spacingX = Math.min(37, (w - 48) / (rows + 1));
    const spacingY = Math.min(27, (h - 84) / rows);
    const top = 34;
    const pegTypes =
      this.round >= 2 ? ["heart", "spade", "diamond", "club"] : ["neutral", "neutral", "neutral", "diamond"];
    for (let r = 0; r < rows; r++) {
      const count = r + 3;
      const rowWidth = (count - 1) * spacingX;
      for (let c = 0; c < count; c++) {
        const x = w / 2 - rowWidth / 2 + c * spacingX;
        if (x < 14 || x > w - 14) continue;
        // Bumper buff: the two pegs above the pockets beside the x4 are swapped for bumpers. The middle lane stays clear.
        if (
          this.bumperOn &&
          (this.bumperSpots || PlinkoPhysics.BUMPER_SPOTS).some(
            s => s[0] === r && (s[1] === c || s[1] === count - 1 - c)
          )
        ) {
          const b = Bodies.circle(x, top + r * spacingY, 6.5, {
            isStatic: true,
            label: "bumper",
            restitution: 1,
            friction: 0,
            render: { fillStyle: "#45f3e2", strokeStyle: "#ffffff", lineWidth: 1 },
            collisionFilter: { category: 0x0002, mask: 0x0001 },
            plugin: { hitAt: -1e6 }
          });
          this.bumpers.push(b);
          Composite.add(this.world, b);
          continue;
        }
        const type = pegTypes[(r * 3 + c * 5 + this.round) % pegTypes.length];
        const hp = type === "spade" ? 3 : 2;
        const peg = Bodies.circle(x, top + r * spacingY, 3.25, {
          isStatic: true,
          label: "peg",
          restitution: 0.76,
          friction: 0.035,
          render: { fillStyle: COLORS[type] || COLORS.neutral, strokeStyle: "#dbe8ff", lineWidth: 0.55 },
          collisionFilter: { category: 0x0002, mask: 0x0001 },
          plugin: { element: type, hp, maxHp: hp, charge: 0, stickyUntil: 0, pegId: `${r}:${c}` }
        });
        this.pegs.set(peg.id, peg);
        Composite.add(this.world, peg);
      }
    }

    // Moving bumpers use kinematic position updates (no constraints).
    const moverCount = this.round >= 3 ? (this.round >= 6 ? 2 : 1) : 0;
    for (let i = 0; i < moverCount; i++) {
      const y = Math.min(h * 0.43, 92 + i * 35);
      const mover = Bodies.circle(w * (i ? 0.34 : 0.66), y, 6, {
        isStatic: true,
        label: "mover",
        restitution: 1.05,
        friction: 0,
        render: { fillStyle: COLORS.hazard, strokeStyle: "#ffd1e6", lineWidth: 1 },
        collisionFilter: { category: 0x0002, mask: 0x0001 },
        plugin: { baseY: y, phase: i * Math.PI, speed: 1.05 + i * 0.22, amplitude: w * (0.14 + i * 0.015) }
      });
      this._placeMover(mover, 0);
      this.movers.push(mover);
      Composite.add(this.world, mover);
    }

    // Gravity wells pull gently toward their center; high rounds add a second well.
    if (this.round >= 2) {
      const count = this.round >= 6 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        this.wells.push({
          x: w * (count === 1 ? 0.5 : i ? 0.72 : 0.28),
          y: h * (i ? 0.57 : 0.48),
          radius: Math.min(w, h) * 0.28,
          strength: 0.2 + 0.03 * Math.min(this.round, 9),
          phase: i * 2.4
        });
      }
    }

    // Bottom pockets and separators.
    const bucketY = h - 19,
      bucketW = w / 7;
    this.dividers = [];
    this.wideCenter = false;
    for (let i = 1; i < 7; i++) {
      const d = Bodies.rectangle(i * bucketW, bucketY - 9, 3, 19, {
        isStatic: true,
        label: "divider",
        render: { fillStyle: "#34445f" },
        collisionFilter: { category: 0x0002, mask: 0x0001 }
      });
      this.dividers.push(d);
      Composite.add(this.world, d);
    }
    // Outer pockets turn into hazard drains from DRAIN_ROUND on.
    this.drainPockets = this.round >= (this.drainRound || window.SlotchinkoData.BALANCE.DRAIN_ROUND) ? [0, 6] : [];
  };
})();
