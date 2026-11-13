/* Slotchinko boss rules and trophies. Mixed into SlotchinkoGame. Logic only.
   There is one drop per blind, so "next ball" and swaps count balls within that drop. */
(() => {
  "use strict";
  const D = window.SlotchinkoData,
    T = D.BOSS_TUNE;
  const freshDrop = () => ({ bucketHit: false, repeated: false, heartDebt: false, beat: 0 });

  window.SlotchinkoBossRules = {
    _bossFor(round) {
      return D.BOSSES.find(b => b.round === round) || null;
    },
    _bossDef() {
      return this._bossFor(this.state.round)?.id === this.state.boss ? this._bossFor(this.state.round) : null;
    },
    /* 0 below Ascension 4, 1 at 4-6, 2 from 7. */
    _bossTier() {
      const n = this.state.ng || 0;
      return n >= 7 ? 2 : n >= 4 ? 1 : 0;
    },
    _bossClimb(boss) {
      return boss?.id === "house" && this._bossTier() === 2 ? T.FINAL_CLIMB : 1;
    },
    /* The pockets this blind plays on. physics is shared between runs, so this also puts them back. */
    _bossBoard() {
      this.physics.bucketValues = [...(this.state.boss === "undertow" ? T.TIDE_POCKETS : T.NORMAL_POCKETS)];
    },
    _bossDropStart() {
      this.state.dropFx = freshDrop();
    },
    /* A4+ Sonny: the first card dealt is a Heart, swapped in from the deck so no card is duplicated. */
    _bossDeal() {
      const s = this.state;
      if (s.boss !== "sonny" || !this._bossTier() || s.cards[0]?.suit === "heart") return;
      const i = s.deck.findIndex(c => c.suit === "heart");
      if (i < 0) return;
      [s.cards[0], s.deck[i]] = [s.deck[i], s.cards[0]];
    },
    /* In Sonny's fight balls go through the hand card by card, so Hearts in hand cost those balls only. */
    _ballSuit() {
      const s = this.state;
      if (s.boss !== "sonny") return s.primarySuit;
      return s.cards[(s.balls - s.ballsLeft - 1) % s.cards.length]?.suit || s.primarySuit;
    },
    /* Chips that count. The Mirror Dealer drops the extra copies of your most-owned Chips. */
    _chipsInPlay() {
      const s = this.state;
      if (s.boss !== "mirror") return s.chips;
      const n = new Map();
      s.chips.forEach(c => n.set(c.id, (n.get(c.id) || 0) + 1));
      const top = this._mirroredIds(n),
        seen = new Set();
      return s.chips.filter(c => {
        if (!top.includes(c.id)) return true;
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
    },
    _mirroredIds(n) {
      return [...n]
        .filter(x => x[1] > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, this._bossTier() + 1)
        .map(x => x[0]);
    },
    _trophyItems() {
      const own = this.state.trophies || [];
      return D.BOSSES.map(b => b.trophy).filter(t => own.includes(t.id));
    },
    _shieldMult(fx = this._effects()) {
      const m = T.SHIELDS[this._bossTier()];
      return m[Math.min(fx.synergies.length, m.length - 1)];
    },

    /* Scores a landed ball: trophy pocket bonuses, then ballScore, then the Mirror Shard repeat, then the boss. */
    _bossBall(result, fx) {
      const s = this.state,
        d = s.dropFx || (s.dropFx = freshDrop());
      let multiplier = result.multiplier;
      if (!result.drained) {
        if (fx.firstBucket && !d.bucketHit) multiplier += fx.firstBucket;
        d.bucketHit = true;
        multiplier += (fx.keyPerSet || 0) * fx.synergies.length;
      }
      const ball = { ...result, multiplier };
      let pts = this.ballScore(ball, fx);
      if (fx.firstChipRepeat && !d.repeated) {
        const plain = Math.round(D.BALANCE.BASE_BALL_SCORE * s.power * multiplier * (result.ball?.plugin?.glass || 1));
        if (pts > plain) {
          pts += Math.round((pts - plain) * fx.firstChipRepeat);
          d.repeated = true;
        }
      }
      if (s.boss === "sonny") pts = this._heartbreak(pts, result, d);
      else if (s.boss === "house") pts *= this._shieldMult(fx);
      else if (s.boss === "undertow") this._beat(d);
      return Math.round(pts);
    },
    _heartbreak(pts, result, d) {
      const suits = result.ball?.plugin?.suits || [this.state.primarySuit],
        heart = suits.length === 1 && suits[0] === "heart",
        cut = d.heartDebt ? T.HEART_NEXT_CUT : 1;
      d.heartDebt = heart && this._bossTier() === 2;
      if (!heart) return pts * T.HEART_SUIT_BONUS * cut;
      if (!result.drained) result.note = "HEARTBROKEN";
      return 0;
    },
    /* Undertow: mirrors the pockets on the beat; from A4 the centre trades with a random neighbour too. */
    _beat(d) {
      const tier = this._bossTier(),
        every = tier === 2 ? 1 : T.BEAT_BALLS;
      if (++d.beat % every) return;
      const v = this.physics.bucketValues;
      v.reverse();
      if (tier) {
        const n = this.rng.random("boss") < 0.5 ? 2 : 4;
        [v[3], v[n]] = [v[n], v[3]];
      }
      if (every > 1) this.toast("THE BEAT SWITCHES");
    },
    /* A cleared drop beats the boss. Blind Skip never gets here, so a skipped boss leaves no trophy. */
    _bossBeaten() {
      const s = this.state,
        b = this._bossDef();
      if (!b) return;
      s.trophies = s.trophies || [];
      if (s.trophies.includes(b.trophy.id)) return;
      s.trophies.push(b.trophy.id);
      this.payout({
        id: b.trophy.id,
        icon: "★",
        name: `TROPHY · ${b.trophy.name.toUpperCase()}`,
        amount: 1,
        unit: "",
        kind: "points",
        fromBlind: true
      });
    },
    /* Older saves: trophies did not exist and blinds could hold a removed boss. */
    _bossRestore() {
      const s = this.state,
        b = this._bossFor(s.round);
      s.trophies = s.trophies || [];
      delete s.bosses;
      if (s.boss !== (b?.id || null)) {
        s.boss = b?.id || null;
        s.maxSpins = s.baseSpins || 2;
      }
      this._bossBoard();
    },
    /* The boss panel's words, or null when no boss is on this blind. */
    bossStatus() {
      const s = this.state,
        b = this._bossDef();
      if (!b) return null;
      const tier = this._bossTier();
      let live = b.hint;
      if (b.id === "house") {
        const fx = this._effects(),
          all = T.SHIELDS[tier].length - 1;
        live = `SHIELDS BROKEN ${Math.min(fx.synergies.length, all)}/${all} · SCORE ×${this._shieldMult(fx)}`;
      } else if (b.id === "mirror") {
        const n = new Map();
        s.chips.forEach(c => n.set(c.id, (n.get(c.id) || 0) + 1));
        const names = this._mirroredIds(n).map(id => s.chips.find(c => c.id === id).name.toUpperCase());
        live = names.length ? `MIRRORED: ${names.join(" · ")}` : "NO COPIES TO MIRROR";
      }
      return {
        boss: b,
        title: `${b.name.toUpperCase()} · ${b.ruleName}`,
        rule: b.rules[tier],
        live,
        beaten: (s.trophies || []).includes(b.trophy.id) && s.phase === "roundEnd"
      };
    }
  };
})();
