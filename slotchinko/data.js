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
    "Royal Flush":    { power:9,   balls:10, bonus:"ROYAL JACKPOT ×9" },
    // Five of a kind. Only possible once the deck holds a fifth Ace (Ace Up the Sleeve, the Ace High deck, a Joker).
    "The Cinco":      { power:12,  balls:12, bonus:"THE CINCO ×12" }
  };


  // Shop catalog. Definitions are immutable; owned items are separate instances,
  // allowing legitimate duplicate stacking for stackable Chips.
  const CHIP_CATALOG = [
    { id:"pocket-change", name:"Pocket Change", icon:"¢", rarity:"common", kind:"chip", cost:3, stackable:true, maxStack:5, family:"coin", desc:"+1 coin after each cleared blind.", effect:{coinsPerBlind:1} },
    { id:"extra-plating", name:"Extra Plating", icon:"▦", rarity:"common", kind:"chip", cost:3, stackable:true, maxStack:3, family:"bounce", desc:"+8% score. Balls bounce 8% less off pegs.", effect:{scoreMult:1.08,plating:0.08} },
    { id:"heart-reactor", name:"Heart Reactor", icon:"♥", rarity:"common", kind:"chip", cost:4, stackable:true, maxStack:2, family:"heart", desc:"Heart balls split on their first peg hit. Each copy adds +1 split.", effect:{reactor:1} },
    { id:"moss-circuit", name:"Moss Circuit", icon:"♣", rarity:"common", kind:"chip", cost:4, stackable:true, maxStack:3, family:"club", desc:"+3% score. Club balls stick 30% harder to pegs and drift less.", effect:{stickPower:0.3,scoreMult:1.03} },
    { id:"lucky-charm", name:"Lucky Charm", icon:"✧", rarity:"common", kind:"chip", cost:4, stackable:true, maxStack:4, family:"diamond", desc:"Diamond balls gain +12% bucket value.", effect:{fortune:0.12} },
    { id:"wide-launcher", name:"Wide Launcher", icon:"↔", rarity:"common", kind:"chip", cost:4, stackable:true, maxStack:3, family:"bounce", desc:"+6% score. Balls launch with a small random spread.", effect:{scoreMult:1.06,launchSpread:0.06} },
    { id:"glass-cannon", name:"Glass Cannon", icon:"◇", rarity:"uncommon", kind:"chip", cost:6, stackable:true, maxStack:2, family:"chaos", desc:"+20% score. In each drop, the first ball to hit a peg scores ×1.5.", effect:{scoreMult:1.20,glass:1} },
    { id:"black-hole", name:"Black Hole", icon:"●", rarity:"uncommon", kind:"chip", cost:7, stackable:true, maxStack:2, family:"spade", desc:"Spade balls deal +1 peg damage and gain +25% score.", effect:{spadeDamage:1,spadeScore:0.25} },
    { id:"echo-chamber", name:"Echo Chamber", icon:"◎", rarity:"uncommon", kind:"chip", cost:7, stackable:true, maxStack:2, family:"chaos", desc:"+1 ball for every hand.", effect:{extraBalls:1} },
    { id:"prism-core", name:"Prism Core", icon:"✥", rarity:"uncommon", kind:"chip", cost:7, stackable:true, maxStack:2, family:"element", desc:"Every elemental ball gets +15% score.", effect:{allElementScore:0.15} },
    { id:"magnetron", name:"Magnetron", icon:"⊛", rarity:"uncommon", kind:"chip", cost:8, stackable:true, maxStack:2, family:"spade", desc:"+10% score. Gravity wells pull 50% harder.", effect:{wellPull:0.5,scoreMult:1.10} },
    { id:"coin-press", name:"Coin Press", icon:"▣", rarity:"uncommon", kind:"chip", cost:7, stackable:true, maxStack:3, family:"coin", desc:"+1 coin per 500 points scored in a blind, up to 3 per blind. Copies multiply it.", effect:{pressCoins:1} },
    { id:"diamond-matrix", name:"Diamond Matrix", icon:"♦", rarity:"rare", kind:"chip", cost:9, stackable:true, maxStack:2, family:"diamond", desc:"Diamond balls gain +45% score. Every third peg hit by a diamond ball adds +35 points.", effect:{diamondScore:0.45,diamondBonus:1} },
    { id:"singularity", name:"Singularity", icon:"◉", rarity:"rare", kind:"chip", cost:10, stackable:true, maxStack:2, family:"spade", desc:"Spade balls gain +50% score and gravity wells pull them 100% harder.", effect:{spadeWell:1,spadeScore:0.5} },
    { id:"phoenix-heart", name:"Phoenix Heart", icon:"ღ", rarity:"rare", kind:"chip", cost:9, stackable:true, maxStack:2, family:"heart", desc:"Split balls can split once more and gain +10% score.", effect:{splitChain:1,splitBonus:0.10} },
    { id:"club-king", name:"Club King", icon:"♣", rarity:"rare", kind:"chip", cost:9, stackable:true, maxStack:2, family:"club", desc:"Club balls gain +35% score. Each club ball that hits 5+ pegs earns 1 coin.", effect:{clubScore:0.35,clubCoins:1} },
    { id:"rainbow-engine", name:"Rainbow Engine", icon:"🌈", rarity:"rare", kind:"chip", cost:10, stackable:false, maxStack:1, family:"element", desc:"Each distinct suit in your hand adds +8% score. Flushes gain another +30%.", effect:{suitDiversity:0.08,flushBonus:0.30} },
    { id:"golden-touch", name:"Golden Touch", icon:"✦", rarity:"legendary", kind:"chip", cost:14, stackable:false, maxStack:1, family:"coin", desc:"Cleared blinds pay +5 coins. All scoring gains +12%.", effect:{coinsPerBlind:5,scoreMult:1.12} },
    { id:"chaos-theory", name:"Chaos Theory", icon:"⚡", rarity:"legendary", kind:"chip", cost:15, stackable:false, maxStack:1, family:"chaos", desc:"+2 balls and +30% score. Hazard drains pay half a normal bucket.", effect:{extraBalls:2,scoreMult:1.30,drainHalf:true} },
    { id:"grinning-ace", name:"The Grinning Ace", icon:"Ⓐ", rarity:"common", kind:"chip", cost:4, stackable:false, maxStack:1, family:"coin", desc:"High Card and One Pair hands drop +2 balls.", flavor:"\"Bad hand? I've won with worse. I'm a little wild like that.\"", effect:{grinBalls:2} },
    { id:"ricochet-rig", name:"Ricochet Rig", icon:"⤨", rarity:"uncommon", kind:"chip", cost:6, stackable:true, maxStack:2, family:"bounce", desc:"+6% score. Balls bounce 12% harder off pegs.", effect:{scoreMult:1.06,bounce:0.12} },
    { id:"croupier-cut", name:"Croupier's Cut", icon:"♠", rarity:"uncommon", kind:"chip", cost:7, stackable:true, maxStack:2, family:"coin", desc:"+1 coin for each ball in the ×4 pocket, up to 3 per drop. Copies add +3 more.", effect:{croupier:1} },
    { id:"jackpot-funnel", name:"Jackpot Funnel", icon:"▼", rarity:"rare", kind:"chip", cost:10, stackable:false, maxStack:1, family:"spade", desc:"The ×4 pocket pays ×5.", effect:{funnel:1} },
    { id:"world-tree", name:"World Tree", icon:"♧", rarity:"legendary", kind:"chip", cost:15, stackable:false, maxStack:1, family:"element", desc:"+15% score on every ball, and +60% more when your hand holds all four suits.", effect:{fourSuitBonus:0.60,allElementScore:0.15} },
    { id:"loaded-die", name:"Loaded Die", icon:"⚄", rarity:"uncommon", kind:"chip", cost:7, stackable:false, maxStack:1, family:"bounce", desc:"Each drop, one random pocket pays double. Never the ×4.", effect:{loadedDie:1} },
    { id:"second-wind", name:"Second Wind", icon:"↟", rarity:"uncommon", kind:"chip", cost:6, stackable:true, maxStack:2, family:"chaos", desc:"The first ball lost to a drain each drop is dropped again. Each copy saves one more.", effect:{secondWind:1} },
    { id:"pawn-ticket", name:"Pawn Ticket", icon:"⇄", rarity:"common", kind:"chip", cost:4, stackable:false, maxStack:1, family:"coin", desc:"Your other Chips sell for the full price you paid.", effect:{pawn:1} },
    { id:"high-roller", name:"High Roller", icon:"♛", rarity:"rare", kind:"chip", cost:9, stackable:false, maxStack:1, family:"chaos", desc:"+60% score, but each blind gives you one hand fewer.", effect:{scoreMult:1.60,fewerHands:1} },
    // Step 2 suit Chips: each suit family has five, so a build is a choice between Chips, not copies of one.
    { id:"double-down", name:"Double Down", icon:"⧉", rarity:"common", kind:"chip", cost:4, stackable:true, maxStack:2, family:"heart", desc:"Split balls gain +15% score.", effect:{splitBonus:0.15} },
    { id:"hot-hand", name:"Hot Hand", icon:"♨", rarity:"uncommon", kind:"chip", cost:7, stackable:true, maxStack:2, family:"heart", desc:"Heart balls gain +30% score.", effect:{heartScore:0.30} },
    { id:"press-the-bet", name:"Press the Bet", icon:"⊕", rarity:"uncommon", kind:"chip", cost:6, stackable:false, maxStack:1, family:"heart", desc:"Heart hands drop +1 ball.", effect:{heartBalls:1} },
    { id:"card-counter", name:"Card Counter", icon:"⌗", rarity:"common", kind:"chip", cost:4, stackable:true, maxStack:2, family:"club", desc:"Club balls gain +20% score.", effect:{clubScore:0.20} },
    { id:"dead-aim", name:"Dead Aim", icon:"⌖", rarity:"uncommon", kind:"chip", cost:6, stackable:false, maxStack:1, family:"club", desc:"Club hands launch dead straight: no random spread at all.", effect:{steady:true} },
    { id:"grinder", name:"Grinder", icon:"⚙", rarity:"uncommon", kind:"chip", cost:7, stackable:false, maxStack:1, family:"club", desc:"Club balls gain +4% score for each peg they hit, up to +40%.", effect:{clubGrind:0.04} },
    { id:"fat-stack", name:"Fat Stack", icon:"≣", rarity:"common", kind:"chip", cost:4, stackable:true, maxStack:2, family:"diamond", desc:"Diamond balls gain +20% score.", effect:{diamondScore:0.20} },
    { id:"the-vig", name:"The Vig", icon:"％", rarity:"uncommon", kind:"chip", cost:7, stackable:false, maxStack:1, family:"diamond", desc:"Diamond balls gain +25% bucket value.", effect:{fortune:0.25} },
    { id:"comp", name:"Comp", icon:"✉", rarity:"uncommon", kind:"chip", cost:6, stackable:true, maxStack:2, family:"diamond", desc:"+1 coin for each diamond ball in a jackpot pocket, up to 2 per drop. Copies add +2 more.", effect:{diamondCoins:1} },
    { id:"suited-connectors", name:"Suited Connectors", icon:"⛓", rarity:"uncommon", kind:"chip", cost:6, stackable:true, maxStack:2, family:"element", desc:"Each distinct suit in your hand adds +4% score.", effect:{suitDiversity:0.04} }
  ];

  // Deck cards: bought cards change the deck for the rest of the run.
  const CARD_CATALOG = [
    { id:"ace-sleeve", name:"Ace Up the Sleeve", icon:"A", rarity:"common", kind:"card", cost:4, maxStack:3, desc:"Add an extra Ace to your deck (suits rotate ♥ ♠ ♦ ♣).", deck:"addAce" },
    { id:"trim-deck", name:"Trim the Deck", icon:"✂", rarity:"uncommon", kind:"card", cost:6, maxStack:1, desc:"Remove every 2 from your deck. Fewer junk draws.", deck:"trim" },
    { id:"gold-leaf", name:"Gold Leaf", icon:"✪", rarity:"rare", kind:"card", cost:9, maxStack:1, desc:"Upgrade your Aces to gold: each gold card in a hand adds +0.25 base power.", deck:"gold" },
    { id:"joker", name:"Joker", icon:"★", rarity:"rare", kind:"card", cost:8, maxStack:1, desc:"Add a Joker to your deck. It plays as whatever card makes your best hand.", deck:"joker" },
    { id:"glitched-ace", name:"The Glitched Ace", icon:"Ⱥ", rarity:"rare", kind:"card", cost:8, maxStack:1, desc:"Add a glitched Ace to your deck. Its suit keeps changing: it plays as the suit it shows when you press Drop Hand. In a High Card hand: +50% power and double balls.", deck:"glitch" }
  ];

  // Pachinko buffs: board changes for the next drop, or for the whole run.
  const BUFF_CATALOG = [
    { id:"rubber-pegs", name:"Rubber Pegs", icon:"◍", rarity:"common", kind:"buff", cost:3, duration:"drop", desc:"Next drop: balls bounce 25% more and score +10%.", action:"bounce", value:0.25 },
    { id:"wide-jackpot", name:"Wide Jackpot", icon:"⇿", rarity:"uncommon", kind:"buff", cost:5, duration:"drop", desc:"Next drop: the ×4 pocket is twice as wide.", action:"wide", value:1 },
    { id:"magnet-core", name:"Magnet Core", icon:"⊕", rarity:"rare", kind:"buff", cost:9, duration:"run", desc:"Whole run: a magnet under the board pulls balls toward the ×4 pocket.", effect:{magnet:1} },
    { id:"golden-peg", name:"Golden Peg", icon:"✹", rarity:"common", kind:"buff", cost:4, duration:"drop", desc:"Next drop: one random peg turns gold. A ball that hits it scores double.", action:"goldpeg", value:1 },
    { id:"mystery-pocket", name:"Mystery Pocket", icon:"?", rarity:"rare", kind:"buff", cost:8, duration:"run", desc:"Whole run: each drop one pocket is a mystery. It pays anything from ×0 to ×8, shown when the first ball lands in it.", effect:{mystery:1} },
    { id:"bumper", name:"Bumper", icon:"◈", rarity:"rare", kind:"buff", cost:7, duration:"run", desc:"Whole run: two bumpers sit above the pockets beside the ×4 and kick balls sideways. Each kick adds +25% to that ball, up to +100%.", effect:{bumper:1} }
  ];

  const CONSUMABLE_CATALOG = [
    { id:"focus-tonic", name:"Focus Tonic", icon:"◉", rarity:"common", kind:"consumable", cost:3, desc:"Next hand: +2 balls.", action:"balls", value:2 },
    { id:"power-surge", name:"Power Surge", icon:"ϟ", rarity:"common", kind:"consumable", cost:3, desc:"Next hand: +50% base power.", action:"power", value:0.5 },
    { id:"coin-flip", name:"Coin Flip", icon:"¢", rarity:"uncommon", kind:"consumable", cost:3, desc:"Gain 6 coins immediately.", action:"coins", value:6 },
    { id:"wild-card", name:"Wild Current", icon:"✧", rarity:"uncommon", kind:"consumable", cost:5, desc:"Next hand: every ball counts as all four suits.", action:"rainbow", value:1 },
    { id:"glass-charge", name:"Glass Charge", icon:"◇", rarity:"rare", kind:"consumable", cost:6, desc:"Next drop: the first ball to hit a peg scores ×6.", action:"glass", value:6 },
    { id:"spare-ball", name:"Spare Ball", icon:"•", rarity:"common", kind:"consumable", cost:2, desc:"Next hand: +1 ball.", action:"balls", value:1 },
    { id:"redeal", name:"Redeal", icon:"↺", rarity:"common", kind:"consumable", cost:3, desc:"Throw back your whole hand: five new cards and both draws back.", action:"redeal", value:1 },
    { id:"nudge", name:"Nudge", icon:"⇥", rarity:"uncommon", kind:"consumable", cost:3, desc:"Next drop: balls headed for a ×0.5 pocket or a drain get nudged one pocket inward.", action:"nudge", value:1 },
    { id:"blind-skip", name:"Blind Skip", icon:"»", rarity:"rare", kind:"consumable", cost:8, desc:"Clear this blind with no drop: it counts as cleared, pays its reward and opens the shop. Not on the final blind.", action:"skip", value:1 },
    { id:"double-nothing", name:"Double or Nothing", icon:"⚁", rarity:"rare", kind:"consumable", cost:5, desc:"Next drop scores double. If that still doesn't clear the blind, the drop counts for half instead.", action:"double", value:1 },
    { id:"tilt", name:"Tilt", icon:"⇆", rarity:"uncommon", kind:"consumable", cost:4, desc:"Next drop: a TILT button appears. Press it once to shove every ball toward the middle.", action:"tilt", value:1 }
  ];

  const RARITY_WEIGHT = { common:58, uncommon:27, rare:12, legendary:3 };
  const RARITY_ORDER = ["common","uncommon","rare","legendary"];

  // Blind score targets: the one table to tune. Every blind starts from zero, so each number is what
  // that blind alone asks for, across up to HANDS_PER_BLIND hands (checked with tools/slotchinko-sim.mjs).
  const BLIND_TARGETS=[320,700,850,1300,1600,1800,2000,2200, 2400,2700,3100,3400,4200,5300,5600,6500];
  const BALANCE={
    FINAL_BLIND:BLIND_TARGETS.length, BLIND_TARGETS,
    HANDS_PER_BLIND:3, SPARE_HAND_PAY:1, SELL_RATE:0.5, ELITE_CLIMB:1.5, START_COINS:7, BLIND_PAY:3, BASE_BALL_SCORE:25, HEART_SPLIT_HIT:3, DRAIN_ROUND:3,
    REROLL_BASE:2, SHOP_SLOTS:{chip:3,card:2,consumable:2,buff:2}, CROUPIER_CAP:3, FUNNEL_MULT:1.25, GOLD_POWER:0.25, GLITCH_POWER:1.5, GLITCH_BALLS:2, GLITCH_MS:800, SET_STEPS:[2,4,6], SET_TIERS:["REGULAR","VIP","WHALE"], SHOP_LEAN:0.5, SHOP_LEAN_CAP:4, GRIND_CAP:0.40, COMP_CAP:2, NUTS_ACES:7, MAX_CHIPS:12, MAX_BAG:3, MAX_HAND_BALLS:24,
    PRESS_STEP:500, PRESS_CAP:3, CLUB_COIN_HITS:5, DIAMOND_BONUS:35, GLASS_MULT:1.5,
    BUMP_BONUS:0.25, BUMP_CAP:4, SPADE_EDGE:4, FORTUNE_BUCKET:1.4, LAUNCH_JITTER:0.10, DIE_MULT:2, GOLD_PEG_MULT:2, MYSTERY:[[0,1],[0.5,1],[1,2],[2,3],[3,2],[5,1.5],[8,1]]
  };

  // Ascension (New Game+): win at a level to open the next. Each level raises targets and adds the next rule; rules stack.
  // The numbers were fitted with tools/slotchinko-bot.mjs so each level is a step, not a cliff (docs/slotchinko/BLINDS.md).
  const NG={ MAX:8, TARGET_STEP:0, TIGHT_MIN_COST:7, THIN_FROM:5, LEAN_FROM:5, REROLL_ADD:1, HIGH_STAKES:1.08, MODS:[
    { id:"tight-shop", name:"Tight Shop", icon:"¢", desc:"Anything priced 7¢ or more costs 1¢ extra." },
    { id:"hungry-drains", name:"Hungry Drains", icon:"▽", desc:"Drains open from blind 2." },
    { id:"thin-hands", name:"Thin Hands", icon:"•", desc:"From blind 5, the first hand of each blind drops 1 fewer ball." },
    { id:"boss-blinds", name:"Boss Teeth", icon:"☠", desc:"The four bosses play a nastier rule." },
    { id:"lean-purse", name:"Lean Purse", icon:"◌", desc:"From blind 5, cleared blinds pay 1¢ less." },
    { id:"pricey-rerolls", name:"Pricey Rerolls", icon:"↻", desc:"Rerolls cost 1¢ more." },
    { id:"short-bag", name:"Short Bag", icon:"▣", desc:"Your Bag holds 1 fewer item, and the bosses play their nastiest rules." },
    { id:"high-stakes", name:"High Stakes", icon:"♛", desc:"Every target is 8% higher." }
  ]};
  // Starting decks: House is open; the rest unlock from milestones (UNLOCKS).
  const DECKS=[
    { id:"house", name:"House Deck", icon:"♠", desc:"The standard 52. No tricks." },
    { id:"mint", name:"Mint Deck", icon:"▣", desc:"Start with a Coin Press." },
    { id:"rubber", name:"Rubber Deck", icon:"◍", desc:"Balls bounce 15% harder all run." },
    { id:"ace-high", name:"Ace-High Deck", icon:"A", desc:"Four extra Aces in the deck." },
    { id:"glass", name:"Glass Deck", icon:"◇", desc:"Score ×1.6, but Chips can shatter after a blind." },
    { id:"hoarder", name:"Hoarder Deck", icon:"▤", desc:"Bag holds 2 more. One fewer Chip per shop." },
    { id:"wild-suit", name:"Two-Tone Deck", icon:"♥♠", desc:"Suits count by colour: red with red, black with black." },
    { id:"pachinko", name:"Pachinko Deck", icon:"◎", desc:"+1 ball every hand, 20% less power." }
  ];
  // The path between blinds (chosen after the shop).
  const NODES={
    blind:{ name:"Blind", icon:"●", desc:"The next blind, straight up." },
    elite:{ name:"Elite Blind", icon:"♛", desc:"Target is 50% higher. Clear it for +6¢ and a free Rare Chip." },
    event:{ name:"Event", icon:"?", desc:"Someone at the table has an offer." },
    rest:{ name:"Lounge", icon:"☕", desc:"Catch your breath before the blind." }
  };
  // Events: two choices each. "need" is the coins a choice costs (it is disabled when short).
  const EVENTS=[
    { id:"wager", icon:"♣", name:"The Croupier's Wager", text:"\"Five coins says you can't call this flip.\"",
      options:[{ label:"Bet 5¢", detail:"Half the time, win 12¢.", need:5 },{ label:"Walk away", detail:"Nothing happens." }] },
    { id:"loaded-dice", icon:"⚂", name:"Loaded Dice", text:"A stranger offers to swap one of your Chips for something rarer.",
      options:[{ label:"Swap", detail:"Lose a random Chip, gain a random Rare Chip.", needChip:true },{ label:"Pass", detail:"Keep what you have." }] },
    { id:"wallet", icon:"¢", name:"Lost Wallet", text:"There's a fat wallet under your stool.",
      options:[{ label:"Keep it", detail:"+7¢, but this blind's target climbs 20% further." },{ label:"Hand it in", detail:"Good karma: +3 balls on your next hand." }] },
    { id:"mechanic", icon:"⚙", name:"The Peg Mechanic", text:"\"I can make these pegs sing. Small fee.\"",
      options:[{ label:"Pay 4¢", detail:"Balls bounce 8% harder for the rest of the run.", need:4 },{ label:"No thanks", detail:"Nothing happens." }] },
    { id:"sleeve", icon:"A", name:"Ace Up the Sleeve", text:"A dealer slides you a card under the table.",
      options:[{ label:"Take the Ace", detail:"Add an Ace to your deck." },{ label:"Sell it back", detail:"+3¢." }] },
    { id:"blood-moon", icon:"◑", name:"Blood Moon", text:"The lights go red. The house is feeling generous, and hungry.",
      options:[{ label:"Embrace it", detail:"Target climbs 25% further. This blind pays double." },{ label:"Look away", detail:"Nothing happens." }] }
  ];
  const LOUNGE={ id:"lounge", icon:"☕", name:"The Lounge", text:"Quiet music, soft chairs. Pick one.",
    options:[{ label:"Stretch", detail:"+3 balls on your next hand." },{ label:"Focus", detail:"+50% power on your next hand." }] };

  // Unlock pool: some items and decks start locked and open from milestones. test(summary) runs at the end of a run.
  const UNLOCKS=[
    { kind:"item", id:"diamond-matrix", hint:"Clear blind 3.", test:m=>m.blinds>=3 },
    { kind:"item", id:"croupier-cut", hint:"Earn 100¢ in one run.", test:m=>m.coinsEarned>=100 },
    { kind:"item", id:"jackpot-funnel", hint:"Score 5,000 in a single drop.", test:m=>m.bestDrop>=5000 },
    { kind:"item", id:"phoenix-heart", hint:"Drop a Full House or better.", test:m=>m.bestRank>=6 },
    { kind:"item", id:"rainbow-engine", hint:"Drop a Flush.", test:m=>(m.hands.Flush||0)>0 },
    { kind:"item", id:"singularity", hint:"End a run owning two Spades Chips.", test:m=>m.chipFamilies.filter(f=>f==="spade").length>=2 },
    { kind:"item", id:"chaos-theory", hint:"Clear blind 8.", test:m=>m.blinds>=8 },
    { kind:"item", id:"glass-charge", hint:"Drop Three of a Kind 5 times in one run.", test:m=>(m.hands["Three of a Kind"]||0)>=5 },
    { kind:"item", id:"world-tree", hint:"Win a run.", test:m=>m.victory },
    { kind:"item", id:"loaded-die", hint:"Clear 5 blinds on the first hand in one run.", test:m=>(m.firstHandClears||0)>=5 },
    { kind:"item", id:"second-wind", hint:"Clear 2 blinds on your last hand in one run.", test:m=>(m.lastHandClears||0)>=2 },
    { kind:"item", id:"pawn-ticket", hint:"Sell 5 Chips in one run.", test:m=>(m.sold||0)>=5 },
    { kind:"item", id:"high-roller", hint:"Beat a boss with a hand to spare.", test:m=>(m.bossSpare||0)>=1 },
    { kind:"item", id:"joker", hint:"Drop a Straight Flush.", test:m=>m.bestRank>=8 },
    { kind:"item", id:"mystery-pocket", hint:"Take 5 Events in one run.", test:m=>(m.events||0)>=5 },
    { kind:"item", id:"golden-peg", hint:"Earn 200¢ in one run.", test:m=>m.coinsEarned>=200 },
    { kind:"item", id:"bumper", hint:"Score 12,000 in a single drop.", test:m=>m.bestDrop>=12000 },
    { kind:"item", id:"double-nothing", hint:"Win at Ascension 1 or higher.", test:m=>m.victory&&m.ng>=1 },
    { kind:"item", id:"tilt", hint:"Win at Ascension 2 or higher.", test:m=>m.victory&&m.ng>=2 },
    // now: granted the moment it happens, with its own banner, instead of at the end of the run.
    { kind:"item", id:"glitched-ace", now:true, title:"THE CINCO", feat:"Five Aces in one hand", hint:"Drop five Aces in one hand.", test:m=>(m.hands["The Cinco"]||0)>0 },
    { kind:"deck", id:"mint", hint:"Earn 200¢ in one run.", test:m=>m.coinsEarned>=200 },
    { kind:"deck", id:"rubber", hint:"Clear blind 6.", test:m=>m.blinds>=6 },
    { kind:"deck", id:"ace-high", hint:"Drop Four of a Kind.", test:m=>m.bestRank>=7 },
    { kind:"deck", id:"hoarder", hint:"Fill your Bag.", test:m=>m.maxBag>=3 },
    { kind:"deck", id:"glass", hint:"Score 12,000 in a single drop.", test:m=>m.bestDrop>=12000 },
    { kind:"deck", id:"wild-suit", hint:"Drop 3 Flushes in one run.", test:m=>(m.hands.Flush||0)>=3 },
    { kind:"deck", id:"pachinko", hint:"Win a run.", test:m=>m.victory }
  ];
  // Collection families: a Chip joins the first family that shares one of its tags.
  // Chip families. Owning Chips of one family (copies count) pays in three steps: BALANCE.SET_STEPS Chips reach
  // BALANCE.SET_TIERS. Each step's effect uses the same keys as a Chip's (scoring.js adds them up). `build` is the
  // run's name once a family reaches VIP.
  const FAMILIES=[
    { id:"heart", name:"Hearts", icon:"♥", build:"Double Down", steps:[
      { text:"Split balls +10% score", effect:{splitBonus:0.10} },
      { text:"Split balls can split once more", effect:{splitChain:1} },
      { text:"Heart balls +40% score", effect:{heartScore:0.40} } ] },
    { id:"diamond", name:"Diamonds", icon:"♦", build:"The Juice", steps:[
      { text:"Diamond balls +10% bucket value", effect:{fortune:0.10} },
      { text:"Diamond balls +25% score", effect:{diamondScore:0.25} },
      { text:"Diamond balls +30% bucket value", effect:{fortune:0.30} } ] },
    { id:"spade", name:"Spades", icon:"♠", build:"The Whale", steps:[
      { text:"Spade balls +15% score", effect:{spadeScore:0.15} },
      { text:"Wells pull 50% harder; spade balls deal +1 peg damage", effect:{wellPull:0.5,spadeDamage:1} },
      { text:"Outer pockets pay spades ×6", effect:{spadeEdge:2} } ] },
    { id:"club", name:"Clubs", icon:"♣", build:"The Sharp", steps:[
      { text:"Club balls stick 20% harder", effect:{stickPower:0.2} },
      { text:"Club balls +25% score", effect:{clubScore:0.25} },
      { text:"Club balls +50% score", effect:{clubScore:0.50} } ] },
    { id:"coin", name:"Coin", icon:"¢", build:"Bankroll", steps:[
      { text:"+1¢ after each cleared blind", effect:{coinsPerBlind:1} },
      { text:"+2¢ more after each cleared blind", effect:{coinsPerBlind:2} },
      { text:"Everything in the shop costs 1¢ less", effect:{discount:1} } ] },
    { id:"bounce", name:"Bounce", icon:"⤨", build:"Crapshoot", steps:[
      { text:"+6% score", effect:{scoreMult:1.06} },
      { text:"+10% score", effect:{scoreMult:1.10} },
      { text:"+15% score", effect:{scoreMult:1.15} } ] },
    { id:"element", name:"Element", icon:"✥", build:"Rainbow", steps:[
      { text:"Every ball +8% score", effect:{allElementScore:0.08} },
      { text:"Each distinct suit in hand +5% score", effect:{suitDiversity:0.05} },
      { text:"+40% score when your hand holds all four suits", effect:{fourSuitBonus:0.40} } ] },
    { id:"chaos", name:"Chaos", icon:"⚡", build:"Let It Ride", steps:[
      { text:"+5% score", effect:{scoreMult:1.05} },
      { text:"One more ball per drop scores ×1.5 on its first peg", effect:{glass:1} },
      { text:"+1 ball for every hand", effect:{extraBalls:1} } ] }
  ];

  window.SlotchinkoData={NG,DECKS,NODES,EVENTS,LOUNGE,UNLOCKS,FAMILIES,BALANCE,SUITS,SUIT_GLYPHS,SUIT_NAMES,RANKS,HANDS,CHIP_CATALOG,CARD_CATALOG,BUFF_CATALOG,CONSUMABLE_CATALOG,RARITY_WEIGHT,RARITY_ORDER};
})();
