/* Slotchinko status banner: the label and the one-line hint under the counters, for every phase of a run.
   Pure: banner(state, aiming, handsPerBlind) returns { label, message }. view.js shows it. */
(() => {
  "use strict";

  function banner(s, aiming, handsPerBlind = 3) {
    if (s.phase === "slot") {
      if (aiming) return { label: "AIM YOUR DROP", message: "Aim: drag or tap the board, then tap DROP to release." };
      const need = Math.max(0, s.target - s.score).toLocaleString("en-US");
      const hands = s.handsMax || handsPerBlind;
      const handNumber = hands - (s.handsLeft || hands) + 1;
      // The full how-to line shows on the very first hand only; after that the hint is just what is still needed.
      if (s.round === 1 && handNumber === 1) {
        return {
          label: "PREPARE YOUR HAND",
          message: `You need ${need} more points. Tap cards to hold, draw up to twice, press Drop Hand to aim, then tap Drop.`
        };
      }
      const last = handNumber >= hands && hands > 1 ? "Last hand. " : "";
      return { label: "PREPARE YOUR HAND", message: `${last}You need ${need} more points.` };
    }
    if (s.phase === "drop") {
      return {
        label: "THE DROP IS LIVE",
        message: "Watch the balls fall. Drag across the board to aim the next ball."
      };
    }
    if (s.victory) return { label: "YOU WIN", message: "Every blind beaten." };
    if (s.phase === "roundEnd" && s.won) {
      return {
        label: "BLIND CLEARED",
        message: "Buy Chips and consumables, reroll if needed, then enter the next blind."
      };
    }
    return { label: "RUN OVER", message: "Your score fell short of the blind." };
  }

  window.SlotchinkoStatus = { banner };
})();
