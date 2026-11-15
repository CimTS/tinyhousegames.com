/* Slotchinko scoring: sums owned Chips and the family steps they reach into effect totals, and scores each ball.
   Numbers add between copies, except scoreMult, which multiplies. */
(() => {
  "use strict";
  const { BALANCE } = window.SlotchinkoData;
  const { FAMILIES } = window.SlotchinkoData;

  /* Adds one effect (a Chip's, or a family step's) into the totals. */
  function add(totals, effect) {
    for (const [key, value] of Object.entries(effect || {})) {
      if (key === "scoreMult") totals[key] *= value;
      else if (typeof value === "number") totals[key] = (totals[key] || 0) + value;
      else if (value === true) totals[key] = true;
    }
  }

  /* Part of an effect, for the Mirror Dealer's rewards: percentages scale, whole numbers (+1 ball, +2 coins) round
     down, and scoreMult keeps only that share of its gain. scaled({ scoreMult: 1.2, heartScore: 0.3 }, 0.5) is
     { scoreMult: 1.1, heartScore: 0.15 }. */
  function scaled(effect, share) {
    const out = {};
    for (const [key, value] of Object.entries(effect || {})) {
      if (typeof value !== "number") continue;
      out[key] =
        key === "scoreMult"
          ? 1 + (value - 1) * share
          : Number.isInteger(value)
            ? Math.floor(value * share)
            : value * share;
    }
    return out;
  }
  /* How many copies of each Chip id, in the order first owned. */
  function copies(chips) {
    const n = new Map();
    chips.forEach(c => n.set(c.id, (n.get(c.id) || 0) + 1));
    return n;
  }

  /* Family sets: for each family with Chips owned, how many (copies count) and how many steps that reaches.
     Three Chips bend the count, and all three are read from the Chips themselves:
     Double Vision: a Chip owned exactly twice counts once more.
     Players Club: one more Chip in the biggest family.
     Pit Boss: the biggest family needs only PIT_VIP Chips for its second step. */
  function familySets(chips) {
    const has = key => chips.some(c => c.effect?.[key]),
      pairs = has("doubleVision")
        ? [...copies(chips)].filter(([, n]) => n === 2).map(([id]) => chips.find(c => c.id === id))
        : [],
      count = f => chips.filter(c => c.family === f.id).length + pairs.filter(c => c.family === f.id).length,
      // The biggest family by Chips owned; the first in the list on a tie.
      top = FAMILIES.reduce((best, f) => (count(f) > count(best) ? f : best), FAMILIES[0]),
      club = has("playersClub") ? 1 : 0,
      pit = has("pitBoss");
    return FAMILIES.map(f => {
      const n = count(f) + (f === top ? club : 0),
        steps =
          pit && f === top ? BALANCE.SET_STEPS.map((need, i) => (i === 1 ? BALANCE.PIT_VIP : need)) : BALANCE.SET_STEPS;
      return { family: f, count: n, step: steps.filter(need => n >= need).length, steps };
    }).filter(x => x.count > 0);
  }

  /* Where a family stands, in words: "HEARTS 3 · REGULAR · VIP AT 4". Shown on shop cards and in the Loadout. */
  function standing(set) {
    const { SET_TIERS } = BALANCE,
      next = (set.steps || BALANCE.SET_STEPS)[set.step];
    return [
      `${set.family.name.toUpperCase()} ${set.count}`,
      set.step ? SET_TIERS[set.step - 1] : "",
      next ? `${SET_TIERS[set.step]} AT ${next}` : "TOP STEP"
    ]
      .filter(Boolean)
      .join(" · ");
  }

  /* The run's build: the family furthest along once it reaches VIP, or The Nuts for a deck stacked with Aces. */
  function build(sets, aces) {
    const best = [...sets].sort((a, b) => b.step - a.step || b.count - a.count)[0];
    if (best && best.step >= 2)
      return { name: best.family.build, tier: BALANCE.SET_TIERS[best.step - 1], icon: best.family.icon };
    return aces >= BALANCE.NUTS_ACES ? { name: "The Nuts", tier: "", icon: "A" } : null;
  }

  window.SlotchinkoSets = { familySets, standing, build };
  window.SlotchinkoScoring = {
    _effects() {
      const totals = {
        scoreMult: 1,
        extraBalls: 0,
        fortune: 0,
        allElementScore: 0,
        wellPull: 0,
        spadeWell: 0,
        spadeScore: 0,
        spadeDamage: 0,
        diamondScore: 0,
        clubScore: 0,
        splitBonus: 0,
        splitChain: 0,
        reactor: 0,
        plating: 0,
        stickPower: 0,
        heartScore: 0,
        heartPerHeart: 0,
        offSuit: false,
        secondSuit: false,
        frenzy: false,
        flushBalls: 0,
        wallBonus: 0,
        bumpBoost: 0,
        sandbar: 0,
        lowTide: 0,
        remix: 0,
        spitting: 0,
        doubleVision: false,
        mirrorExtra: 0,
        twinSet: 0,
        extraStack: 0,
        hall: 0,
        playersClub: false,
        pitBoss: false,
        flushCoins: 0,
        shopChips: 0,
        loyalty: 0,
        heartBalls: 0,
        clubGrind: 0,
        steady: false,
        diamondCoins: 0,
        spadeEdge: 0,
        discount: 0,
        launchSpread: 0,
        coinsPerBlind: 0,
        pressCoins: 0,
        flushBonus: 0,
        suitDiversity: 0,
        fourSuitBonus: 0,
        diamondBonus: 0,
        clubCoins: 0,
        glass: 0,
        drainHalf: false,
        loadedDie: 0,
        secondWind: 0,
        pawn: 0,
        fewerHands: 0,
        mystery: 0,
        bumper: 0
      };
      const chips = this._chipsInPlay();
      for (const chip of [...chips, ...(this.state.runBuffs || []), ...this._trophyItems()]) add(totals, chip.effect);
      this._mirrors(totals, chips);
      // Each family step reached adds its effect, and counts as one set (bosses and trophies count sets).
      totals.sets = familySets(this.state.chips);
      totals.synergies = [];
      for (const set of totals.sets)
        for (let i = 0; i < set.step; i++) {
          add(totals, set.family.steps[i].effect);
          totals.synergies.push(`${set.family.name.toUpperCase()} ${BALANCE.SET_TIERS[i]}`);
        }
      return totals;
    },

    /* The Mirror Dealer's rewards, which work on copies of Chips. chips is what is in play (his own fight thins it). */
    _mirrors(totals, chips) {
      const n = copies(chips),
        first = id => chips.find(c => c.id === id),
        twice = [...n].filter(([, count]) => count >= 2).map(([id]) => id);
      // Spitting Image: the second copy of each doubled Chip gives half as much again.
      if (totals.spitting) for (const id of twice) add(totals, scaled(first(id).effect, totals.spitting));
      // Two-Way Mirror: the Chip with the most copies (the first owned, on a tie) works once more. Not itself.
      if (totals.mirrorExtra) {
        const most = [...n].filter(([id]) => !first(id).effect?.mirrorExtra).sort((a, b) => b[1] - a[1])[0];
        if (most) add(totals, first(most[0]).effect);
      }
      // Hall of Mirrors: every two Chips add a share to every Chip's effect.
      const hall = totals.hall * Math.floor(chips.length / 2);
      if (hall) for (const chip of chips) add(totals, scaled(chip.effect, hall));
      // Twin Set: score for every doubled Chip.
      if (totals.twinSet) totals.scoreMult *= 1 + totals.twinSet * twice.length;
    },

    /* Points for one finished ball. physics supplies the bucket multiplier. */
    ballScore({ multiplier, drained = false, ball }, fx) {
      const s = this.state,
        p = ball ? ball.plugin : {},
        suits = p.suits || [s.primarySuit],
        has = x => suits.includes(x);
      let synergy = 1 + fx.allElementScore;
      if (has("diamond")) synergy += fx.fortune + fx.diamondScore;
      if (has("heart")) synergy += fx.heartScore + fx.heartPerHeart * s.cards.filter(c => c.suit === "heart").length;
      if (has("club")) synergy += fx.clubScore + Math.min(BALANCE.GRIND_CAP, fx.clubGrind * (p.pegHits || 0));
      if (has("spade")) synergy += fx.spadeScore;
      if (p.parentId) synergy += fx.splitBonus;
      if (p.walled) synergy += fx.wallBonus;
      if (s.lastEvaluation && s.lastEvaluation.flush) synergy += fx.flushBonus;
      const distinct = new Set(s.cards.map(c => c.suit)).size;
      synergy += distinct * fx.suitDiversity;
      if (distinct === 4) synergy += fx.fourSuitBonus;
      // Rubber Pegs: +10% at 0.25 bounce
      synergy += 0.4 * this._boost(s.activeBoosts || [], "bounce");
      const drainFactor = drained ? (fx.drainHalf ? 0.5 : 0) : 1;
      return Math.round(
        BALANCE.BASE_BALL_SCORE *
          s.power *
          multiplier *
          fx.scoreMult *
          synergy *
          (p.glass || 1) *
          (p.gilded || 1) *
          (p.tide || 1) *
          // Pinball Wizard doubles each kick; the most a ball can gain from bumpers stays the same.
          (1 +
            Math.min(BALANCE.BUMP_BONUS * BALANCE.BUMP_CAP, BALANCE.BUMP_BONUS * (1 + fx.bumpBoost) * (p.bumps || 0))) *
          drainFactor
      );
    }
  };
})();
