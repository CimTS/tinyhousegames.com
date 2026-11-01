/* Slotchinko data: suits, hands, shop catalog and balance constants. */
(() => {
  "use strict";
  const SUITS = ["heart", "spade", "diamond", "club"];
  const SUIT_GLYPHS = { heart:"♥", spade:"♠", diamond:"♦", club:"♣" };
  const SUIT_NAMES = { heart:"Hearts", spade:"Spades", diamond:"Diamonds", club:"Clubs" };
  const RANKS = [
    { value:2, label:"2" }, { value:3, label:"3" }, { value:4, label:"4" },
    { value:5, label:"5" }, { value:6, label:"6" }, { value:7, label:"7" },
    { value:8, label:"8" }, { value:9, label:"9" }, { value:10, label:"10" },
    { value:11, label:"J" }, { value:12, label:"Q" }, { value:13, label:"K" },
    { value:14, label:"A" }
  ];

  // Power and ball count are game-balance values, not poker rules.
  const HANDS = {
    "High Card":      { power:1,   balls:2,  bonus:"No hand bonus" },
    "One Pair":       { power:1.5, balls:3,  bonus:"×1.5 base power" },
    "Two Pair":       { power:2,   balls:4,  bonus:"×2 base power" },
    "Three of a Kind":{ power:2.5, balls:5,  bonus:"×2.5 base power" },
    "Straight":       { power:3,   balls:6,  bonus:"×3 base power" },
    "Flush":          { power:3.5, balls:6,  bonus:"×3.5 base power" },
    "Full House":     { power:4,   balls:7,  bonus:"×4 base power" },
    "Four of a Kind": { power:5,   balls:8,  bonus:"×5 base power" },
    "Straight Flush": { power:7,   balls:9,  bonus:"×7 base power" },
    "Royal Flush":    { power:9,   balls:10, bonus:"ROYAL JACKPOT ×9" }
  };


  // Shop catalog. Definitions are immutable; owned items are separate instances,
  // allowing legitimate duplicate stacking for stackable Chips.
  const CHIP_CATALOG = [
    { id:"pocket-change", name:"Pocket Change", icon:"¢", rarity:"common", kind:"chip", cost:3, stackable:true, maxStack:5, tags:["economy"], desc:"+1 coin after each cleared blind.", effect:{coinsPerBlind:1} },
    { id:"extra-plating", name:"Extra Plating", icon:"▦", rarity:"common", kind:"chip", cost:3, stackable:true, maxStack:3, tags:["defense"], desc:"+8% score. Balls bounce 8% less off pegs.", effect:{scoreMult:1.08,plating:0.08} },
    { id:"heart-reactor", name:"Heart Reactor", icon:"♥", rarity:"common", kind:"chip", cost:4, stackable:true, maxStack:2, tags:["heart","split"], desc:"Heart balls split on their first peg hit. Each copy adds +1 split.", effect:{reactor:1} },
    { id:"moss-circuit", name:"Moss Circuit", icon:"♣", rarity:"common", kind:"chip", cost:4, stackable:true, maxStack:3, tags:["club","control"], desc:"+3% score. Club balls stick 30% harder to pegs and drift less.", effect:{stickPower:0.3,scoreMult:1.03} },
    { id:"lucky-charm", name:"Lucky Charm", icon:"✧", rarity:"common", kind:"chip", cost:4, stackable:true, maxStack:4, tags:["diamond","fortune"], desc:"Diamond balls gain +12% bucket value.", effect:{fortune:0.12} },
    { id:"wide-launcher", name:"Wide Launcher", icon:"↔", rarity:"common", kind:"chip", cost:4, stackable:true, maxStack:3, tags:["launch"], desc:"+6% score. Balls launch with a small random spread.", effect:{scoreMult:1.06,launchSpread:0.06} },
    { id:"glass-cannon", name:"Glass Cannon", icon:"◇", rarity:"uncommon", kind:"chip", cost:6, stackable:true, maxStack:2, tags:["glass","risk"], desc:"+20% score. In each drop, the first ball to hit a peg scores ×1.5.", effect:{scoreMult:1.20,glass:1} },
    { id:"black-hole", name:"Black Hole", icon:"●", rarity:"uncommon", kind:"chip", cost:7, stackable:true, maxStack:2, tags:["spade","gravity"], desc:"Spade balls deal +1 peg damage and gain +25% score.", effect:{spadeDamage:1,spadeScore:0.25} },
    { id:"echo-chamber", name:"Echo Chamber", icon:"◎", rarity:"uncommon", kind:"chip", cost:7, stackable:true, maxStack:2, tags:["balls","echo"], desc:"+1 ball for every hand.", effect:{extraBalls:1} },
    { id:"prism-core", name:"Prism Core", icon:"✥", rarity:"uncommon", kind:"chip", cost:7, stackable:true, maxStack:2, tags:["element","prism"], desc:"Every elemental ball gets +15% score.", effect:{allElementScore:0.15} },
    { id:"magnetron", name:"Magnetron", icon:"⊛", rarity:"uncommon", kind:"chip", cost:8, stackable:true, maxStack:2, tags:["gravity","control"], desc:"+10% score. Gravity wells pull 50% harder.", effect:{wellPull:0.5,scoreMult:1.10} },
    { id:"coin-press", name:"Coin Press", icon:"▣", rarity:"uncommon", kind:"chip", cost:7, stackable:true, maxStack:3, tags:["economy","combo"], desc:"+1 coin per 500 points scored in a blind, up to 3 per blind. Copies multiply it.", effect:{pressCoins:1} },
    { id:"diamond-matrix", name:"Diamond Matrix", icon:"♦", rarity:"rare", kind:"chip", cost:9, stackable:true, maxStack:2, tags:["diamond","fortune","combo"], desc:"Diamond balls gain +45% score. Every third peg hit by a diamond ball adds +35 points.", effect:{diamondScore:0.45,diamondBonus:1} },
    { id:"singularity", name:"Singularity", icon:"◉", rarity:"rare", kind:"chip", cost:10, stackable:true, maxStack:2, tags:["gravity","spade"], desc:"Spade balls gain +50% score and gravity wells pull them 100% harder.", effect:{spadeWell:1,spadeScore:0.5} },
    { id:"phoenix-heart", name:"Phoenix Heart", icon:"ღ", rarity:"rare", kind:"chip", cost:9, stackable:true, maxStack:2, tags:["heart","split","survival"], desc:"Split balls can split once more and gain +10% score.", effect:{splitChain:1,splitBonus:0.10} },
    { id:"club-king", name:"Club King", icon:"♣", rarity:"rare", kind:"chip", cost:9, stackable:true, maxStack:2, tags:["club","control","economy"], desc:"Club balls gain +35% score. Each club ball that hits 5+ pegs earns 1 coin.", effect:{clubScore:0.35,clubCoins:1} },
    { id:"rainbow-engine", name:"Rainbow Engine", icon:"🌈", rarity:"rare", kind:"chip", cost:10, stackable:false, maxStack:1, tags:["element","synergy"], desc:"Each distinct suit in your hand adds +8% score. Flushes gain another +30%.", effect:{suitDiversity:0.08,flushBonus:0.30} },
    { id:"golden-touch", name:"Golden Touch", icon:"✦", rarity:"legendary", kind:"chip", cost:14, stackable:false, maxStack:1, tags:["economy","legendary"], desc:"Cleared blinds pay +5 coins. All scoring gains +12%.", effect:{coinsPerBlind:5,scoreMult:1.12} },
    { id:"chaos-theory", name:"Chaos Theory", icon:"⚡", rarity:"legendary", kind:"chip", cost:15, stackable:false, maxStack:1, tags:["balls","risk","legendary"], desc:"+2 balls and +30% score. Hazard drains pay half a normal bucket.", effect:{extraBalls:2,scoreMult:1.30,drainHalf:true} },
    { id:"world-tree", name:"World Tree", icon:"♧", rarity:"legendary", kind:"chip", cost:15, stackable:false, maxStack:1, tags:["element","synergy","legendary"], desc:"+15% score on every ball, and +60% more when your hand holds all four suits.", effect:{fourSuitBonus:0.60,allElementScore:0.15} }
  ];

  const CONSUMABLE_CATALOG = [
    { id:"focus-tonic", name:"Focus Tonic", icon:"◉", rarity:"common", kind:"consumable", cost:3, desc:"Next hand: +2 balls.", action:"balls", value:2 },
    { id:"power-surge", name:"Power Surge", icon:"ϟ", rarity:"common", kind:"consumable", cost:3, desc:"Next hand: +50% base power.", action:"power", value:0.5 },
    { id:"coin-flip", name:"Coin Flip", icon:"¢", rarity:"uncommon", kind:"consumable", cost:3, desc:"Gain 6 coins immediately.", action:"coins", value:6 },
    { id:"wild-card", name:"Wild Current", icon:"✧", rarity:"uncommon", kind:"consumable", cost:5, desc:"Next hand: every ball counts as all four suits.", action:"rainbow", value:1 },
    { id:"glass-charge", name:"Glass Charge", icon:"◇", rarity:"rare", kind:"consumable", cost:6, desc:"Next drop: the first ball to hit a peg scores ×6.", action:"glass", value:6 },
    { id:"blind-skip", name:"Blind Skip", icon:"»", rarity:"rare", kind:"consumable", cost:8, desc:"Clear this blind with no drop: it counts as cleared, pays its reward and opens the shop. Not on the final blind.", action:"skip", value:1 }
  ];

  const RARITY_WEIGHT = { common:58, uncommon:27, rare:12, legendary:3 };
  const RARITY_ORDER = ["common","uncommon","rare","legendary"];

  // Tuned with tools/balance.js; reasoning is in NOTES.md.
  const BALANCE={
    FINAL_BLIND:8, BLIND_TARGETS:[45,170,420,850,1500,2700,4800,8500],
    START_COINS:7, BLIND_PAY:3, BASE_BALL_SCORE:25, HEART_SPLIT_HIT:3, DRAIN_ROUND:3,
    REROLL_BASE:2, MAX_CHIPS:12, MAX_BAG:3, MAX_HAND_BALLS:24,
    PRESS_STEP:500, PRESS_CAP:3, CLUB_COIN_HITS:5, DIAMOND_BONUS:35, GLASS_MULT:1.5
  };

  window.SlotchinkoData={BALANCE,SUITS,SUIT_GLYPHS,SUIT_NAMES,RANKS,HANDS,CHIP_CATALOG,CONSUMABLE_CATALOG,RARITY_WEIGHT,RARITY_ORDER};
})();
