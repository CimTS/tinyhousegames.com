/* Slotchinko poker: deck and standard five-card evaluator. */
(() => {
  "use strict";
  const { SUITS, RANKS, HANDS } = window.SlotchinkoData;

  function shuffle(array, random) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function createDeck(random = Math.random) {
    const deck = [];
    for (const suit of SUITS)
      for (const rank of RANKS) {
        deck.push({ id: `${rank.value}-${suit}`, rank: rank.value, label: rank.label, suit });
      }
    return shuffle(deck, random);
  }

  function compareVectors(a, b) {
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i++) {
      const diff = (a[i] || 0) - (b[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  // Returns a standard five-card poker result. tiebreak is ordered exactly
  // as poker requires: category first, then rank/kicker vectors.
  function evaluatePokerHand(cards) {
    if (!Array.isArray(cards) || cards.length !== 5 || cards.some(c => !c)) {
      throw new Error("Poker evaluation requires exactly five cards.");
    }
    const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
    const counts = new Map();
    ranks.forEach(r => counts.set(r, (counts.get(r) || 0) + 1));
    const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const flush = cards.every(c => c.suit === cards[0].suit);
    const unique = [...new Set(ranks)].sort((a, b) => b - a);
    let straightHigh = 0;
    if (unique.length === 5) {
      if (unique[0] - unique[4] === 4) straightHigh = unique[0];
      // Ace-low wheel: A-2-3-4-5, with five high.
      else if (unique.join(",") === "14,5,4,3,2") straightHigh = 5;
    }

    let name,
      category,
      tiebreak = [];
    if (flush && straightHigh === 14 && unique[1] === 13) {
      name = "Royal Flush";
      category = 9;
      tiebreak = [14];
    } else if (flush && straightHigh) {
      name = "Straight Flush";
      category = 8;
      tiebreak = [straightHigh];
    } else if (groups[0][1] === 4) {
      name = "Four of a Kind";
      category = 7;
      tiebreak = [groups[0][0], groups[1][0]];
    } else if (groups[0][1] === 3 && groups[1][1] === 2) {
      name = "Full House";
      category = 6;
      tiebreak = [groups[0][0], groups[1][0]];
    } else if (flush) {
      name = "Flush";
      category = 5;
      tiebreak = ranks;
    } else if (straightHigh) {
      name = "Straight";
      category = 4;
      tiebreak = [straightHigh];
    } else if (groups[0][1] === 3) {
      name = "Three of a Kind";
      category = 3;
      tiebreak = [
        groups[0][0],
        ...groups
          .slice(1)
          .map(g => g[0])
          .sort((a, b) => b - a)
      ];
    } else if (groups[0][1] === 2 && groups[1][1] === 2) {
      name = "Two Pair";
      category = 2;
      const pairs = groups
        .filter(g => g[1] === 2)
        .map(g => g[0])
        .sort((a, b) => b - a);
      tiebreak = [...pairs, groups.find(g => g[1] === 1)[0]];
    } else if (groups[0][1] === 2) {
      name = "One Pair";
      category = 1;
      tiebreak = [
        groups[0][0],
        ...groups
          .filter(g => g[1] === 1)
          .map(g => g[0])
          .sort((a, b) => b - a)
      ];
    } else {
      name = "High Card";
      category = 0;
      tiebreak = ranks;
    }

    const data = HANDS[name];
    return {
      name,
      category,
      tiebreak,
      power: data.power,
      balls: data.balls,
      bonus: data.bonus,
      flush,
      straightHigh,
      description: describeHand(name, tiebreak)
    };
  }

  function describeHand(name, vector) {
    const rankName = v => ({ 14: "Ace", 13: "King", 12: "Queen", 11: "Jack" })[v] || String(v);
    if (name === "Royal Flush") return "A-K-Q-J-10 · same suit";
    if (name === "Straight Flush") return `${rankName(vector[0])}-high · same suit`;
    if (name === "Straight") return `${rankName(vector[0])}-high straight`;
    if (name === "Four of a Kind") return `Four ${rankName(vector[0])}s`;
    if (name === "Full House") return `${rankName(vector[0])}s full of ${rankName(vector[1])}s`;
    if (name === "Three of a Kind") return `Three ${rankName(vector[0])}s`;
    if (name === "Two Pair") return `${rankName(vector[0])}s and ${rankName(vector[1])}s`;
    if (name === "One Pair") return `Pair of ${rankName(vector[0])}s`;
    if (name === "Flush") return "Five cards · same suit";
    return `${rankName(vector[0])} high`;
  }

  window.SlotchinkoPoker = { createDeck, evaluatePokerHand, HANDS, SUITS };
})();
