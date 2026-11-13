/* Keyboard play. With no overlay up keys drive the game; overlays get arrows, number picks and Esc. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const BACK = {
    "howto-screen": "howto-close",
    "settings-screen": "settings-close",
    "pause-screen": "pause-resume",
    "collection-screen": "collection-close",
    "loadout-screen": "loadout-close",
    "deck-screen": "deck-back",
    "path-screen": "path-back"
  };
  const PICKS = "[data-path],[data-event],[data-deck]",
    NAV = "button,a[href]",
    STEP = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
  const digit = k => (k.length === 1 && k >= "1" && k <= "9" ? Number(k) - 1 : -1);

  function overlayKey(e, overlays) {
    const id = overlays.open,
      root = $(id),
      k = e.key,
      step = STEP[k];
    if (step) {
      if (e.target.matches?.("input")) return;
      // Loadout: up and down scroll the list; left and right step through its buttons below.
      if (id === "loadout-screen" && (k === "ArrowUp" || k === "ArrowDown")) {
        $("loadout-body").scrollBy?.({ top: (k === "ArrowUp" ? -1 : 1) * 120 });
        e.preventDefault();
        return;
      }
      if (id === "collection-screen") {
        $("collection-body").scrollBy?.({ top: (k === "ArrowUp" ? -1 : k === "ArrowDown" ? 1 : 0) * 120 });
        e.preventDefault();
        return;
      }
      const list = [...root.querySelectorAll(NAV)].filter(b => !b.disabled && b.offsetParent !== null);
      if (list.length < 2) return;
      const at = list.indexOf(e.target);
      list[at < 0 && step < 0 ? list.length - 1 : (at + step + list.length) % list.length].focus();
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    if (k === "Escape") {
      if (BACK[id]) $(BACK[id]).click();
    } else if (digit(k) >= 0) root.querySelectorAll(PICKS)[digit(k)]?.click();
  }

  function playKey(e, game, overlays) {
    const s = game.state,
      k = e.key,
      shop = s.phase === "roundEnd" && s.won && !s.victory;
    if (k === "ArrowLeft" || k === "ArrowRight") {
      s.aim = Math.max(0, Math.min(1, s.aim + (k === "ArrowLeft" ? -0.05 : 0.05)));
      game.view.renderAim();
      e.preventDefault();
      return;
    }
    if (e.repeat) return; // holding Space must not aim and drop in one press
    if (k === "Escape") overlays.showPause();
    else if (digit(k) >= 0) {
      if (shop) document.querySelectorAll("[data-buy]")[digit(k)]?.click();
      else if (digit(k) < 5) game.toggleHold(digit(k));
    } else if (k === "d" || k === "D") game.spin();
    else if (k === "t" || k === "T") game.tilt();
    else if ((k === "r" || k === "R") && shop) $("reroll-shop")?.click();
    else if ((k === "Enter" || k === " ") && !e.target.closest?.("button,a")) {
      $("drop-button").click();
      e.preventDefault();
    }
  }

  function bind(game, overlays) {
    window.addEventListener("keydown", e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // Ctrl+R, Alt+Left and friends stay the browser's
      if (overlays.open) overlayKey(e, overlays);
      else playKey(e, game, overlays);
    });
    // A mouse click leaves focus on the button, where Space would press it again instead of playing.
    // Capture phase: the last Draw disables its own button, and the event never bubbles out of that.
    window.addEventListener(
      "click",
      e => {
        if (e.detail > 0) e.target.closest?.("button")?.blur();
      },
      true
    );
  }
  window.SlotchinkoKeys = { bind };
})();
