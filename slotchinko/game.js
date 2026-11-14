/* Slotchinko run manager: hands, drops, blinds. Logic only; everything on screen
   goes through this.view (null in the test harness). sound.js wraps these methods. */
(() => {
  "use strict";
  const { SUITS, BALANCE } = window.SlotchinkoData;
  const { createDeck, evaluatePokerHand } = window.SlotchinkoPoker;
  const BALL_GAP_STEPS = 20,
    FINISH_DELAY_STEPS = 27;

  // Locked items (the unlock pool). Open by default; the page passes the player's own list from prefs.
  const defaultLocked = () => [];

  class SlotchinkoGame {
    constructor({ view = null, seed = null, ng = 0, deckId = "house", locked = null } = {}) {
      this.view = view;
      this.rng = new window.SlotchinkoRNG.SeededRandom(seed);
      this.timers = [];
      this.stepCount = 0;
      this.physics = new window.PlinkoPhysics(
        {
          onPegHit: (ball, peg) => this.onPegHit(ball, peg),
          onBallSpawn: ({ reason }) => {
            if (reason === "split") {
              this.state.activeBalls++;
              this._onSplit();
            }
          },
          onPegDestroyed: ({ element }) => this.onPegDestroyed(element),
          onObstacleHit: () => this.vibrate(4),
          onBucket: result => this.onBucket(result)
        },
        () => this.rng.random("physics")
      );
      this.newRun(seed, { ng, deckId, locked });
    }

    _ngHas(id) {
      const n = this.state?.ng || 0;
      return window.SlotchinkoData.NG.MODS.slice(0, n).some(m => m.id === id);
    }
    /* Blind target with the New Game+ raise. */
    _target(round) {
      const t = BALANCE.BLIND_TARGETS[round - 1];
      return t == null
        ? 0
        : Math.round(
            t *
              (1 + window.SlotchinkoData.NG.TARGET_STEP * (this.state?.ng || 0)) *
              (this._ngHas("high-stakes") ? window.SlotchinkoData.NG.HIGH_STAKES : 1)
          );
    }

    newRun(
      seed = this.rng.seed,
      {
        ng = this.state?.ng || 0,
        deckId = this.state?.deckId || "house",
        locked = this.state?.locked || defaultLocked()
      } = {}
    ) {
      this.rng.reset(seed);
      this.timers = [];
      this.state = {
        phase: "slot",
        round: 1,
        score: 0,
        total: 0,
        handsLeft: BALANCE.HANDS_PER_BLIND,
        target: BALANCE.BLIND_TARGETS[0],
        coins: BALANCE.START_COINS,
        roundScore: 0,
        spins: 0,
        maxSpins: 2,
        deck: [],
        discardPile: [],
        cards: [],
        reels: [],
        held: [false, false, false, false, false],
        hand: "High Card",
        handDetail: "",
        power: 1,
        balls: 1,
        ballsLeft: 0,
        chips: [],
        consumables: [],
        pendingBoosts: [],
        shopInventory: [],
        shopRerolls: 0,
        shopOpen: false,
        aim: 0.5,
        activeBalls: 0,
        won: false,
        glassCharge: true,
        primarySuit: "heart",
        lastEvaluation: null,
        diamondHits: 0,
        runBuffs: [],
        deckMods: { aces: 0, trim: false, gold: false, joker: false, glitch: false },
        croupierPaid: 0,
        compPaid: 0,
        grinBonus: 0,
        coinsEarnedThisBlind: 0,
        activeBoosts: [],
        victory: false,
        targetHit: false,
        glassLeft: 0,
        glassBoost: 0,
        finishing: false,
        ng: Math.max(0, Math.min(window.SlotchinkoData.NG.MAX, ng | 0)),
        deckId,
        itemSerial: 0,
        locked: [...(locked || [])],
        path: null,
        event: null,
        node: "blind",
        boss: null,
        trophies: [],
        dropFx: null,
        blindPayMult: 1,
        baseSpins: 2,
        handsMax: BALANCE.HANDS_PER_BLIND,
        tiltReady: false,
        stats: {
          bestHand: null,
          bestPower: 0,
          bestRank: 0,
          coinsEarned: 0,
          chipPay: {},
          bestDrop: 0,
          hands: {},
          maxBag: 0,
          sets: [],
          firstHandClears: 0,
          lastHandClears: 0,
          sold: 0,
          bossSpare: 0,
          events: 0
        }
      };
      const s = this.state;
      s.target = this._target(1);
      s.baseSpins = s.maxSpins;
      this._applyDeck(deckId);
      this._boardRules();
      this.physics.setRound(1);
      this._bossBoard();
      this._startNewHand();
      this.render();
    }

    /* One fixed 60 Hz tick. All gameplay timing counts ticks, so seeds replay exactly. */
    step() {
      if (this.state.phase !== "drop") return;
      this.physics.step();
      this.stepCount++;
      const due = this.timers.filter(t => t.at <= this.stepCount);
      if (due.length) {
        this.timers = this.timers.filter(t => t.at > this.stepCount);
        due.forEach(t => t.fn());
      }
      const s = this.state;
      if (s.phase === "drop" && !s.finishing && s.ballsLeft === 0 && this.physics.balls.size === 0) {
        s.finishing = true;
        s.activeBalls = 0;
        this.after(FINISH_DELAY_STEPS, () => this.finishRound());
      }
    }
    after(steps, fn) {
      this.timers.push({ at: this.stepCount + steps, fn });
    }

    /* Run rules the board is built from. Call before every physics.setRound. */
    _boardRules() {
      this.physics.drainRound = this._ngHas("hungry-drains") ? 2 : 0;
      this.physics.bumperOn = (this.state.runBuffs || []).some(b => b.effect?.bumper);
      this.physics.die = null;
      this.physics.mystery = null;
    }
    /* Which jackpot layout a blind plays on. Worked out from the run's seed and the blind number alone, so it can be
       shown before the blind starts and survives a save. Early blinds and bosses keep the centre jackpot. */
    _layoutFor(round) {
      const T = window.SlotchinkoData.BOSS_TUNE;
      if (round < T.LAYOUT_FROM || this._bossFor(round)) return "classic";
      const ids = Object.keys(T.LAYOUTS);
      const pick = r => ids[window.SlotchinkoRNG.hash(`${this.rng.seed}:layout:${r}`) % ids.length];
      // Never the same board twice running: step to the next layout if it would repeat the blind before.
      const before = round - 1 >= T.LAYOUT_FROM && !this._bossFor(round - 1) ? this._layoutFor(round - 1) : "classic";
      const mine = pick(round);
      return mine === before ? ids[(ids.indexOf(mine) + 1) % ids.length] : mine;
    }
    /* Where this hand's balls do best on this board: a list of { aim, wide } (lanes.js). The test bot aims by it. */
    aimHints() {
      const ph = this.physics;
      if (!this.state.primarySuit || !ph.jackpots) return [];
      return window.SlotchinkoLanes.hint(this.state.primarySuit, ph.jackpots(), ph.width);
    }
    /* The player-facing name of a blind's board ("Left jackpot"); this blind's when no round is given. */
    layoutName(round) {
      const id = round == null ? this.state.layout || "classic" : this._layoutFor(round);
      return window.SlotchinkoData.BOSS_TUNE.LAYOUT_NAMES[id];
    }
    /* Hands this blind gives: three, or one fewer with High Roller. */
    _handsPerBlind() {
      return Math.max(1, BALANCE.HANDS_PER_BLIND - (this._effects().fewerHands ? 1 : 0));
    }
    /* Per-drop board gambles: Loaded Die doubles one pocket, Mystery Pocket hides one, Golden Peg gilds a peg. */
    _dropGambles(fx) {
      const s = this.state,
        ph = this.physics,
        rnd = this.rng.stream("gamble"),
        jack = ph.jackpots?.() || [3];
      const free = () =>
        (ph.bucketValues || [])
          .map((v, i) => i)
          .filter(
            i => !jack.includes(i) && !(ph.drainPockets || []).includes(i) && i !== ph.die && i !== ph.mystery?.index
          );
      ph.die = null;
      ph.mystery = null;
      if (fx.loadedDie) {
        const f = free();
        if (f.length) ph.die = f[Math.floor(rnd() * f.length)];
      }
      if (fx.mystery) {
        const f = free();
        if (f.length) {
          const table = BALANCE.MYSTERY,
            total = table.reduce((n, x) => n + x[1], 0);
          let roll = rnd() * total,
            value = table[table.length - 1][0];
          for (const [v, w] of table) {
            roll -= w;
            if (roll <= 0) {
              value = v;
              break;
            }
          }
          ph.mystery = { index: f[Math.floor(rnd() * f.length)], value, shown: false };
        }
      }
      if (this._boost(s.activeBoosts, "goldpeg") > 0) ph.gildPeg?.(rnd);
    }
    /* Tilt: one shove toward the middle, once per drop, only when a Tilt was used for this drop. */
    tilt() {
      const s = this.state;
      if (s.phase !== "drop" || !s.tiltReady) return;
      s.tiltReady = false;
      this.physics.tilt?.();
      this.toast("TILT!");
      this.vibrate([20, 30, 20]);
      this.render();
    }

    /* Starting deck edges (see DECKS in data.js). */
    _applyDeck(id) {
      const s = this.state,
        C = window.SlotchinkoData.CHIP_CATALOG;
      if (id === "mint") s.chips.push({ ...C.find(c => c.id === "coin-press"), instanceId: "deck-coin-press" });
      else if (id === "rubber")
        s.runBuffs.push({
          id: "rubber-deck",
          name: "Rubber Deck",
          icon: "◍",
          rarity: "common",
          kind: "buff",
          duration: "run",
          desc: "Balls bounce 15% harder all run.",
          effect: { bounce: 0.15 },
          instanceId: "deck-rubber"
        });
      else if (id === "ace-high") s.deckMods.deckAces = 4;
      else if (id === "glass")
        s.runBuffs.push({
          id: "glass-deck",
          name: "Glass Deck",
          icon: "◇",
          rarity: "rare",
          kind: "buff",
          duration: "run",
          desc: "Score ×1.6. Chips can shatter after a blind.",
          effect: { scoreMult: 1.6 },
          instanceId: "deck-glass"
        });
      else if (id === "pachinko")
        s.runBuffs.push({
          id: "pachinko-deck",
          name: "Pachinko Deck",
          icon: "◎",
          rarity: "common",
          kind: "buff",
          duration: "run",
          desc: "+1 ball every hand, 20% less power.",
          effect: { extraBalls: 1 },
          instanceId: "deck-pachinko"
        });
    }
    /* The standard deck plus the run's bought deck cards (extra Aces, trimmed 2s, gold Aces, Joker, Glitched Ace). */
    _buildDeck() {
      const m = this.state.deckMods || {},
        rnd = this.rng.stream("deck");
      let deck = createDeck(rnd);
      // same order as before deck cards existed
      if (!m.aces && !m.trim && !m.gold && !m.deckAces && !m.joker && !m.glitch) return deck;
      for (let i = 0; i < (m.deckAces || 0); i++) {
        const suit = SUITS[i % 4];
        deck.push({ id: `14-${suit}-d${i}`, rank: 14, label: "A", suit });
      }
      for (let i = 0; i < (m.aces || 0); i++) {
        const suit = SUITS[i % 4];
        deck.push({ id: `14-${suit}-x${i}`, rank: 14, label: "A", suit });
      }
      if (m.glitch) deck.push({ id: "14-spade-glitch", rank: 14, label: "A", suit: "spade", glitch: true });
      if (m.trim) deck = deck.filter(c => c.rank > 2);
      if (m.gold) deck = deck.map(c => (c.rank === 14 ? { ...c, gold: true } : c));
      if (m.joker) deck.push({ id: "joker", rank: 0, label: "★", suit: "spade", joker: true });
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      return deck;
    }
    _drawCard() {
      return this.state.deck.pop() || null;
    }

    _startNewHand() {
      const s = this.state;
      s.deck = this._buildDeck();
      s.discardPile = [];
      s.cards = Array.from({ length: 5 }, () => this._drawCard());
      this._bossDeal();
      s.held = [false, false, false, false, false];
      s.spins = 0;
      s.lastEvaluation = null;
      this.evaluateHand();
    }

    /* The tutorial's first hand is always the same: two Kings showing, and a third King on top of the deck,
       so "keep the pair, draw, drop" works for everyone. Cards are only moved, never added. */
    dealTutorialHand() {
      const s = this.state;
      if (s.phase !== "slot" || s.round !== 1 || s.spins || s.deckId !== "house") return;
      const all = [...s.cards, ...s.deck],
        take = id => {
          const i = all.findIndex(c => c && c.id === id);
          return i < 0 ? null : all.splice(i, 1)[0];
        };
      const hand = ["13-heart", "13-spade", "7-diamond", "4-club", "9-spade"].map(take),
        next = ["13-diamond", "5-heart", "10-club"].map(take);
      if ([...hand, ...next].some(c => !c)) return;
      s.cards = hand;
      // draws come off the end, so the King is first
      s.deck = [...all, ...next.reverse()];
      s.held = [false, false, false, false, false];
      s.tutorial = true;
      this.evaluateHand();
      this.render();
    }

    toggleHold(index) {
      const s = this.state;
      if (s.phase !== "slot" || !Number.isInteger(index) || index < 0 || index > 4) return;
      s.held[index] = !s.held[index];
      this.vibrate(8);
      this.render();
    }

    spin() {
      const s = this.state;
      if (s.phase !== "slot" || s.spins >= s.maxSpins) return;
      if (s.held.every(Boolean)) {
        this.toast("ALL CARDS HELD · RELEASE ONE TO DRAW");
        return;
      }
      const replaced = [];
      s.cards = s.cards.map((card, i) => {
        if (s.held[i]) return card;
        if (card) s.discardPile.push(card);
        const next = this._drawCard();
        if (next) replaced.push(i);
        return next || card;
      });
      s.spins++;
      this.evaluateHand();
      this.render();
      this.view?.dealt(replaced);
      this.toast(s.spins === s.maxSpins ? "FINAL DRAW USED" : "CARDS REDRAWN");
      this.vibrate(18);
    }

    _ownedCount(id) {
      return this.state.chips.filter(c => c.id === id).length;
    }

    evaluateHand() {
      const s = this.state;
      if (s.cards.length !== 5 || s.cards.some(c => !c)) return;
      const two = s.deckId === "wild-suit";
      this._playJoker(two);
      const result = evaluatePokerHand(
          two
            ? s.cards.map(c => ({ ...c, suit: c.suit === "heart" || c.suit === "diamond" ? "heart" : "spade" }))
            : s.cards
        ),
        fx = this._effects();
      s.lastEvaluation = result;
      s.hand = result.name;
      s.handDetail = `${result.description} · ${result.bonus}`;
      s.power = result.power * (1 + this._boost(s.pendingBoosts, "power")) * (s.deckId === "pachinko" ? 0.8 : 1);
      const gold = s.cards.filter(c => c.gold).length;
      s.goldBonus = gold * BALANCE.GOLD_POWER;
      s.power += s.goldBonus;
      // The Glitched Ace only works in a High Card hand, where it is by definition the only Ace.
      s.glitched = result.name === "High Card" && s.cards.some(c => c.glitch);
      if (s.glitched) {
        s.power *= BALANCE.GLITCH_POWER;
        s.handDetail = `${result.description} · GLITCHED ACE: +50% power, double balls`;
      }
      s.grinBonus = fx.grinBalls && (result.name === "High Card" || result.name === "One Pair") ? fx.grinBalls : 0;
      s.balls = Math.min(
        BALANCE.MAX_HAND_BALLS,
        result.balls * (s.glitched ? BALANCE.GLITCH_BALLS : 1) +
          fx.extraBalls +
          (this._dominantSuit() === "heart" ? fx.heartBalls : 0) +
          s.grinBonus +
          this._boost(s.pendingBoosts, "balls")
      );
      const NGT = window.SlotchinkoData.NG;
      if (
        this._ngHas("thin-hands") &&
        s.round >= NGT.THIN_FROM &&
        s.handsLeft === (s.handsMax || BALANCE.HANDS_PER_BLIND)
      )
        s.balls = Math.max(1, s.balls - 1);
      s.primarySuit = this._dominantSuit();
      // The board marks the outer pockets for a heavy hand, with what they pay it (boardview.js).
      this.physics.heavyHand = s.primarySuit === "spade";
      this.physics.spadeEdge = BALANCE.SPADE_EDGE + fx.spadeEdge;
      return result;
    }

    /* A Joker in hand becomes the card that makes the best hand (it takes that rank and suit until the next change). */
    _playJoker(twoTone) {
      const s = this.state,
        j = s.cards.find(c => c && c.joker);
      if (!j) return;
      const tone = c => (twoTone ? { ...c, suit: c.suit === "heart" || c.suit === "diamond" ? "heart" : "spade" } : c);
      const better = (a, b) => {
        if (a.category !== b.category) return a.category > b.category;
        for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
          const d = (a.tiebreak[i] || 0) - (b.tiebreak[i] || 0);
          if (d) return d > 0;
        }
        return false;
      };
      let best = null,
        pick = null;
      for (const suit of SUITS)
        for (let rank = 14; rank >= 2; rank--) {
          const r = evaluatePokerHand(s.cards.map(c => tone(c === j ? { ...c, rank, suit } : c)));
          if (!best || better(r, best)) {
            best = r;
            pick = { rank, suit };
          }
        }
      j.rank = pick.rank;
      j.suit = pick.suit;
    }

    /* The Glitched Ace in hand moves on to its next suit. The page calls this on a timer while the player is still
       choosing (ui.js); pressing Drop Hand stops the timer, so the suit showing then is the suit it plays as. */
    glitchTick() {
      const s = this.state,
        card = s.phase === "slot" && s.cards.find(c => c && c.glitch);
      if (!card) return false;
      card.suit = SUITS[(SUITS.indexOf(card.suit) + 1) % SUITS.length];
      this.evaluateHand();
      return true;
    }

    /* The run's named build, or null before one has formed (scoring.js). */
    build() {
      const m = this.state.deckMods || {},
        aces = 4 + (m.aces || 0) + (m.deckAces || 0) + (m.glitch ? 1 : 0);
      return window.SlotchinkoSets.build(this._effects().sets, aces);
    }

    /* Milestones marked `now` are granted the moment they happen, not at the end of the run. The run's locked
       list comes from the save, so each fires once per save; a game with no save has nothing locked. */
    _grantNow() {
      const s = this.state,
        due = window.SlotchinkoData.UNLOCKS.filter(u => u.now && s.locked.includes(u.id));
      if (!due.length) return;
      const m = this.summary();
      for (const u of due.filter(u => u.test(m))) {
        s.locked = s.locked.filter(id => id !== u.id);
        this.achieved(u.id);
      }
    }
    achieved(id) {
      this.view?.achieved(id);
    }

    _boost(list, action) {
      return list.reduce((sum, b) => sum + (b.action === action ? b.value : 0), 0);
    }

    _dominantSuit() {
      const counts = { heart: 0, spade: 0, diamond: 0, club: 0 };
      this.state.cards.forEach(c => counts[c.suit]++);
      return SUITS.reduce((best, suit) => (counts[suit] > counts[best] ? suit : best), SUITS[0]);
    }

    startDrop() {
      const s = this.state;
      if (s.phase !== "slot") return;
      this.evaluateHand();
      s.activeBoosts = [...s.pendingBoosts];
      s.pendingBoosts = [];
      s.phase = "drop";
      s.ballsLeft = s.balls;
      s.activeBalls = 0;
      s.finishing = false;
      s.roundScore = 0;
      s.diamondHits = 0;
      s.croupierPaid = 0;
      s.compPaid = 0;
      this._bossDropStart();
      const st = s.stats;
      if (st) {
        const rank = Object.keys(window.SlotchinkoData.HANDS).indexOf(s.hand);
        if (rank > st.bestRank || (rank === st.bestRank && s.power > st.bestPower) || !st.bestHand) {
          st.bestRank = Math.max(st.bestRank, rank);
          st.bestPower = s.power;
          st.bestHand = s.hand;
        }
        st.hands[s.hand] = (st.hands[s.hand] || 0) + 1;
        for (const x of this._effects().synergies) if (!st.sets.includes(x)) st.sets.push(x);
        this._grantNow();
      }
      if (s.glitched)
        this.payout({
          id: "glitched-ace",
          icon: "Ⱥ",
          name: "GLITCHED ACE",
          amount: s.lastEvaluation.balls * (BALANCE.GLITCH_BALLS - 1),
          unit: "BALL",
          kind: "ball"
        });
      if (s.grinBonus)
        this.payout({
          id: "grinning-ace",
          icon: "Ⓐ",
          name: "GRINNING ACE",
          amount: s.grinBonus,
          unit: "BALL",
          kind: "ball"
        });
      if (s.goldBonus)
        this.payout({
          id: "gold-leaf",
          icon: "✪",
          name: "GOLD LEAF",
          amount: s.goldBonus,
          unit: " POWER",
          kind: "points"
        });
      s.glassLeft = this._effects().glass;
      s.glassBoost = this._boost(s.activeBoosts, "glass");
      s.tiltReady = this._boost(s.activeBoosts, "tilt") > 0;
      s.dropFx.double = this._boost(s.activeBoosts, "double") > 0;
      s.dropFx.doubled = 0;
      s.dropFx.winds = 0;
      this._dropGambles(this._effects());
      this.physics.setWideCenter?.(this._boost(s.activeBoosts, "wide") > 0);
      this.render();
      this.view?.dropStarted();
      this.toast(`${s.hand.toUpperCase()} — ${s.balls} BALL${s.balls === 1 ? "" : "S"}`);
      this._dropNext();
    }

    _dropNext() {
      const s = this.state;
      if (s.phase !== "drop" || s.ballsLeft <= 0) return;
      // A full board waits for room, so no ball of the hand is ever lost.
      if (this.physics.balls.size >= window.PlinkoPhysics.MAX_BALLS) {
        this.after(BALL_GAP_STEPS, () => this._dropNext());
        return;
      }
      const fx = this._effects();
      // Every ball leaves a little to one side of the aim line. Without this, a few hair-thin lanes between the pegs
      // scored far better than their neighbours, and nobody could find them (docs/slotchinko/BOARDS.md).
      // Dead Aim: a club hand launches exactly where it is aimed.
      const loose = fx.steady && s.primarySuit === "club" ? 0 : fx.launchSpread + BALANCE.LAUNCH_JITTER,
        spread = (this.rng.random("launch") - 0.5) * loose * this.physics.width;
      s.ballsLeft--;
      s.activeBalls++;
      this.physics.drop(this._ballOptions(24 + s.aim * (this.physics.width - 48) + spread, fx));
      this.render();
      this.after(BALL_GAP_STEPS, () => this._dropNext());
    }

    /* A ball's suits are the hand's main suit (Sonny's fight: card by card), or all four under Wild Current. */
    _ballOptions(x, fx) {
      const s = this.state,
        wild = s.activeBoosts.some(b => b.action === "rainbow"),
        suit = this._ballSuit();
      const suits = wild ? [...SUITS] : [suit],
        has = x => suits.includes(x);
      return {
        x,
        element: suit,
        suits,
        heavy: has("spade"),
        fortune: has("diamond"),
        sticky: has("club"),
        damage: has("spade") ? 2 + fx.spadeDamage : 1,
        splitsLeft: has("heart") ? 1 + fx.reactor : 0,
        splitAt: fx.reactor ? 1 : BALANCE.HEART_SPLIT_HIT,
        chain: fx.splitChain > 0,
        wellPull: 1 + fx.wellPull + (has("spade") ? fx.spadeWell : 0),
        plating: fx.plating,
        stick: fx.stickPower,
        bounce: (fx.bounce || 0) + this._boost(s.activeBoosts, "bounce"),
        wideCenter: this._boost(s.activeBoosts, "wide") > 0,
        nudge: this._boost(s.activeBoosts, "nudge") > 0,
        magnet: fx.magnet || 0,
        centerMult: fx.funnel ? BALANCE.FUNNEL_MULT : 1
      };
    }

    onPegHit(ball, peg) {
      const s = this.state;
      this.vibrate(5);
      const p = ball && ball.plugin;
      if (!p) return;
      if (peg?.plugin?.gold && !p.gilded) {
        p.gilded = BALANCE.GOLD_PEG_MULT;
        this.toast("GOLDEN PEG · ×2");
      }
      if (!p.glass && (s.glassLeft > 0 || s.glassBoost > 0)) {
        p.glass = (s.glassLeft > 0 ? BALANCE.GLASS_MULT : 1) * (s.glassBoost || 1);
        s.glassLeft = Math.max(0, s.glassLeft - 1);
        s.glassBoost = 0;
      }
      if (p.suits && p.suits.includes("diamond")) {
        const fx = this._effects();
        s.diamondHits++;
        if (fx.diamondBonus && s.diamondHits % 3 === 0) {
          const bonus = BALANCE.DIAMOND_BONUS * fx.diamondBonus;
          s.roundScore += bonus;
          s.score += bonus;
          s.total += bonus;
          this.payout({
            id: "diamond-matrix",
            icon: "♦",
            name: "DIAMOND CHARGE",
            amount: bonus,
            unit: "PTS",
            kind: "points"
          });
        }
      }
    }

    onPegDestroyed() {
      this.vibrate(8);
    }

    onBucket(result) {
      const s = this.state,
        fx = this._effects(),
        ball = result.ball;
      let gained = this._bossBall(result, fx);
      const d = s.dropFx || {};
      if (d.double) {
        d.doubled = (d.doubled || 0) + gained;
        gained *= 2;
      }
      if (this.physics.mystery && result.index === this.physics.mystery.index && !this.physics.mystery.shown) {
        this.physics.mystery.shown = true;
        const mv = this.physics.mystery.value;
        this.toast(`MYSTERY POCKET · ×${mv}`);
      }
      // Second Wind: the first ball lost to a drain goes back in the launcher.
      if (result.drained && fx.secondWind && (d.winds || 0) < fx.secondWind && s.phase === "drop") {
        d.winds = (d.winds || 0) + 1;
        const idle = s.ballsLeft <= 0;
        s.ballsLeft++;
        this.payout({ id: "second-wind", icon: "↟", name: "SECOND WIND", amount: 1, unit: "BALL", kind: "ball" });
        if (idle) this.after(BALL_GAP_STEPS, () => this._dropNext());
      }
      s.roundScore += gained;
      s.score += gained;
      s.total += gained;
      s.activeBalls = Math.max(0, s.activeBalls - 1);
      const p = ball ? ball.plugin : {};
      if (fx.clubCoins && !result.drained && p.suits?.includes("club") && p.pegHits >= BALANCE.CLUB_COIN_HITS) {
        s.coins += fx.clubCoins;
        this.payout({ id: "club-king", icon: "♣", name: "CLUB KING", amount: fx.clubCoins, unit: "¢", kind: "coin" });
      }
      if (result.nudged)
        this.payout({ id: "nudge", icon: "⇥", name: "NUDGE SAVE", amount: 1, unit: "BALL", kind: "ball" });
      if (
        fx.croupier &&
        (this.physics.jackpots?.() || [3]).includes(result.index) &&
        !result.drained &&
        s.croupierPaid < BALANCE.CROUPIER_CAP * fx.croupier
      ) {
        s.croupierPaid++;
        s.coins++;
        this.payout({ id: "croupier-cut", icon: "♠", name: "CROUPIER'S CUT", amount: 1, unit: "¢", kind: "coin" });
      }
      if (
        fx.diamondCoins &&
        (this.physics.jackpots?.() || [3]).includes(result.index) &&
        !result.drained &&
        p.suits?.includes("diamond") &&
        s.compPaid < BALANCE.COMP_CAP * fx.diamondCoins
      ) {
        s.compPaid++;
        s.coins++;
        this.payout({ id: "comp", icon: "✉", name: "COMP", amount: 1, unit: "¢", kind: "coin" });
      }
      if (fx.pressCoins > 0) {
        const earned = Math.min(BALANCE.PRESS_CAP, Math.floor(s.roundScore / BALANCE.PRESS_STEP)) * fx.pressCoins;
        if (earned > s.coinsEarnedThisBlind) {
          const add = earned - s.coinsEarnedThisBlind;
          s.coins += add;
          s.coinsEarnedThisBlind = earned;
          this.payout({ id: "coin-press", icon: "▣", name: "COIN PRESS", amount: add, unit: "¢", kind: "coin" });
        }
      }
      if (!s.targetHit && s.score >= s.target) {
        s.targetHit = true;
        this.view?.targetHit();
      }
      this.view?.ballScored(result, gained);
      this.vibrate([12, 25, 12]);
      this.render();
    }

    /* Pays a cleared blind and pops a payout for each Chip that added to it. */
    _payBlind() {
      const s = this.state,
        fx = this._effects(),
        pay = this._blindPay(fx) * (s.blindPayMult || 1);
      s.coins += pay;
      if (s.stats) s.stats.coinsEarned += pay;
      const spare = Math.max(0, (s.handsLeft || 1) - 1) * BALANCE.SPARE_HAND_PAY;
      if (spare > 0) {
        s.coins += spare;
        this.payout({ id: "spare-hands", icon: "✋", name: "HANDS TO SPARE", amount: spare, unit: "¢", kind: "coin" });
      }
      const n = id => this._chipsInPlay().filter(c => c.id === id).length,
        coin = (id, icon, name, amount) =>
          amount > 0 && this.payout({ id, icon, name, amount, unit: "¢", kind: "coin", fromBlind: true });
      coin("pocket-change", "¢", "POCKET CHANGE", n("pocket-change"));
      coin("golden-touch", "✦", "GOLDEN TOUCH", 5 * n("golden-touch"));
      // The Coin family's set steps pay here too, under the build's name.
      const bank = fx.sets.find(x => x.family.id === "coin"),
        steps = bank ? bank.family.steps.slice(0, bank.step) : [],
        extra = steps.reduce((sum, x) => sum + (x.effect.coinsPerBlind || 0), 0);
      coin("coin-set", "¢", bank?.family.build.toUpperCase(), extra);
    }
    _onSplit() {
      const fx = this._effects();
      if (fx.reactor > 0)
        this.payout({ id: "heart-reactor", icon: "♥", name: "HEART REACTOR", amount: 1, unit: "BALL", kind: "ball" });
      else if (fx.splitChain > 0)
        this.payout({ id: "phoenix-heart", icon: "ღ", name: "PHOENIX HEART", amount: 1, unit: "BALL", kind: "ball" });
    }
    payout(e) {
      const st = this.state.stats;
      if (st) {
        if (e.unit === "¢" && !e.fromBlind) st.coinsEarned += e.amount;
        st.chipPay[e.id] = (st.chipPay[e.id] || 0) + 1;
      }
      this.view?.payout?.(e);
    }
    /* End-of-run summary: blinds reached, best hand, coins earned, the Chip that paid out most, best drop. */
    /* Elite blinds pay +6¢ and a free Rare Chip. */
    _eliteReward() {
      const s = this.state;
      if (s.node !== "elite") return;
      s.coins += 6;
      s.stats.coinsEarned += 6;
      this.payout({
        id: "elite",
        icon: "♛",
        name: "ELITE BOUNTY",
        amount: 6,
        unit: "¢",
        kind: "coin",
        fromBlind: true
      });
      const c = this._freeChip("rare", this.rng.stream("path"));
      if (c) this.toast(`ELITE BOUNTY · ${c.name.toUpperCase()}`);
    }
    summary() {
      const s = this.state,
        st = s.stats || {},
        pay = Object.entries(st.chipPay || {}).sort((a, b) => b[1] - a[1])[0];
      const all = [
        ...window.SlotchinkoData.CHIP_CATALOG,
        ...window.SlotchinkoData.CARD_CATALOG,
        ...window.SlotchinkoData.BUFF_CATALOG
      ];
      const name = id =>
        (all.find(x => x.id === id) || s.chips.find(x => x.id === id) || {}).name ||
        id.replace(/-/g, " ").toUpperCase();
      const order = ["legendary", "rare", "uncommon", "common"],
        owned = [...s.chips].sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity))[0];
      return {
        blinds: s.victory ? s.round : s.round - 1,
        round: s.round,
        score: s.total,
        bestHand: st.bestHand || "—",
        coinsEarned: st.coinsEarned || 0,
        bestRank: st.bestRank || 0,
        firstHandClears: st.firstHandClears || 0,
        lastHandClears: st.lastHandClears || 0,
        sold: st.sold || 0,
        bossSpare: st.bossSpare || 0,
        events: st.events || 0,
        hands: { ...(st.hands || {}) },
        maxBag: st.maxBag || 0,
        sets: [...(st.sets || [])],
        chipFamilies: s.chips.map(c => c.family),
        topChip: pay ? { name: name(pay[0]), times: pay[1] } : owned ? { name: owned.name, times: 0 } : null,
        bestDrop: st.bestDrop || 0,
        ng: s.ng,
        deckId: s.deckId,
        victory: !!s.victory
      };
    }
    _blindPay(fx = this._effects()) {
      return Math.max(
        0,
        BALANCE.BLIND_PAY +
          Math.floor(this.state.round / 2) +
          fx.coinsPerBlind -
          (this._ngHas("lean-purse") && this.state.round >= window.SlotchinkoData.NG.LEAN_FROM ? 1 : 0)
      );
    }

    finishRound() {
      const s = this.state;
      if (s.phase !== "drop") return;
      s.phase = "roundEnd";
      this.physics.setWideCenter?.(false);
      s.tiltReady = false;
      this.physics.die = null;
      this.physics.mystery = null;
      this.physics.ungild?.();
      // Double or Nothing: the drop was scored double as it fell. Short of the target, it counts for half instead.
      const d = s.dropFx || {};
      if (d.double) {
        d.double = false;
        if (s.score < s.target) {
          const back = Math.ceil(d.doubled * 1.5);
          s.score -= back;
          s.total -= back;
          s.roundScore = Math.max(0, s.roundScore - back);
          this.toast("DOUBLE OR NOTHING · HALVED");
        } else
          this.payout({
            id: "double-nothing",
            icon: "⚁",
            name: "DOUBLED",
            amount: d.doubled,
            unit: "PTS",
            kind: "points"
          });
      }
      if (s.stats) s.stats.bestDrop = Math.max(s.stats.bestDrop, s.roundScore);
      // A blind gives HANDS_PER_BLIND hands. A short drop with a hand left deals the next one.
      if (s.score < s.target && s.handsLeft > 1) {
        s.handsLeft--;
        s.phase = "slot";
        this._startNewHand();
        this.toast(s.handsLeft === 1 ? "LAST HAND" : `${s.handsLeft} HANDS LEFT`);
        this.render();
        this.view?.dealt?.([0, 1, 2, 3, 4]);
        return;
      }
      if (s.score >= s.target) {
        s.won = true;
        const st = s.stats,
          max = s.handsMax || BALANCE.HANDS_PER_BLIND;
        if (st) {
          if (s.handsLeft === max) st.firstHandClears = (st.firstHandClears || 0) + 1;
          if (s.handsLeft === 1) st.lastHandClears = (st.lastHandClears || 0) + 1;
          if (this._bossDef() && s.handsLeft > 1) st.bossSpare = (st.bossSpare || 0) + 1;
        }
        this._bossBeaten();
        if (s.round >= BALANCE.FINAL_BLIND) {
          s.victory = true;
          s.shopInventory = [];
          this.toast("FINAL BLIND BEATEN");
        } else {
          this._payBlind();
          this._eliteReward();
          this._shatter();
          this.generateShop();
          this.toast("BLIND CLEARED · SHOP OPEN");
        }
      } else {
        s.won = false;
        s.shopInventory = [];
        this.toast("BLIND FAILED · RUN ENDED");
      }
      this.render();
      if (s.victory || !s.won) this.view?.runEnded();
    }

    nextRound(node = "blind", extra = {}) {
      const s = this.state;
      if (s.phase !== "roundEnd" || !s.won || s.victory) return;
      // an event card is waiting for its choice
      if (s.event) return;
      const { climb = 1, blindPay = 1 } = extra,
        bossDef = this._bossFor(s.round + 1);
      s.round++;
      s.node = node;
      s.boss = bossDef?.id || null;
      s.layout = this._layoutFor(s.round);
      s.blindPayMult = blindPay;
      s.path = null;
      // Every blind starts from zero: the target is what this blind alone asks for.
      s.score = 0;
      s.handsMax = this._handsPerBlind();
      s.handsLeft = s.handsMax;
      s.target = Math.round(
        this._target(s.round) * climb * (node === "elite" ? BALANCE.ELITE_CLIMB : 1) * this._bossClimb(bossDef)
      );
      s.maxSpins = s.baseSpins || 2;
      if (bossDef) this.toast(`BOSS BLIND · ${bossDef.name.toUpperCase()}`);
      else if (s.layout !== "classic" && node !== "elite") this.toast(`NEW BOARD · ${this.layoutName().toUpperCase()}`);
      else if (node === "elite") this.toast("ELITE BLIND · +6¢ AND A RARE CHIP");
      s.phase = "slot";
      s.won = false;
      s.shopOpen = false;
      s.shopInventory = [];
      s.targetHit = false;
      s.coinsEarnedThisBlind = 0;
      s.activeBoosts = [];
      this._boardRules();
      this.physics.setRound(s.round);
      this._bossBoard();
      this._startNewHand();
      this.render();
    }

    render() {
      this.physics.centerMult = this._effects().funnel ? BALANCE.FUNNEL_MULT : 1;
      this.view?.render(this);
    }
    toast(message) {
      this.view?.toast(message);
    }
    vibrate(pattern) {
      this.view?.vibrate(pattern);
    }
  }

  Object.assign(
    SlotchinkoGame.prototype,
    window.SlotchinkoScoring,
    window.SlotchinkoShopLogic,
    window.SlotchinkoPath,
    window.SlotchinkoBossRules
  );
  window.SlotchinkoGame = SlotchinkoGame;
  window.SlotchinkoShop = {
    CHIP_CATALOG: window.SlotchinkoData.CHIP_CATALOG,
    CONSUMABLE_CATALOG: window.SlotchinkoData.CONSUMABLE_CATALOG
  };
})();
