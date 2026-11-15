/* Slotchinko run meta: the path between blinds (blind, elite, event, lounge), events, boss blinds,
   deck rules, and the end-of-run unlock check. Mixed into SlotchinkoGame. */
(() => {
  "use strict";
  const D = window.SlotchinkoData;
  const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];

  window.SlotchinkoPath = {
    /* Path choices for the next blind: always a plain blind, plus two different detours. */
    _rollPath() {
      const s = this.state,
        rnd = this.rng.stream("path"),
        next = s.round + 1;
      const pool = ["elite", "event", "event", "rest"],
        extra = [],
        // The Peg Mechanic tunes the pegs once a run: paid, he does not come back.
        tuned = (s.runBuffs || []).some(b => b.id === "tuned-pegs"),
        // ...and an event that is still a locked prize (The Back Room) is not offered.
        events = D.EVENTS.filter(e => (e.id !== "mechanic" || !tuned) && !(s.locked || []).includes(e.id));
      while (extra.length < 2) {
        const t = pick(pool, rnd);
        if (!extra.includes(t)) extra.push(t);
      }
      const choices = ["blind", ...extra].map(type => ({
        type,
        event: type === "event" ? pick(events, rnd).id : type === "rest" ? "lounge" : null
      }));
      s.path = { round: s.round, choices, boss: this._bossFor(next)?.id || null, picked: null };
    },
    /* Ascension 1 and up: a run opens on the path, where Sonny can be rushed before blind 1 (the boss box is the way in). */
    _startPath() {
      const s = this.state;
      s.path = { round: 0, start: true, choices: [{ type: "blind" }], boss: null, picked: null };
      if (!this.rushOffer()) s.path = null;
    },
    /* Rush the Boss: on the path before the first of a boss's three blinds, skip straight to the boss. Ascension 1 and up, one try
       per boss per run. Returns what is on offer here, or null: the boss, what Lou takes on a loss, the wages on a win. */
    rushOffer() {
      const s = this.state,
        R = D.BALANCE.RUSH,
        from = s.path?.start ? 0 : s.round,
        fresh = s.phase === "slot" && s.round === 1 && s.handsLeft === s.handsMax && !s.score,
        atPath = s.path?.start ? fresh : s.phase === "roundEnd" && s.won;
      if (!s.ng || s.victory || !atPath || from % 4 !== 0) return null;
      const boss = D.BOSSES.find(b => b.round === from + 4);
      if (!boss || (s.rush?.tried || []).includes(boss.id)) return null;
      return { boss, from, cut: this._rushCut(boss), wages: R.WAGES, climb: R.CLIMB[boss.id] || 1 };
    },
    /* Lou's cut for losing a rush grows with the boss and the Ascension level: severity 2 (Sonny, level 1) to 12. */
    _rushCut(boss) {
      const severity = D.BOSSES.indexOf(boss) + 1 + this.state.ng,
        cuts = D.BALANCE.RUSH.CUTS;
      return cuts.find(c => severity <= c.upTo) || cuts[cuts.length - 1];
    },
    rush() {
      const s = this.state,
        offer = this.rushOffer();
      if (!offer) return;
      s.rush = { tried: [], won: [], ...s.rush, active: { boss: offer.boss.id, from: offer.from }, result: null };
      s.rush.tried = [...s.rush.tried, offer.boss.id];
      s.path = null;
      s.event = null;
      s.round = offer.boss.round - 1;
      s.phase = "roundEnd";
      s.won = true;
      this.nextRound("blind", { climb: offer.climb });
    },
    /* A rushed boss beaten: Lou pays the wages of the blinds skipped. The reward is the view's to record. */
    _rushWon() {
      const s = this.state,
        boss = s.rush.active.boss,
        wages = D.BALANCE.RUSH.WAGES;
      s.rush.won = [...s.rush.won, boss];
      s.rush.active = null;
      s.coins += wages;
      s.stats.coinsEarned += wages;
      s.stats.rushWon = (s.stats.rushWon || 0) + 1;
      // The reward joins this run's shop at once, if its item exists yet.
      const reward = D.rewardId(D.BOSSES.find(b => b.id === boss).rewards[s.ng - 1]);
      s.locked = (s.locked || []).filter(id => id !== reward);
      s.rush.result = { won: true, boss, wages };
      this.view?.rushWon?.(boss, s.ng);
    },
    /* A rushed boss lost: the run goes on. Lou takes his cut, then deals the first of the blinds that were skipped. */
    _rushLost() {
      const s = this.state,
        { boss, from } = s.rush.active,
        cut = this._rushCut(D.BOSSES.find(b => b.id === boss)),
        coins = Math.ceil(s.coins * cut.coins),
        own = s.chips.filter(c => !String(c.instanceId).startsWith("deck-"));
      let lost = cut.chips ? own.slice(-cut.chips) : [];
      if (cut.chips === "family") {
        const top = [...window.SlotchinkoSets.familySets(s.chips)].sort((a, b) => b.count - a.count)[0];
        lost = own.filter(c => c.family !== top?.family.id);
      }
      s.coins -= coins;
      s.chips = s.chips.filter(c => !lost.includes(c));
      s.rush.active = null;
      s.stats.rushLost = (s.stats.rushLost || 0) + 1;
      s.rush.result = { won: false, boss, coins, chips: lost.map(c => c.name), next: from + 1 };
      this._featCut(coins, lost.length);
      s.round = from;
      s.phase = "roundEnd";
      s.won = true;
      this.nextRound("blind");
      this.view?.rushLost?.(boss, s.ng);
    },
    /* The Remix: steps the next blind's board to the next layout. Chosen on the path, used by nextRound. */
    remixOffer() {
      const s = this.state,
        next = s.round + 1;
      if (!s.path || s.path.start || s.phase !== "roundEnd" || !s.won || s.victory) return null;
      if (!this._effects().remix || this._bossFor(next)) return null;
      return s.path.remix || this._layoutFor(next);
    },
    remix() {
      const now = this.remixOffer(),
        ids = this._layouts();
      if (!now) return;
      this.state.path.remix = ids[(ids.indexOf(now) + 1) % ids.length];
      this.render();
    },
    /* Picks a path node. Blind and Elite go straight to the next blind; Event and Lounge show their card first. */
    choosePath(index) {
      const s = this.state;
      if (s.path?.start) {
        if (s.phase !== "slot" || !s.path.choices[index]) return;
        s.path = null;
        this.render();
        return;
      }
      if (s.phase !== "roundEnd" || !s.won || s.victory || !s.path || s.path.picked) return;
      const node = s.path.choices[index];
      if (!node) return;
      if (node.event) {
        s.path.picked = index;
        s.event = node.event;
        this.render();
        return;
      }
      this.nextRound(node.type);
    },
    eventDef(id = this.state.event) {
      return id === "lounge" ? D.LOUNGE : D.EVENTS.find(e => e.id === id);
    },
    eventOptionOk(i) {
      const s = this.state,
        o = this.eventDef()?.options[i];
      if (!o) return false;
      if (o.needTrade && this._backRoom().out.length < 2) return false;
      return s.coins >= (o.need || 0) && (!o.needChip || s.chips.some(c => !String(c.instanceId).startsWith("deck-")));
    },
    /* The Back Room: your biggest family, and your own Chips from outside it, newest last. */
    _backRoom() {
      const s = this.state,
        top = [...window.SlotchinkoSets.familySets(s.chips)].sort((a, b) => b.count - a.count)[0]?.family.id,
        own = s.chips.filter(c => !String(c.instanceId).startsWith("deck-"));
      return { top, out: top ? own.filter(c => c.family !== top) : [] };
    },
    resolveEvent(i) {
      const s = this.state,
        id = s.event;
      if (!id || !this.eventOptionOk(i)) return;
      const ev = this.rng.stream("event"),
        note = t => {
          s.eventResult = t;
          this.toast(t);
        };
      const boost = (action, value) => s.pendingBoosts.push({ action, value, id: "event-" + id });
      let climb = 1,
        blindPay = 1;
      if (id !== "lounge" && s.stats) s.stats.events = (s.stats.events || 0) + 1;
      if (id !== "wager") this._featEvent(id, i, false);
      if (id === "lounge") {
        if (i === 0) {
          boost("balls", 3);
          note("+3 BALLS NEXT HAND");
        } else {
          boost("power", 0.5);
          note("+50% POWER NEXT HAND");
        }
      } else if (id === "wager" && i === 0) {
        s.coins -= 5;
        if (ev() < 0.5) {
          s.coins += 12;
          s.stats.coinsEarned += 7;
          this._featEvent(id, i, true);
          note("YOU CALLED IT · +12¢");
        } else note("THE HOUSE WINS · -5¢");
      } else if (id === "loaded-dice" && i === 0) {
        const own = s.chips.filter(c => !String(c.instanceId).startsWith("deck-")),
          lost = pick(own, ev);
        s.chips = s.chips.filter(c => c !== lost);
        const got = this._freeChip("rare", ev);
        note(got ? `${lost.name.toUpperCase()} → ${got.name.toUpperCase()}` : `${lost.name.toUpperCase()} LOST`);
      } else if (id === "wallet") {
        if (i === 0) {
          s.coins += 7;
          s.stats.coinsEarned += 7;
          climb = 1.2;
          note("+7¢ · TARGET UP");
        } else {
          boost("balls", 3);
          note("+3 BALLS NEXT HAND");
        }
      } else if (id === "mechanic" && i === 0) {
        s.coins -= 4;
        s.runBuffs.push({
          id: "tuned-pegs",
          name: "Tuned Pegs",
          icon: "⚙",
          rarity: "uncommon",
          kind: "buff",
          duration: "run",
          desc: "Balls bounce 8% harder all run.",
          effect: { bounce: 0.08 },
          instanceId: "event-tuned-" + s.round
        });
        note("PEGS TUNED · WHOLE RUN");
      } else if (id === "sleeve") {
        if (i === 0) {
          s.deckMods.aces = (s.deckMods.aces || 0) + 1;
          note("ACE ADDED TO YOUR DECK");
        } else {
          s.coins += 3;
          s.stats.coinsEarned += 3;
          note("+3¢");
        }
      } else if (id === "back-room" && i === 0) {
        const { top, out } = this._backRoom(),
          gone = out.slice(-2);
        s.chips = s.chips.filter(c => !gone.includes(c));
        const pool = D.CHIP_CATALOG.filter(
            c => c.family === top && !(s.locked || []).includes(c.id) && this._canOwn(c)
          ),
          got = pool.length ? pick(pool, ev) : null;
        if (got) {
          s.itemSerial = (s.itemSerial || 0) + 1;
          s.chips.push({ ...got, instanceId: `gift-${got.id}-${s.itemSerial}` });
        }
        note(got ? `TRADED FOR ${got.name.toUpperCase()}` : "LOU HAD NOTHING FOR YOU");
      } else if (id === "blood-moon" && i === 0) {
        climb = 1.25;
        blindPay = 2;
        note("BLOOD MOON · DOUBLE PAY");
      } else note("YOU MOVE ON");
      s.event = null;
      this.nextRound("event", { climb, blindPay });
    },
    /* A random unlocked Chip of a rarity the player can still own, added for free. */
    _freeChip(rarity, rnd) {
      const s = this.state;
      if (s.chips.length >= D.BALANCE.MAX_CHIPS) return null;
      const pool = D.CHIP_CATALOG.filter(
        c => c.rarity === rarity && !(s.locked || []).includes(c.id) && this._canOwn(c)
      );
      if (!pool.length) return null;
      const c = pick(pool, rnd);
      s.itemSerial = (s.itemSerial || 0) + 1;
      s.chips.push({ ...c, instanceId: `gift-${c.id}-${s.itemSerial}` });
      return c;
    },
    /* Bag size: Hoarder +2, Short Bag -1. */
    _bagMax() {
      return D.BALANCE.MAX_BAG + (this.state.deckId === "hoarder" ? 2 : 0) - (this._ngHas("short-bag") ? 1 : 0);
    },
    /* Glass Deck: each bought Chip has a 1 in 8 chance to shatter after a cleared blind. */
    _shatter() {
      const s = this.state;
      if (s.deckId !== "glass") return;
      const rnd = this.rng.stream("glass"),
        broken = [];
      s.chips = s.chips.filter(c => {
        const b = rnd() < 1 / 8;
        if (b) broken.push(c.name.toUpperCase());
        return !b;
      });
      if (broken.length) {
        s.shattered = broken;
        this.toast(`SHATTERED · ${broken.join(", ")}`);
      }
    },
    /* Milestones met by this run that are still locked. */
    newUnlocks(found = []) {
      const m = this.summary();
      return D.UNLOCKS.filter(u => !found.includes(u.id) && u.test(m)).map(u => u.id);
    }
  };
})();
