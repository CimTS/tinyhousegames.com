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

  /* Family sets: for each family with Chips owned, how many (copies count) and how many steps that reaches. */
  function familySets(chips) {
    return FAMILIES.map(f => {
      const count = chips.filter(c => c.family === f.id).length;
      return { family: f, count, step: BALANCE.SET_STEPS.filter(n => count >= n).length };
    }).filter(x => x.count > 0);
  }

  /* Where a family stands, in words: "HEARTS 3 · REGULAR · VIP AT 4". Shown on shop cards and in the Loadout. */
  function standing(set) {
    const { SET_STEPS, SET_TIERS } = BALANCE,
      next = SET_STEPS[set.step];
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
      for (const chip of [...this._chipsInPlay(), ...(this.state.runBuffs || []), ...this._trophyItems()])
        add(totals, chip.effect);
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

    /* Points for one finished ball. physics supplies the bucket multiplier. */
    ballScore({ multiplier, drained = false, ball }, fx) {
      const s = this.state,
        p = ball ? ball.plugin : {},
        suits = p.suits || [s.primarySuit],
        has = x => suits.includes(x);
      let synergy = 1 + fx.allElementScore;
      if (has("diamond")) synergy += fx.fortune + fx.diamondScore;
      if (has("heart")) synergy += fx.heartScore;
      if (has("club")) synergy += fx.clubScore + Math.min(BALANCE.GRIND_CAP, fx.clubGrind * (p.pegHits || 0));
      if (has("spade")) synergy += fx.spadeScore;
      if (p.parentId) synergy += fx.splitBonus;
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
          (1 + BALANCE.BUMP_BONUS * (p.bumps || 0)) *
          drainFactor
      );
    }
  };
})();
