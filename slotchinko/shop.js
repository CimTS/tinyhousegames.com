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
        slots = { ...BALANCE.SHOP_SLOTS },
        rnd = this.rng.stream("shop"),
        open = d => !(s.locked || []).includes(d.id);
      if (s.deckId === "hoarder") slots.chip--;
      const pools = {
        chip: CHIP_CATALOG.filter(d => open(d) && this._canOwn(d)),
        card: CARD_CATALOG.filter(d => open(d) && this._canOwn(d)),
        consumable: CONSUMABLE_CATALOG.filter(d => open(d) && !s.consumables.some(c => c.id === d.id && d.unique)),
        buff: BUFF_CATALOG.filter(d => open(d) && this._canOwn(d))
      };
      // The shop leans toward what you own: each Chip of a family you hold makes that family likelier (up to a cap).
      const owned = id => Math.min(BALANCE.SHOP_LEAN_CAP, s.chips.filter(c => c.family === id).length),
        leaning = d => 1 + BALANCE.SHOP_LEAN * owned(d.family),
        discount = this._effects().discount;
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
        return n === 0 || (def.stackable && n < (def.maxStack || 1));
      }
      if (def.kind === "card") return def.deck === "addAce" ? (m.aces || 0) < def.maxStack : !m[def.deck];
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
      if (item.action === "skip") {
        if (inShop) {
          this.toast("USE BLIND SKIP ON A LIVE BLIND");
          return;
        }
        if (s.round >= BALANCE.FINAL_BLIND) {
          this.toast("THE FINAL BLIND CANNOT BE SKIPPED");
          return;
        }
      }
      s.consumables.splice(index, 1);
      if (item.action === "coins") {
        s.coins += item.value;
        if (s.stats) s.stats.coinsEarned += item.value;
        this.toast(`+${item.value}¢`);
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
