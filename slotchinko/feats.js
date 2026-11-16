/* Slotchinko feats: watches a run and earns bingo squares (bingo-data.js). Mixed into SlotchinkoGame.
   The game calls the _feat* hooks at fixed moments; each earned square is added to state.feats and handed to the
   view, which daubs it on the save. Nothing here changes how a run plays. */
(() => {
  "use strict";
  const D = window.SlotchinkoData,
    B = D.BINGO;
  const freshBlind = () => ({
    hands: 0,
    suits: [],
    balls: 0,
    hearts: 0,
    offCentre: false,
    half: false,
    tilt: false,
    landed: 0,
    firstBall: false,
    lastBall: false
  });
  const freshDrop = () => ({ pockets: [], jackpots: 0 });

  window.SlotchinkoFeats = {
    /* The run's feat tracker. Made on demand, so a run saved before feats existed picks one up when it is loaded. */
    _ft() {
      const s = this.state;
      if (!s.feat) s.feat = { blind: freshBlind(), drop: freshDrop(), bought: 0, lounges: 0, elites: 0, rerolls: 0 };
      if (!s.feats) s.feats = [];
      return s.feat;
    },
    /* Earns one square, once per run. The save decides whether it is new. */
    _feat(card, key) {
      const s = this.state,
        id = `${card}:${key}`;
      this._ft();
      // Not every feat is a square on every card (each deck is on one boss's card only).
      if (!B.square(id) || s.feats.includes(id)) return;
      s.feats.push(id);
      this.view?.feat?.(id);
    },
    /* Counts something the save adds up across runs (Lucky Streak, Lou's Regular). */
    _tally(key) {
      this.view?.tally?.(key);
    },
    /* A blind begins (nextRound, and the first blind of a run). */
    _featBlindStart() {
      const ft = this._ft();
      // Window Shopper: the shop that just closed sold nothing.
      if (ft.shopped && !ft.bought) this._feat("lou", "window");
      ft.shopped = false;
      ft.bought = 0;
      ft.blind = freshBlind();
    },
    /* A hand is dropped (startDrop, after the hand is scored). */
    _featHand() {
      const s = this.state,
        ft = this._ft(),
        b = ft.blind,
        boss = this._bossDef()?.id;
      ft.drop = freshDrop();
      b.hands++;
      if (!b.suits.includes(s.primarySuit)) b.suits.push(s.primarySuit);
      b.offClub = b.offClub || s.primarySuit !== "club";
      if (s.balls >= B.BALL_PIT) this._feat("lou", "ballpit");
      if (s.hand === "Royal Flush") this._feat("lou", "royal");
      this._featSets();
      if (boss === "sonny" && s.lastEvaluation?.flush) this._feat("sonny", "flush");
      if (boss === "mirror" && s.hand === "Two Pair") this._feat("mirror", "twopair");
      if (boss === "mirror" && s.hand === "Four of a Kind") this._feat("mirror", "fourkind");
      if (boss === "house" && s.hand === "Full House") this._feat("house", "fullhouse");
    },
    _featSets() {
      const top = Math.max(0, ...this._effects().sets.map(x => x.step));
      if (top >= 2) this._feat("lou", "vip");
      if (top >= 3) this._feat("lou", "whale");
    },
    /* A ball leaves the launcher (_dropNext). */
    _featBall(options) {
      const s = this.state,
        b = this._ft().blind,
        ph = this.physics,
        mid = Math.floor((ph.bucketValues?.length || 7) / 2);
      b.balls++;
      if (options.suits.includes("heart")) b.hearts++;
      if (ph.pocketAt && ph.pocketAt(24 + s.aim * (ph.width - 48), false) !== mid) b.offCentre = true;
    },
    /* A ball lands (onBucket, after it is scored). crossed: this ball took the score over the target. */
    _featBucket(result, crossed) {
      const s = this.state,
        ft = this._ft(),
        d = ft.drop;
      if (!d.pockets.includes(result.index)) d.pockets.push(result.index);
      if (result.multiplier <= 0.5 || result.drained) ft.blind.half = true;
      if (!result.drained && (this.physics.jackpots?.() || [3]).includes(result.index)) d.jackpots++;
      ft.blind.landed++;
      if (crossed) {
        ft.blind.firstBall = ft.blind.landed === 1;
        ft.blind.lastBall = s.handsLeft === 1 && s.ballsLeft <= 0 && s.activeBalls <= 0;
      }
    },
    /* A drop has settled (finishRound, before the blind is judged). */
    _featDrop() {
      const s = this.state,
        d = this._ft().drop,
        last = (this.physics.bucketValues?.length || 7) - 1,
        boss = this._bossDef()?.id;
      // also a run statistic: the most balls in a jackpot in one drop opens the Jackpot Deck
      if (s.stats) s.stats.jackpotDrop = Math.max(s.stats.jackpotDrop || 0, d.jackpots);
      if (d.pockets.length > last) this._feat("lou", "sweep");
      if (s.total >= B.SIX_FIGURES) this._feat("lou", "six");
      if (boss === "undertow") {
        if (d.pockets.includes(0) && d.pockets.includes(last)) this._feat("undertow", "shores");
        if (d.jackpots >= B.HAT_TRICK) this._feat("undertow", "hat");
      }
    },
    /* A blind is decided. rushed: it was a rush (so a loss is Lou's cut, not the end of the run). */
    _featBlind(won, rushed) {
      const s = this.state,
        ft = this._ft(),
        b = ft.blind,
        boss = this._bossDef()?.id,
        first = s.handsLeft === (s.handsMax || D.BALANCE.HANDS_PER_BLIND);
      if (won) {
        if (b.hands === 3 && b.suits.length === 3) this._feat("lou", "rainbow");
        if (b.firstBall) this._feat("lou", "oneball");
        if (s.node === "elite" && ++ft.elites >= B.ELITES) this._feat("lou", "elite");
        if (rushed) {
          this._feat(boss, `rush${s.ng}`);
          if (s.rush.won.length >= 2) this._feat("lou", "rushhour");
          if (s.rush.won.length >= D.BOSSES.length) this._feat("lou", "four");
        }
      }
      if (!boss) return;
      const f = key => this._feat(boss, key);
      if (!won) {
        f("lose");
        if (s.score >= s.target * B.NEAR_LOSS) f("near");
        return;
      }
      f("beat");
      f(`deck-${s.deckId || "house"}`);
      if (s.handsLeft > 1) f("spare");
      if (first) f("one");
      if (s.score <= s.target * B.NEAR_WIN) f("hair");
      if (s.score >= s.target * B.DOUBLE) f("double");
      if (b.lastBall) f("last");
      const ids = s.chips.map(c => c.id),
        most = Math.max(0, ...ids.map(id => ids.filter(x => x === id).length)),
        fx = this._effects(),
        whales = fx.sets.filter(x => x.step >= 3).length;
      if (boss === "sonny") {
        if ((s.deckId || "house") !== "house") f("other");
        f(b.hearts ? "heart" : "dry");
        if (!ids.length) f("bare");
      } else if (boss === "undertow") {
        if (b.tilt) f("tilt");
        if (!b.offClub) f("clubs");
        if (!b.offCentre) f("centre");
        if (!b.half) f("dry");
      } else if (boss === "mirror") {
        if (ids.length && most === 1) f("unique");
        if (most >= B.COPIES) f("copy");
        if (ids.length <= B.LIGHT_CHIPS) f("light");
      } else if (boss === "house") {
        const breaks = this._shieldBreaks(fx);
        if (breaks >= D.BOSS_TUNE.SHIELDS[this._bossTier()].length - 1) f("bank");
        if (!breaks) f("noshield");
        if (whales >= 1) f("whale");
        if (whales >= 2) f("whales");
        if (s.coins >= B.CASH) f("cash");
      }
    },
    /* The run is over, won or lost. */
    _featRun() {
      const s = this.state,
        ft = this._ft();
      this._feat("lou", "table");
      if (!s.victory) return;
      this._feat("lou", "luck");
      if (s.ng >= D.NG.MAX) this._feat("lou", "top");
      if (!ft.rerolls) this._feat("lou", "penny");
    },
    /* Lou took his cut after a lost rush. */
    _featCut(coins, chips) {
      this._tally("rushLost");
      if (!coins && !chips) this._feat("lou", "nothing");
    },
    _featBought() {
      this._ft().bought++;
    },
    _featShop() {
      this._ft().shopped = true;
    },
    _featReroll() {
      const ft = this._ft();
      ft.rerolls++;
      if (this.state.shopRerolls >= B.REROLLS) this._feat("lou", "spender");
    },
    /* An event or Lounge choice was made. */
    _featEvent(id, option, won) {
      const ft = this._ft();
      if (id === "lounge" && ++ft.lounges >= B.LOUNGES) this._feat("lou", "lounge");
      if (id === "wallet" && option === 1) this._feat("lou", "karma");
      if (id === "wager" && won) this._tally("wager");
    }
  };
})();
