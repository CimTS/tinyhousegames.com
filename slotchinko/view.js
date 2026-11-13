/* Slotchinko DOM view: writes game state to the page. Shop markup is in view-shop.js. */
(() => {
  "use strict";
  const { SUIT_GLYPHS, SUIT_NAMES, BALANCE } = window.SlotchinkoData;
  const $ = id => document.getElementById(id);
  const WORLD_W = 340,
    AIM_INSET = 24;
  const plural = n => `${n} BALL${n === 1 ? "" : "S"}`;

  // Height of the pocket row at the bottom of the board, in board units (boardview.js draws it).
  const POCKET_ROW = 37;
  class GameView {
    constructor(prefs, overlays) {
      this.prefs = prefs;
      this.overlays = overlays;
      this.sig = {};
      const L = window.SlotchinkoPayoutLayer;
      this.payoutLayers = L ? { hud: new L($("payout-layer")), board: new L($("payout-board")) } : null;
    }
    /* Coins pop under the coin counter; balls and points pop on the board. */
    payout(e) {
      if (!this.payoutLayers) return;
      if (e.kind === "coin") {
        // Sit just under the top bar (below the coin counter, never over it); top of the screen once it scrolls away.
        const bar = document.querySelector(".topbar"),
          y = bar ? bar.getBoundingClientRect().bottom : 0;
        $("payout-layer").style.top = `${Math.max(10, Math.round(y) + 8)}px`;
        // The wide layout's bar ends at the board, not at 560px.
        if (bar && bar.offsetWidth > 560) {
          $("payout-layer").style.right = `${Math.round(window.innerWidth - bar.getBoundingClientRect().right)}px`;
        }
        this.payoutLayers.hud.show(e);
      } else this.payoutLayers.board.show(e);
    }
    attach(game, board) {
      this.game = game;
      this.board = board;
    }

    /* Skips DOM writes when nothing changed; render() runs on every landing ball. */
    changed(key, value) {
      if (this.sig[key] === value) return false;
      this.sig[key] = value;
      return true;
    }

    render(game) {
      const s = game.state;
      this.game = game;
      $("round-value").textContent = `${s.round}/${BALANCE.FINAL_BLIND}`;
      $("score-value").textContent = s.score.toLocaleString("en-US");
      $("target-value").textContent = s.target.toLocaleString("en-US");
      if (this.changed("coins", s.coins))
        $("coins-value").textContent = `${s.coins}¢`; /* coin.js draws the ¢ as the coin */
      const pct = Math.min(100, (100 * s.score) / s.target);
      $("target-bar-fill").style.width = `${pct}%`;
      $("target-bar").classList.toggle("is-hit", s.score >= s.target);
      $("target-bar").setAttribute("aria-valuenow", String(Math.round(pct)));
      $("hand-name").textContent = s.hand;
      $("hand-power").textContent = `×${Number(s.power.toFixed(2))}`;
      $("hand-detail").textContent = s.handDetail;
      $("balls-preview").textContent = `${SUIT_GLYPHS[s.primarySuit]} ${plural(s.balls)}`;
      $("balls-left").textContent = `BALLS: ${s.ballsLeft + s.activeBalls}`;
      $("round-earned").textContent = `THIS DROP: ${s.roundScore.toLocaleString("en-US")}`;
      const hn = s.handsMax || BALANCE.HANDS_PER_BLIND;
      $("tilt-button").hidden = !(s.phase === "drop" && s.tiltReady);
      $("hand-count").textContent = window.SlotchinkoCopy.words(
        `HAND ${Math.min(hn, hn - (s.handsLeft || hn) + 1)} OF ${hn} · TAP CARDS TO HOLD`
      );
      this.phaseText(s);
      // The aim hint shows while a hand is being chosen or aimed, if it is switched on in Settings.
      this.game.physics.showHints = s.phase === "slot" && this.prefs.hintsOn();
      const board = s.layout && s.layout !== "classic" && !s.boss ? this.game.layoutName() : "";
      $("board-layout").hidden = !board;
      if (this.changed("board-layout", board)) $("board-layout").textContent = board ? ` · ${board.toUpperCase()}` : "";
      this.buttons(s);
      this.cards(s);
      const overlay = $("board-overlay");
      overlay.classList.toggle("hidden", s.phase === "drop" || !!game.aimFlow?.aiming);
      overlay.textContent =
        s.phase === "roundEnd"
          ? s.victory
            ? "YOU BEAT THE HOUSE"
            : s.won
              ? "BLIND CLEARED"
              : "RUN OVER"
          : "YOUR BOARD IS WAITING";
      this.renderShop(s);
      this.renderInventory(s);
      this.renderAim();
      this.coach(s);
      const next = `${s.phase}:${s.won}:${s.round}`;
      // With a tip showing on a phone, stay at the top: the tip sits just above the shop.
      if (this.changed("flow", next) && s.phase === "roundEnd" && s.won && !s.victory) {
        if (this.phone() && document.body.classList.contains("coaching")) this.scrollTop();
        else this.scrollTo($("shop-ui"));
      }
      if (s.phase === "slot" && this.changed("hand", `${s.round}:${s.handsLeft}`)) this.scrollTop();
    }

    phaseText(s) {
      const line = window.SlotchinkoStatus.banner(s, !!this.game.aimFlow?.aiming, BALANCE.HANDS_PER_BLIND);
      $("phase-label").textContent = line.label;
      $("status-message").textContent = window.SlotchinkoCopy.words(line.message);
    }

    /* First-hand tips (coach.js): one instruction at a time in the banner, with a glow on the thing to press. */
    coach(s) {
      const on = !!this.prefs.coachOn?.();
      if (on && (s.round > 1 || s.victory || (s.phase === "roundEnd" && !s.won))) this.prefs.coachDone();
      // In the shop Lou goes one thing at a time: your coins, one Chip to buy, the way out.
      const inShop = s.phase === "roundEnd" && s.won && !s.victory;
      if (!on || !inShop) this.coachShop = null;
      else {
        const c = this.coachShop || (this.coachShop = { step: 0, owned: s.chips.length });
        c.bought = s.chips.length > c.owned;
        // Lou points at the cheapest Chip they can afford.
        const p = c.bought
          ? null
          : s.shopInventory.filter(x => x.kind === "chip" && x.cost <= s.coins).sort((a, b) => a.cost - b.cost)[0];
        c.pick = p ? { id: p.instanceId, cost: p.cost } : null;
      }
      const Coach = window.SlotchinkoCoach;
      const tutorial = on ? Coach.tip(s, !!this.game.aimFlow?.aiming, this.coachShop || {}) : null;
      // After the tutorial: one line the first time something new shows up. It counts as read once the hand is dropped.
      if (this.momentId && s.phase === "drop") this.prefs.tipSeen(this.momentId);
      const moment =
        !tutorial && this.prefs.tipsOn() ? Coach.moment(s, this.prefs.seenTips(), this.coachRules()) : null;
      this.momentId = moment ? moment.id : null;
      const tip = tutorial || moment;
      document.body.classList.toggle("coaching", !!tip);
      $("coach").hidden = !tip;
      document.body.dataset.coach = tutorial ? tutorial.n : moment ? "tip" : "";
      // The shop redraws its cards, so the glow is put back every time; the words only when they change.
      const find = t => (/^[.#\[]/.test(t) ? document.querySelector(t) : $(t)),
        target = tip && tip.target ? find(tip.target) : null;
      document.querySelectorAll(".coach-glow").forEach(e => {
        if (e !== target) e.classList.remove("coach-glow");
      });
      target?.classList.add("coach-glow");
      if (!this.changed("coach", tip ? (tip.n || tip.id) + tip.text : "")) return;
      if (!tip) return;
      $("coach-next").hidden = !tip.next;
      // Lou pins under the top bar in the shop on a phone (polish.css); the bar's height varies with the screen.
      const bar = document.querySelector(".topbar");
      if (bar) document.body.style.setProperty("--bar-h", `${Math.round(bar.getBoundingClientRect().height)}px`);
      if (inShop && target && tip.n === 7)
        window.setTimeout(() => target.scrollIntoView({ behavior: this.scrollMode(), block: "nearest" }), 160);
      if (!$("coach-face").firstChild) $("coach-face").innerHTML = window.SlotchinkoBossArt?.host || "";
      $("coach-step").textContent = `${Coach.HOST} · ${tip.n ? `${tip.n} OF ${tip.of}` : "TIP"}`;
      $("coach-text").textContent = window.SlotchinkoCopy.words(tip.text);
    }

    /* A tap on the pocket row: say what that pocket is (lanes.js). Taps anywhere else on the board only aim. */
    pocketTapped(e, canvas) {
      const ph = this.game.physics,
        rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((e.clientX - rect.left) / rect.width) * ph.width,
        y = ((e.clientY - rect.top) / rect.height) * ph.height;
      if (y < ph.height - POCKET_ROW) return;
      const i = ph.pocketAt(Math.max(0, Math.min(ph.width - 0.01, x)));
      this.game.toast(this.pocketLine(i));
    }
    pocketLine(i) {
      const ph = this.game.physics;
      return window.SlotchinkoLanes.describe({
        value: ph.pocketValue(i),
        drain: ph.drainPockets.includes(i),
        jackpot: ph.jackpots().includes(i),
        heavyHand: !!ph.heavyHand,
        edge: i === 0 || i === 6,
        spadeEdge: window.SlotchinkoData.BALANCE.SPADE_EDGE
      });
    }

    /* The numbers Lou's one-line tips quote, read from the game's own tables. */
    coachRules() {
      const B = window.SlotchinkoData.BALANCE;
      return {
        spadeEdge: B.SPADE_EDGE,
        fortune: B.FORTUNE_BUCKET,
        twin: Math.max(...window.SlotchinkoData.BOSS_TUNE.LAYOUTS.twin),
        drainRound: this.game.physics.drainRound || B.DRAIN_ROUND
      };
    }

    buttons(s) {
      const spin = $("spin-button"),
        drop = $("drop-button"),
        shop = s.phase === "roundEnd" && s.won && !s.victory;
      spin.disabled = s.phase !== "slot" || s.spins >= s.maxSpins;
      if (this.changed("spin", s.spins))
        spin.innerHTML = `↻ DRAW <span class="subtle">(${s.maxSpins - s.spins} LEFT)</span>`;
      const aiming = !!this.game.aimFlow?.aiming;
      if (this.changed("drop", shop + "|" + aiming))
        drop.innerHTML = shop ? "CHOOSE PATH →" : aiming ? "DROP ●" : "DROP HAND ↓";
      drop.classList.toggle("drop-confirm", aiming);
      document.body.classList.toggle("aiming", aiming);
      // One stage at a time on a phone (phone.css): hand, aim, drop, shop, end.
      const stage =
        s.phase === "slot" ? (aiming ? "aim" : "hand") : s.phase === "drop" ? "drop" : shop ? "shop" : "end";
      if (document.body.dataset.stage !== stage) {
        document.body.dataset.stage = stage;
        if (this.phone()) $("app").scrollTop = 0;
      }
      drop.disabled = !(shop || s.phase === "slot");
    }

    cards(s) {
      document.querySelectorAll(".reel").forEach((el, i) => {
        const card = s.cards[i];
        if (!card) return;
        const red = card.suit === "heart" || card.suit === "diamond";
        const rank = el.querySelector(".card-rank"),
          symbol = el.querySelector(".symbol");
        const as = card.joker ? window.SlotchinkoData.RANKS.find(r => r.value === card.rank)?.label || "" : "";
        rank.textContent = card.joker ? `★${as}` : card.label;
        rank.classList.toggle("red-card", red);
        el.classList.toggle("is-joker", !!card.joker);
        symbol.textContent = SUIT_GLYPHS[card.suit];
        symbol.className = `symbol suit-${card.suit}`;
        el.classList.toggle("held", s.held[i]);
        el.querySelector("small").textContent = s.held[i] ? "HELD" : "HOLD";
        el.disabled = s.phase !== "slot";
        el.setAttribute("aria-pressed", String(s.held[i]));
        el.setAttribute(
          "aria-label",
          `${card.joker ? `Joker, playing as ${as}` : card.label} of ${SUIT_NAMES[card.suit]}${s.held[i] ? ", held" : ""}`
        );
      });
    }

    renderAim() {
      const a = this.game.state.aim;
      $("aim-guide").style.left = `${((AIM_INSET + a * (WORLD_W - 2 * AIM_INSET)) / WORLD_W) * 100}%`;
    }

    dealt(indexes) {
      indexes.forEach(i => {
        const el = document.querySelector(`.reel[data-index="${i}"]`);
        if (el) {
          el.classList.remove("dealing");
          void el.offsetWidth;
          el.classList.add("dealing");
        }
      });
    }
    dropStarted() {
      this.scrollTo($("plinko-section"), "center");
    }
    ballScored(result, gained) {
      if (this.board)
        this.board.score(
          result.index,
          gained > 0 ? `+${gained.toLocaleString("en-US")}` : result.note || "DRAINED",
          gained > 0
        );
    }
    targetHit() {
      const el = $("target-flash");
      el.classList.remove("show");
      void el.offsetWidth;
      el.classList.add("show");
      this.vibrate([30, 40, 30]);
      window.setTimeout(() => el.classList.remove("show"), 1300);
    }
    runEnded() {
      window.setTimeout(() => this.overlays.showEnd(this.game.state), this.prefs.reducedMotion() ? 150 : 800);
    }

    scrollTop() {
      $("app").scrollTo({ top: 0, behavior: this.scrollMode() });
    }
    scrollTo(el, block = "start") {
      window.setTimeout(() => el.scrollIntoView({ behavior: this.scrollMode(), block }), 120);
    }
    /* A phone shows one stage at a time (phone.css), so a stage change jumps straight to its place:
       a gliding scroll can be cut short there when the screen is rebuilt under it. */
    phone() {
      return !!window.matchMedia?.("(max-width:699px),(max-height:599px) and (max-width:999px)").matches;
    }
    scrollMode() {
      return this.prefs.reducedMotion() || this.phone() ? "auto" : "smooth";
    }
    vibrate(pattern) {
      if (navigator.vibrate && this.prefs.vibration()) navigator.vibrate(pattern);
    }
    toast(message) {
      const el = $("toast");
      el.textContent = message;
      el.classList.add("show");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => el.classList.remove("show"), 1500);
    }
  }
  window.GameView = GameView;
})();
