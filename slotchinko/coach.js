/* Slotchinko first-hand tips: one short instruction at a time through a new player's first blind, spoken by Lou the Dealer (boss-art.js).
   Pure: tip(state, aiming) returns { n, of, text, target } or null. view.js shows it; Prefs remembers it is done. */
(() => {
  "use strict";
  const OF = 9,
    HOST = "LOU - THE DEALER";
  /* shop: { step, bought, pick } from the view. step 0 shows the coins and waits for GOT IT; then one Chip to buy
     (pick: the first one the player can afford); then the way out. target is an element id, or a CSS selector. */
  function tip(s, aiming, shop = {}) {
    if (!s || s.round !== 1 || s.victory) return null;
    const t = (n, text, target, next = false) => ({ n, of: OF, text, target, next });
    if (s.phase === "roundEnd") {
      if (!s.won) return null;
      if (!shop.step)
        return t(6, `Round won, and you got paid! Your coins are up here. You have ${s.coins}¢.`, "coins-stat", true);
      if (shop.pick && !shop.bought)
        return t(
          7,
          `This is the shop. Tap BUY on the glowing Chip. It costs ${shop.pick.cost}¢ and it's yours for the whole run.`,
          `.shop-item:has([data-buy="${shop.pick.id}"])`
        );
      return t(
        8,
        shop.bought
          ? "Nice, it's yours! Buy more if you like. When you're done, press CHOOSE YOUR PATH."
          : "Buy what you like. When you're done, press CHOOSE YOUR PATH.",
        "shop-next"
      );
    }
    if (s.phase === "drop")
      return t(
        5,
        "Each ball scores the number on its pocket. Reach the BLIND number up top to win the round.",
        "target-bar"
      );
    if (aiming)
      return t(4, "Tap the board to pick where the balls fall. Middle pays most. Then tap DROP.", "plinko-canvas");
    const max = s.handsMax || 3,
      again = (s.handsLeft || max) < max;
    // The tutorial hand (game.dealTutorialHand): two Kings showing, a third on the way.
    if (s.tutorial && !again) {
      if (s.hand === "Three of a Kind")
        return t(3, "Three Kings! That's a strong hand. Press DROP HAND.", "drop-button");
      if (!s.spins && !s.held.some(Boolean))
        return t(1, "Welcome in! See your two Kings? Tap both to keep them.", "reels");
    }
    if (s.spins >= s.maxSpins) return t(3, "Press DROP HAND. Better hands drop more balls.", "drop-button");
    if (s.spins > 0 || s.held.some(Boolean))
      return t(2, "Now press DRAW to swap the other cards. Or press DROP HAND if you like these.", "spin-button");
    return t(
      1,
      again
        ? "Not enough yet. No sweat: you get 3 hands each round. Tap the cards you want to keep."
        : "Welcome in! Tap the cards you want to keep. Matching numbers are good.",
      "reels"
    );
  }
  /* The last step lives on the Choose Your Path sheet (overlays.js): what can be picked, and what the boss box is. */
  const PATH = {
    n: 9,
    of: OF,
    text: "Last step! Tap one of the glowing boxes to pick your next round. BLIND is the simple one.",
    boss: (round, next) =>
      "The pink box is not a button. It is a warning: " +
      (next ? "your next round is" : `at blind ${round} you meet`) +
      " this boss, and the last line is the rule it plays by."
  };
  /* One-line tips after the tutorial: the first time something new is on screen, Lou says what it is, once.
     Board news comes before suit news. Each entry: when(state, rules) and text(state, rules). */
  const pct = x => Math.round((x - 1) * 100);
  const aces = s => s.cards.filter(c => c && c.rank === 14).length;
  const MOMENTS = [
    {
      id: "glitch",
      when: s => s.cards.some(c => c && c.glitch),
      text: () => "That Ace keeps changing suit. It plays as whatever suit it shows when you press Drop Hand."
    },
    {
      id: "cinco",
      when: s => aces(s) === 4 && s.spins < s.maxSpins && s.deck.some(c => c.rank === 14 || c.joker),
      text: () => "Four Aces, and a fifth is still in your deck. Hold all four and draw. Five Aces is The Cinco."
    },
    {
      id: "boss",
      when: s => !!s.boss,
      text: () => "Boss round. Its rule is in the pink box over the board. Read it before you drop."
    },
    {
      id: "moved",
      when: s => !s.boss && (s.layout === "left" || s.layout === "right"),
      text: s => `The jackpot moved to the ${s.layout} this round. Look for the gold cap and aim there.`
    },
    {
      id: "twin",
      when: s => !s.boss && s.layout === "twin",
      text: (s, r) => `Two jackpots this round, ×${r.twin} each, with gold caps. The middle pocket only pays ×1.`
    },
    {
      id: "drain",
      when: (s, r) => s.round >= r.drainRound,
      text: () => "New from here: the two outer pockets are drains. A ball that lands in one scores nothing."
    },
    {
      id: "spade",
      when: s => s.primarySuit === "spade",
      text: (s, r) => `Mostly spades: heavy balls. Aim at an edge. The outer pockets pay ×${r.spadeEdge} for them.`
    },
    {
      id: "club",
      when: s => s.primarySuit === "club",
      text: () => "Mostly clubs: sticky balls. They land where you aim, so aim at the jackpot."
    },
    {
      id: "heart",
      when: s => s.primarySuit === "heart",
      text: () => "Mostly hearts: each ball splits in two. They scatter, so aim near the middle."
    },
    {
      id: "diamond",
      when: s => s.primarySuit === "diamond",
      text: (s, r) => `Mostly diamonds: every pocket pays them ${pct(r.fortune)}% more. Aim near the middle.`
    }
  ];
  /* The tip to show now, or null. seen: ids already shown. Never during the tutorial's own blind. */
  function moment(s, seen = [], rules = {}) {
    if (!s || s.phase !== "slot" || s.round < 2 || s.victory) return null;
    const m = MOMENTS.find(x => !seen.includes(x.id) && x.when(s, rules));
    return m ? { id: m.id, text: m.text(s, rules), next: true } : null;
  }

  window.SlotchinkoCoach = { tip, moment, MOMENTS: MOMENTS.map(m => m.id), OF, HOST, PATH };
})();
