/* Slotchinko scoring: sums owned Chips into effect totals and scores each ball.
   Numbers add between copies, except scoreMult, which multiplies. */
(() => {
  "use strict";
  const { BALANCE } = window.SlotchinkoData;
  const SYNERGIES = [
    {
      need: ["heart", "split"],
      label: "HEART CIRCUIT +10%",
      apply: t => {
        t.scoreMult *= 1.1;
      }
    },
    {
      need: ["diamond", "fortune"],
      label: "PRISM LUCK +15%",
      apply: t => {
        t.fortune += 0.15;
      }
    },
    {
      need: ["spade", "gravity"],
      label: "SINGULARITY +12%",
      apply: t => {
        t.wellPull += 0.5;
        t.scoreMult *= 1.12;
      }
    },
    {
      need: ["club", "control"],
      label: "ROOT NETWORK +8%",
      apply: t => {
        t.scoreMult *= 1.08;
      }
    },
    {
      need: ["economy", "combo"],
      label: "CASH LOOP +1¢",
      apply: t => {
        t.coinsPerBlind += 1;
      }
    },
    {
      need: ["bounce", "launch"],
      label: "TRICK SHOT +10%",
      apply: t => {
        t.scoreMult *= 1.1;
      }
    },
    {
      need: ["wild", "economy"],
      label: "HOUSE FAVOR +1¢",
      apply: t => {
        t.coinsPerBlind += 1;
      }
    },
    {
      need: ["bucket", "gravity"],
      label: "SINKHOLE +10%",
      apply: t => {
        t.scoreMult *= 1.1;
      }
    },
    {
      need: ["element", "synergy"],
      label: "ELEMENTAL OVERDRIVE +10%",
      apply: t => {
        t.allElementScore += 0.1;
      }
    },
    {
      need: ["bounce", "gravity"],
      label: "PINBALL WIZARD +12%",
      apply: t => {
        t.scoreMult *= 1.12;
      }
    },
    {
      need: ["wild", "balls"],
      label: "LOADED TABLE +1 BALL",
      apply: t => {
        t.extraBalls += 1;
      }
    }
  ];

  /* A set needs two different Chips: one carrying each tag. */
  const setActive = (chips, [a, b]) =>
    chips.some(x => x.tags?.includes(a) && chips.some(y => y.id !== x.id && y.tags?.includes(b)));

  window.SlotchinkoSets = SYNERGIES;
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
      for (const chip of [...this._chipsInPlay(), ...(this.state.runBuffs || []), ...this._trophyItems()]) {
        for (const [key, value] of Object.entries(chip.effect || {})) {
          if (key === "scoreMult") totals[key] *= value;
          else if (typeof value === "number") totals[key] = (totals[key] || 0) + value;
          else if (value === true) totals[key] = true;
        }
      }
      totals.synergies = [];
      for (const set of SYNERGIES)
        if (setActive(this.state.chips, set.need)) {
          set.apply(totals);
          totals.synergies.push(set.label);
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
      if (has("club")) synergy += fx.clubScore;
      if (has("spade")) synergy += fx.spadeScore;
      if (p.parentId) synergy += fx.splitBonus;
      if (s.lastEvaluation && s.lastEvaluation.flush) synergy += fx.flushBonus;
      const distinct = new Set(s.cards.map(c => c.suit)).size;
      synergy += distinct * fx.suitDiversity;
      if (distinct === 4) synergy += fx.fourSuitBonus;
      synergy += 0.4 * this._boost(s.activeBoosts || [], "bounce"); // Rubber Pegs: +10% at 0.25 bounce
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
  window.SlotchinkoSynergies = SYNERGIES;
})();
