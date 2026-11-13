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
        extra = [];
      while (extra.length < 2) {
        const t = pick(pool, rnd);
        if (!extra.includes(t)) extra.push(t);
      }
      const choices = ["blind", ...extra].map(type => ({
        type,
        event: type === "event" ? pick(D.EVENTS, rnd).id : type === "rest" ? "lounge" : null
      }));
      s.path = { round: s.round, choices, boss: this._bossFor(next)?.id || null, picked: null };
    },
    /* Picks a path node. Blind and Elite go straight to the next blind; Event and Lounge show their card first. */
    choosePath(index) {
      const s = this.state;
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
      return s.coins >= (o.need || 0) && (!o.needChip || s.chips.some(c => !String(c.instanceId).startsWith("deck-")));
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
