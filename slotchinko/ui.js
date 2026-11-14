/* DOM event wiring and the fixed-step loop. Game rules live in game.js. */
(() => {
  "use strict";
  const RELEASE = "0.1"; // shown with the build code: V0.1.<build>
  const STEP_MS = 1000 / 60,
    MAX_FRAME_MS = 50;
  const $ = id => document.getElementById(id);

  function bindAim(game, canvas) {
    let active = false,
      startedFromSlot = false,
      downAt = null;
    const setAim = e => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      game.state.aim = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      game.view.renderAim();
    };
    canvas.addEventListener("pointerdown", e => {
      if (game.state.phase !== "slot" && game.state.phase !== "drop") return;
      active = true;
      startedFromSlot = game.state.phase === "slot";
      downAt = { x: e.clientX, y: e.clientY };
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      if (e.cancelable) e.preventDefault();
      setAim(e);
    });
    canvas.addEventListener("pointermove", e => {
      const hover = e.pointerType === "mouse" && (game.aimFlow.aiming || game.state.phase === "drop"); // a mouse aims without a button held
      if (!active && !hover) return;
      if (e.cancelable) e.preventDefault();
      setAim(e);
    });
    canvas.addEventListener("pointerup", e => {
      if (!active) return;
      if (e.cancelable) e.preventDefault();
      setAim(e);
      // A tap (not a drag) on a pocket also says what that pocket is.
      const tap = downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8;
      if (tap) game.view.pocketTapped(e, canvas);
      active = false;
      startedFromSlot = false;
      downAt = null;
      game.aimFlow.boardRelease();
      game.view.render(game); // releasing only sets the aim; DROP confirms
    });
    const cancel = () => {
      active = false;
      startedFromSlot = false;
    };
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("lostpointercapture", cancel);
  }

  window.addEventListener("DOMContentLoaded", () => {
    const prefs = new window.SlotchinkoPrefs(),
      overlays = new window.SlotchinkoOverlays(prefs);
    const { urlSeed, freshSeed } = window.SlotchinkoRNG;
    const nextSeed = () => urlSeed() ?? freshSeed();
    const view = new window.GameView(prefs, overlays);
    const game = new window.SlotchinkoGame({ view, seed: nextSeed(), locked: prefs.locked() });
    window.slotchinko = game;
    game.aimFlow = window.SlotchinkoAimFlow.create(game);
    const canvas = $("game-canvas"),
      board = new window.BoardView(
        canvas,
        () => game.physics,
        () => prefs.reducedMotion()
      );
    view.attach(game, board);
    game.render();
    window.SlotchinkoBossView.bind(view, game);

    document.querySelectorAll(".reel").forEach(reel => {
      reel.addEventListener("click", () => game.toggleHold(Number(reel.dataset.index)));
    });
    $("spin-button").addEventListener("click", () => game.spin());
    $("drop-button").addEventListener("click", () => {
      if (game.state.phase === "slot") {
        game.aimFlow.press();
        game.view.render(game);
      } else overlays.showPath(game);
    });
    $("shop-content").addEventListener("click", e => {
      const buy = e.target.closest("[data-buy]");
      if (buy) game.purchase(buy.dataset.buy);
      else if (e.target.closest("#reroll-shop")) game.rerollShop();
      else if (e.target.closest("#shop-next")) overlays.showPath(game);
      else if (e.target.closest("[data-open-loadout]")) overlays.showLoadout(game);
      else if (e.target.closest("[data-tab]")) view.setShopTab(e.target.closest("[data-tab]").dataset.tab);
    });
    $("consumable-bag").addEventListener("click", e => {
      const use = e.target.closest("[data-use]");
      if (use && !use.disabled) game.useConsumable(use.dataset.use);
    });
    $("owned-chips").addEventListener("click", e => {
      const info = e.target.closest("[data-info]");
      if (info) view.toggleChip(info.dataset.info);
    });
    // The build code, so two devices can be compared at a glance.
    document.querySelectorAll("[data-build]").forEach(el => {
      el.textContent = window.SLOTCHINKO_BUILD ? `V${RELEASE}.${window.SLOTCHINKO_BUILD}` : `V${RELEASE}`;
    });
    $("aim-back").addEventListener("click", () => {
      game.aimFlow.cancel();
      game.render();
    });
    $("tilt-button").addEventListener("pointerdown", e => e.stopPropagation()); // the board under it takes drags to aim
    $("tilt-button").addEventListener("click", () => game.tilt());
    // HIDE TIPS ends the tutorial, or, on a one-line tip later in the run, switches those off (Settings has the switch).
    $("coach-skip").addEventListener("click", () => {
      if (view.momentId) prefs.setTips(false);
      else prefs.coachDone();
      game.render();
    });
    // GOT IT moves the shop tutorial on, or marks a one-line tip as read.
    $("coach-next").addEventListener("click", () => {
      if (view.coachShop) view.coachShop.step = 1;
      else if (view.momentId) prefs.tipSeen(view.momentId);
      game.render();
    });
    $("feat").addEventListener("click", () => view.closeFeat());
    $("end-unlock-list").addEventListener("click", e => {
      const b = e.target.closest("[data-unlock]");
      if (b) overlays.toggleUnlock(b.dataset.unlock);
    });
    $("tips-toggle").addEventListener("change", e => {
      prefs.setTips(e.target.checked);
      game.render();
    });
    $("loadout-open").addEventListener("click", () => overlays.showLoadout(game));
    $("loadout-close").addEventListener("click", () => overlays.closeLoadout());
    $("loadout-body").addEventListener("click", e => {
      const sell = e.target.closest("[data-sell]");
      if (!sell) return;
      const body = $("loadout-body"),
        top = body.scrollTop;
      game.sellChip(sell.dataset.sell);
      overlays.showLoadout(game);
      body.scrollTop = top;
    });
    $("chip-detail").addEventListener("click", e => {
      const sell = e.target.closest("[data-sell]");
      if (sell) game.sellChip(sell.dataset.sell);
    });
    game.autosave = true;
    const save = window.SlotchinkoSave;
    const newRun = (opts = {}) => {
      save.clear();
      game.newRun(nextSeed(), { ng: opts.ng ?? 0, deckId: opts.deckId ?? "house", locked: prefs.locked() });
      if (prefs.coachOn()) game.dealTutorialHand();
      overlays.hide();
    };
    // NEW RUN: straight in until decks unlock, then the deck select.
    const hasChoice = () =>
      prefs.data.ngUnlocked > 0 || window.SlotchinkoData.DECKS.some(k => k.id !== "house" && prefs.deckOpen(k.id));
    $("play-button").addEventListener("click", () => (hasChoice() ? overlays.showDecks() : newRun()));
    // TUTORIAL: a fresh run on the House Deck with Lou's tips on, whoever is playing.
    $("title-tutorial").addEventListener("click", () => {
      prefs.coachStart();
      newRun();
    });
    $("title-collection").addEventListener("click", () => overlays.showCollection());
    $("collection-close").addEventListener("click", () => overlays.showTitle());
    // The path between blinds, and event cards.
    $("path-boss").addEventListener("click", () => overlays.bossNudge(game));
    $("path-list").addEventListener("click", e => {
      const b = e.target.closest("[data-path]");
      if (!b) return;
      game.choosePath(Number(b.dataset.path));
      if (game.state.event) overlays.showEvent(game);
      else overlays.hide();
    });
    $("path-back").addEventListener("click", () => overlays.hide());
    $("event-options").addEventListener("click", e => {
      const b = e.target.closest("[data-event]");
      if (!b || b.disabled) return;
      game.resolveEvent(Number(b.dataset.event));
      if (!game.state.event) overlays.hide();
    });
    $("continue-button").addEventListener("click", () => {
      const d = save.read();
      if (d) {
        save.restore(game, d);
        // A run saved by an older build does not know about unlocks added since; keep those locked.
        game.state.locked = [...new Set([...(game.state.locked || []), ...prefs.locked()])];
      }
      if (game.state.event) overlays.showEvent(game);
      else overlays.hide();
    });
    $("deck-list").addEventListener("click", e => {
      const b = e.target.closest("[data-deck]");
      if (b && !b.disabled) {
        overlays.deckPick = b.dataset.deck;
        overlays.showDecks();
      }
    });
    $("ng-down").addEventListener("click", () => {
      overlays.ngPick = Math.max(0, (overlays.ngPick || 0) - 1);
      overlays.showDecks();
    });
    $("ng-up").addEventListener("click", () => {
      overlays.ngPick = Math.min(prefs.data.ngUnlocked || 0, (overlays.ngPick || 0) + 1);
      overlays.showDecks();
    });
    $("deck-start").addEventListener("click", () =>
      newRun({ ng: overlays.ngPick || 0, deckId: overlays.deckPick || "house" })
    );
    $("deck-back").addEventListener("click", () => overlays.showTitle());
    $("ng-button").addEventListener("click", () => {
      overlays.ngPick = Math.min(prefs.data.ngUnlocked || 0, (game.state.ng || 0) + 1);
      overlays.deckPick = game.state.deckId || "house";
      overlays.showDecks();
    });
    $("deck-button").addEventListener("click", () => {
      overlays.ngPick = game.state.ng || 0;
      overlays.deckPick = game.state.deckId || "house";
      overlays.showDecks();
    });
    // Clear save data (settings panel), with a confirm step.
    const confirmBox = $("clear-confirm");
    $("clear-save").addEventListener("click", () => {
      confirmBox.hidden = false;
      $("clear-save").hidden = true;
    });
    const closeConfirm = () => {
      confirmBox.hidden = true;
      $("clear-save").hidden = false;
      $("clear-settings").checked = false;
    };
    $("clear-cancel").addEventListener("click", closeConfirm);
    $("clear-yes").addEventListener("click", () => {
      save.clear();
      prefs.reset();
      if ($("clear-settings").checked) {
        try {
          ["slotchinko-audio", "slotchinko-muted"].forEach(k => localStorage.removeItem(k));
        } catch {
          /* ignore */
        }
        window.SlotchinkoSound?.setVolume?.("music", 1);
        window.SlotchinkoSound?.setVolume?.("sfx", 1);
        window.SlotchinkoSound?.setMuted?.(false);
      }
      closeConfirm();
      view.toast("SAVE DATA CLEARED");
    });
    $("title-howto").addEventListener("click", () => overlays.showHowTo());
    $("help-button").addEventListener("click", () => overlays.showHowTo());
    $("settings-button").addEventListener("click", () =>
      overlays.open === "settings-screen" ? overlays.closeSettings() : overlays.showSettings()
    );
    $("title-settings").addEventListener("click", () => overlays.showSettings());
    $("settings-close").addEventListener("click", () => overlays.closeSettings());
    $("settings-screen").addEventListener("click", e => {
      if (e.target.id === "settings-screen") overlays.closeSettings();
    });
    $("howto-close").addEventListener("click", () => overlays.closeHowTo());
    $("restart-button").addEventListener("click", () =>
      newRun({ ng: game.state.ng || 0, deckId: game.state.deckId || "house" })
    );
    $("pause-resume").addEventListener("click", () => overlays.hide());
    $("motion-toggle").addEventListener("change", e => prefs.setReduced(e.target.checked));
    document.addEventListener("contextmenu", e => e.preventDefault());
    bindAim(game, canvas);
    window.SlotchinkoKeys.bind(game, overlays);
    window.SlotchinkoCopy.apply();

    // The sim only ticks while visible and with no overlay up, so a hidden tab holds still.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && game.state.phase === "drop") overlays.showPause();
    });
    let last = 0,
      bank = 0,
      glitch = 0;
    const frame = now => {
      if (!overlays.pausing && !document.hidden) {
        // The Glitched Ace changes suit while the hand is being chosen; Drop Hand (aiming) freezes it.
        glitch = game.aimFlow.aiming ? 0 : glitch + Math.min(now - last, MAX_FRAME_MS);
        if (glitch >= window.SlotchinkoData.BALANCE.GLITCH_MS) {
          glitch = 0;
          if (game.glitchTick()) game.render();
        }
        bank += Math.min(now - last, MAX_FRAME_MS);
        while (bank >= STEP_MS) {
          game.step();
          bank -= STEP_MS;
        }
      }
      last = now;
      board.draw();
      window.requestAnimationFrame(frame);
    };
    window.requestAnimationFrame(t => {
      last = t;
      frame(t);
    });
    overlays.showTitle();
  });
})();
// Offline play and install: a service worker for this folder only (same-origin cache, see sw.js).
// When a newer copy of the game takes over while this page is open, the title screen and Settings offer a
// reload. It is only ever offered: the page never reloads on its own, so a run is never interrupted.
window.SlotchinkoUpdate = {
  ready() {
    document.querySelectorAll("[data-update]").forEach(b => {
      b.hidden = false;
      b.onclick = () => location.reload();
    });
  }
};
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  const had = !!navigator.serviceWorker.controller; // a first visit has no older copy to replace
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (had) window.SlotchinkoUpdate.ready();
  });
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {}));
}
