/* Slotchinko lanes: where each kind of ball does best on the board in front of it, and what each pocket is.
   Pure. The aim hint on the board, Lou's one-line tips and the test bot all read this, so they cannot disagree.
   The numbers behind it are in docs/slotchinko/BOARDS.md (measured with tools/slotchinko-aim-map.mjs). */
(() => {
  "use strict";
  const POCKETS = 7;
  // The launcher travels between these two margins (game.js drops at margin + aim * (width - 2 * margin)).
  const MARGIN = 24;

  /* The aim (0 to 1) that drops a ball over the middle of a pocket. */
  function aimAt(pocket, width) {
    const x = ((pocket + 0.5) * width) / POCKETS;
    return Math.min(1, Math.max(0, (x - MARGIN) / (width - 2 * MARGIN)));
  }

  /* Where to aim: a list of { aim, wide }. wide means "anywhere around here" (balls that scatter).
     Heavy spades go to either edge, sticky clubs to the jackpot, hearts and diamonds to the middle. */
  function hint(suit, jackpots, width) {
    if (suit === "spade") return [{ aim: 0 }, { aim: 1 }];
    if (suit === "club") return jackpots.map(j => ({ aim: aimAt(j, width) }));
    return [{ aim: 0.5, wide: true }];
  }

  /* One plain line about a pocket, for a player who taps it. */
  function describe({ value, drain, jackpot, heavyHand, edge, spadeEdge }) {
    const times = n => `×${+n.toFixed(2)}`;
    if (edge && heavyHand) return `${times(spadeEdge)} for spades: heavy balls smash through the outer pockets.`;
    if (drain) return "Drain: a ball here scores nothing. Spades are the exception.";
    if (jackpot) return `${times(value)} jackpot: the best pocket on this board.`;
    if (value < 1) return `${times(value)}: a ball here scores less than its worth.`;
    return `${times(value)}: a ball here scores ${value === 1 ? "its normal amount" : `${+value.toFixed(2)} times over`}.`;
  }

  window.SlotchinkoLanes = { hint, aimAt, describe };
})();
