/* Slotchinko shop: stock generation, purchase, reroll and consumables. */
(() => {
  "use strict";
  const { CHIP_CATALOG, CARD_CATALOG, BUFF_CATALOG, CONSUMABLE_CATALOG, RARITY_WEIGHT, BALANCE, NG } =
    window.SlotchinkoData;
  let serial = 0;

  /* Picks by rarity weight; extra(item) scales an item's weight (the shop's lean toward owned families). */
  function weightedPick(items, random, extra = () => 1) {
    const weight = item => (RARITY_WEIGHT[item.rarity] || 0) * extra(item),
      total = items.reduce((sum, item) => sum + weight(item), 0);
    let roll = random() * total;
    for (const item of items) {
      roll -= weight(item);
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }

  // Instance ids come from a counter kept in the run state, so a restored run never reuses one.
  function cloneItem(def, s, surcharge = 0) {
    s.itemSerial = Math.max(s.itemSerial || 0, serial) + 1;
    serial = s.itemSerial;
    return { ...def, cost: Math.max(1, def.cost + surcharge), instanceId: `${def.id}-${s.itemSerial}` };
  }

  window.SlotchinkoShopLogic = {
    /* Stock per section (BALANCE.SHOP_SLOTS), each picked by rarity weight without repeats.
       lean: false for a reroll, which is fully random so a player can change direction. */
    generateShop(lean = true) {
      const s = this.state,
        fx = this._effects(),
        slots = { ...BALANCE.SHOP_SLOTS },
        rnd = this.rng.stream("shop"),
        open = d => !(s.locked || []).includes(d.id);
      if (s.deckId === "hoarder") slots.chip--;
      slots.chip += fx.shopChips;
      // Looking Glass: this shop's Chips are ones already owned (that still have room for a copy).
      const mine = d => !s.lookingGlass || s.chips.some(c => c.id === d.id);
      const pools = {
        chip: CHIP_CATALOG.filter(d => open(d) && this._canOwn(d) && mine(d)),
        card: CARD_CATALOG.filter(d => open(d) && this._canOwn(d)),
        consumable: CONSUMABLE_CATALOG.filter(d => open(d) && !s.consumables.some(c => c.id === d.id && d.unique)),
        buff: BUFF_CATALOG.filter(d => open(d) && this._canOwn(d))
      };
      // The shop leans toward what you own: each Chip of a family you hold makes that family likelier (up to a cap).
      const owned = id => Math.min(BALANCE.SHOP_LEAN_CAP, s.chips.filter(c => c.family === id).length),
        // Loyalty Card: the biggest family's Chips weigh LOYALTY times as much.
        top = [...fx.sets].sort((a, b) => b.count - a.count)[0]?.family.id,
        loyal = d => (fx.loyalty && d.family === top ? BALANCE.LOYALTY : 1),
        leaning = d => (1 + BALANCE.SHOP_LEAN * owned(d.family)) * loyal(d),
        discount = fx.discount;
      const inventory = [];
      for (const kind of ["chip", "card", "consumable", "buff"]) {
        const pool = [...pools[kind]];
        for (let i = 0; i < slots[kind] && pool.length; i++) {
          const pick = weightedPick(pool, rnd, kind === "chip" && lean ? leaning : () => 1),
            tight = this._ngHas("tight-shop") && pick.cost >= NG.TIGHT_MIN_COST ? 1 : 0;
          inventory.push(cloneItem(pick, s, tight - discount));
          pool.splice(
            pool.findIndex(item => item.id === pick.id),
            1
          );
        }
      }
      s.shopInventory = inventory;
      s.shopRerolls = 0;
      s.shopOpen = true;
      if (!s.path || s.path.round !== s.round) this._rollPath();
    },

    /* Whether one more of this item can be owned: chip stacks, deck cards, run buffs. */
    _canOwn(def) {
      const s = this.state,
        m = s.deckMods || {};
      if (def.kind === "chip") {
        const n = this._ownedCount(def.id);
        // Double Stack: a common Chip that stacks has room for one more copy.
        const extra = def.rarity === "common" && (s.runBuffs || []).some(b => b.effect?.extraStack) ? 1 : 0;
        return n === 0 || (def.stackable && n < (def.maxStack || 1) + extra);
      }
      if (def.kind === "card") {
        if (def.deck === "addAce") return (m.aces || 0) < def.maxStack;
        return def.maxStack > 1 ? (m[def.deck] || 0) < def.maxStack : !m[def.deck];
      }
      if (def.kind === "buff") return def.duration !== "run" || !(s.runBuffs || []).some(b => b.id === def.id);
      return true;
    },

    purchase(instanceId) {
      const s = this.state;
      if (s.phase !== "roundEnd" || !s.won || s.victory) return;
      const item = s.shopInventory.find(x => x.instanceId === instanceId);
      if (!item || s.coins < item.cost) return;
      if (item.kind !== "consumable" && !this._canOwn(item)) return;
      if (item.kind === "chip") {
        if (s.chips.length >= BALANCE.MAX_CHIPS) {
          this.toast(`CHIP SLOTS FULL · ${BALANCE.MAX_CHIPS} MAX`);
          return;
        }
        s.chips.push({ ...item, instanceId: `owned-${item.instanceId}` });
      } else if (item.kind === "card") {
        const m = s.deckMods;
        if (item.deck === "addAce") m.aces = (m.aces || 0) + 1;
        else if (item.maxStack > 1) m[item.deck] = (m[item.deck] || 0) + 1;
        else m[item.deck] = true;
        if (item.deck === "joker") this.toast("JOKER ADDED TO YOUR DECK");
      } else if (item.kind === "buff") {
        if (item.duration === "run") s.runBuffs.push({ ...item, instanceId: `run-${item.instanceId}` });
        else s.pendingBoosts.push({ action: item.action, value: item.value, id: item.id });
      } else {
        if (s.consumables.length >= this._bagMax()) {
          this.toast(`BAG FULL · ${this._bagMax()} MAX`);
          return;
        }
        s.consumables.push({ ...item, instanceId: `bag-${item.instanceId}` });
        if (s.stats) s.stats.maxBag = Math.max(s.stats.maxBag || 0, s.consumables.length);
      }
      s.coins -= item.cost;
      s.shopInventory = s.shopInventory.filter(x => x.instanceId !== instanceId);
      this._featBought();
      const note =
        item.kind === "buff"
          ? item.duration === "run"
            ? " · WHOLE RUN"
            : " · NEXT DROP"
          : item.kind === "card"
            ? " · DECK UPDATED"
            : " ACQUIRED";
      this.toast(`${item.name.toUpperCase()}${note}`);
      this.render();
    },

    /* Marked Card, armed: the picked card takes the suit of the card on its left, and the item is spent. */
    markCard(index) {
      const s = this.state,
        at = s.consumables.findIndex(c => c.instanceId === s.marking);
      if (s.phase !== "slot" || at < 0) {
        s.marking = null;
        return;
      }
      if (index === 0) {
        this.toast("THE FIRST CARD HAS NO CARD ON ITS LEFT");
        return;
      }
      s.cards[index].suit = s.cards[index - 1].suit;
      s.consumables.splice(at, 1);
      s.marking = null;
      this.toast("CARD MARKED");
      this.evaluateHand();
      this.render();
    },

    /* Selling: half what the Chip cost, at least 1¢. A deck's starting Chip is part of the deck and cannot be sold. */
    sellValue(chip) {
      if (!chip || String(chip.instanceId).startsWith("deck-")) return 0;
      // Pawn Ticket: every other Chip sells for what it cost. The ticket itself sells for half like anything else.
      const full = chip.id !== "pawn-ticket" && this.state.chips.some(c => c.id === "pawn-ticket");
      return Math.max(1, Math.floor((chip.cost || 0) * (full ? 1 : BALANCE.SELL_RATE)));
    },
    canSell() {
      const s = this.state;
      return s.phase === "slot" || (s.phase === "roundEnd" && s.won && !s.victory);
    },
    /* Sells one copy of a Chip (the newest), while preparing a hand or in the shop. Never mid-drop. */
    sellChip(id) {
      const s = this.state;
      if (!this.canSell()) return;
      let index = -1;
      s.chips.forEach((c, i) => {
        if (c.id === id && this.sellValue(c) > 0) index = i;
      });
      if (index < 0) return;
      const [chip] = s.chips.splice(index, 1),
        value = this.sellValue(chip);
      s.coins += value;
      if (s.stats) s.stats.sold = (s.stats.sold || 0) + 1;
      if (s.phase === "slot") this.evaluateHand();
      this.toast(`${chip.name.toUpperCase()} SOLD · +${value}¢`);
      this.render();
    },
    _rerollCost() {
      return BALANCE.REROLL_BASE + this.state.shopRerolls + (this._ngHas("pricey-rerolls") ? NG.REROLL_ADD : 0);
    },
    rerollShop() {
      const s = this.state;
      if (s.phase !== "roundEnd" || !s.won || s.victory) return;
      const cost = this._rerollCost();
      if (s.coins < cost) {
        this.toast("NOT ENOUGH COINS TO REROLL");
        return;
      }
      s.coins -= cost;
      const nextRerollCount = s.shopRerolls + 1;
      this.generateShop(false);
      s.shopRerolls = nextRerollCount;
      this._featReroll();
      this.toast(`SHOP REROLLED · -${cost}¢`);
      this.render();
    },

    /* Usable while preparing a hand and in the shop. Blind Skip only works on a live blind. */
    useConsumable(instanceId) {
      const s = this.state,
        inShop = s.phase === "roundEnd" && s.won && !s.victory;
      if (s.phase !== "slot" && !inShop) return;
      const index = s.consumables.findIndex(c => c.instanceId === instanceId);
      if (index < 0) return;
      const item = s.consumables[index];
      if (item.action === "redeal" && s.phase !== "slot") {
        this.toast("USE REDEAL WHILE PREPARING A HAND");
        return;
      }
      // Marked Card needs a card picked: pressing it arms it (or puts it away); it is spent when a card is marked.
      if (item.action === "mark") {
        if (s.phase !== "slot") {
          this.toast("USE MARKED CARD WHILE PREPARING A HAND");
          return;
        }
        s.marking = s.marking === instanceId ? null : instanceId;
        this.toast(s.marking ? "PICK A CARD TO MARK" : "MARKED CARD PUT AWAY");
        this.render();
        return;
      }
      // On the House: a free Chip from the biggest family. It cost nothing, so it sells for nothing. Kept if none fits.
      if (item.action === "onhouse") {
        const top = [...this._effects().sets].sort((a, b) => b.count - a.count)[0]?.family.id,
          pool = CHIP_CATALOG.filter(d => d.family === top && !(s.locked || []).includes(d.id) && this._canOwn(d));
        if (!pool.length || s.chips.length >= BALANCE.MAX_CHIPS) {
          this.toast(
            !top ? "OWN A CHIP FIRST" : pool.length ? "NO ROOM FOR ANOTHER CHIP" : "NOTHING LEFT TO GIVE IN THAT FAMILY"
          );
          return;
        }
        const gift = {
          ...cloneItem(
            weightedPick(pool, this.rng.stream("shop"), () => 1),
            s
          ),
          cost: 0
        };
        s.consumables.splice(index, 1);
        s.chips.push(gift);
        this.toast(`ON THE HOUSE · ${gift.name.toUpperCase()}`);
        this.evaluateHand();
        this.render();
        return;
      }
      // Marker: coins now, and a debt Lou collects from each blind's winnings (_payMarker).
      if (item.action === "marker") {
        s.consumables.splice(index, 1);
        s.coins += item.value;
        s.marker = (s.marker || 0) + BALANCE.MARKER_OWED;
        this.toast(`MARKER · +${item.value}¢ · YOU OWE ${s.marker}¢`);
        this.render();
        return;
      }
      // Carbon Copy: the newest common Chip with room for another copy. Kept if there is none.
      if (item.action === "copy") {
        const from = [...s.chips].reverse().find(c => c.rarity === "common" && this._canOwn(c));
        if (!from || s.chips.length >= BALANCE.MAX_CHIPS) {
          this.toast(from ? "NO ROOM FOR ANOTHER CHIP" : "NO COMMON CHIP HAS ROOM FOR A COPY");
          return;
        }
        s.consumables.splice(index, 1);
        s.chips.push(cloneItem(from, s));
        this.toast(`CARBON COPY · ${from.name.toUpperCase()}`);
        this.evaluateHand();
        this.render();
        return;
      }
      // Looking Glass: only in the shop, and only if some owned Chip has room for a copy.
      if (item.action === "glassshop") {
        const any = s.chips.some(c => this._canOwn(c));
        if (!inShop || !any) {
          this.toast(inShop ? "NO CHIP YOU OWN HAS ROOM FOR A COPY" : "USE LOOKING GLASS IN THE SHOP");
          return;
        }
        // Only the Chips are redrawn: the rest of the shop, and what a reroll costs, stay as they were.
        const rerolls = s.shopRerolls,
          rest = s.shopInventory.filter(x => x.kind !== "chip");
        s.consumables.splice(index, 1);
        s.lookingGlass = true;
        this.generateShop(false);
        s.shopInventory = [...s.shopInventory.filter(x => x.kind === "chip"), ...rest];
        s.shopRerolls = rerolls;
        this.toast("LOOKING GLASS · CHIPS YOU OWN");
        this.render();
        return;
      }
      // Board items act on the blind being played.
      if (["bumpercar", "slide", "second"].includes(item.action)) {
        const no = inShop
          ? `USE ${item.name.toUpperCase()} ON A LIVE BLIND`
          : item.action !== "bumpercar" && s.boss === "undertow"
            ? "DJ UNDERTOW MOVES THE POCKETS HIMSELF"
            : item.action === "bumpercar" && s.bumperCar
              ? "THE BUMPER CAR IS ALREADY ON THE BOARD"
              : "";
        if (no) {
          this.toast(no);
          return;
        }
      }
      if (item.action === "skip") {
        if (inShop) {
          this.toast("USE BLIND SKIP ON A LIVE BLIND");
          return;
        }
        if (s.round >= BALANCE.FINAL_BLIND) {
          this.toast("THE FINAL BLIND CANNOT BE SKIPPED");
          return;
        }
        if (s.rush?.active) {
          this.toast("A RUSHED BOSS CANNOT BE SKIPPED");
          return;
        }
      }
      s.consumables.splice(index, 1);
      if (item.action === "coins") {
        s.coins += item.value;
        if (s.stats) s.stats.coinsEarned += item.value;
        this.toast(`+${item.value}¢`);
      } else if (item.action === "bumpercar") {
        // The board is rebuilt with the extra bumpers; it stays that way until the blind ends.
        // The pockets are kept as they stand (DJ Undertow may have moved them).
        const pockets = this.physics.bucketValues;
        s.bumperCar = true;
        this._boardRules();
        this.physics.setRound(s.round);
        this.physics.bucketValues = pockets;
        this.toast("BUMPER CAR · THIS BLIND");
      } else if (item.action === "skip") {
        s.score = Math.max(s.score, s.target);
        this._payBlind();
        s.phase = "roundEnd";
        s.won = true;
        this.generateShop();
        this.toast("BLIND SKIPPED · SHOP OPEN");
      } else if (item.action === "redeal") {
        s.deck = this._buildDeck();
        s.discardPile = [];
        s.cards = Array.from({ length: 5 }, () => this._drawCard());
        this._bossDeal();
        s.held = [false, false, false, false, false];
        s.spins = 0;
        this.toast("REDEALT · BOTH DRAWS BACK");
        this.view?.dealt?.([0, 1, 2, 3, 4]);
      } else if (item.action !== "none") {
        s.pendingBoosts.push({ action: item.action, value: item.value });
        this.toast(`${item.name.toUpperCase()} · NEXT HAND`);
      }
      this.evaluateHand();
      this.render();
    }
  };
})();
