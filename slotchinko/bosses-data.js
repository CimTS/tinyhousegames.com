/* Slotchinko Boss Circuit: who guards blinds 4, 8, 12 and 16, their rules per Ascension tier
   (tier 0 below A4, tier 1 at A4-6, tier 2 from A7) and the trophy each one leaves behind. */
(() => {
  "use strict";
  const D=window.SlotchinkoData;
  D.BOSSES=[
    { id:"sonny", round:4, name:"Sonny the Shark", icon:"♥", tagline:"The sharpest dresser in the Atlantic", ruleName:"HEARTBREAK",
      rules:["♥ HEART BALLS SCORE 0 · OTHER SUITS +25%","♥ HEART BALLS SCORE 0 · OTHER SUITS +25% · FIRST CARD IS A ♥","♥ HEART BALLS SCORE 0 · OTHER SUITS +25% · FIRST CARD IS A ♥ · EACH ♥ CUTS THE NEXT BALL 10%"],
      hint:"Each ball takes its suit from your cards, left to right.",
      line:"Nice hand. Shame about the hearts.", winLine:"Fine. But this suit was dry-clean only.",
      trophy:{ id:"shark-tooth", name:"Shark Tooth", rarity:"rare", desc:"+5% score per distinct suit in hand.", effect:{suitDiversity:0.05} } },
    { id:"undertow", round:8, name:"DJ Undertow", icon:"♫", tagline:"The tide sets the beat", ruleName:"SWITCH THE BEAT",
      rules:["LEFT AND RIGHT POCKETS SWAP EVERY 3 BALLS","POCKETS SWAP EVERY 3 BALLS · THE CENTRE SWAPS TOO","POCKETS SWAP EVERY BALL · THE CENTRE SWAPS TOO"],
      hint:"Watch the pockets and aim for the strong side.",
      line:"Don't fight the rhythm.", winLine:"Okay, okay. You caught the wave.",
      trophy:{ id:"undertow", name:"Undertow Frequency", rarity:"uncommon", desc:"+0.25× on the first pocket hit each hand.", effect:{firstBucket:0.25} } },
    { id:"mirror", round:12, name:"The Mirror Dealer", icon:"◈", tagline:"Everything once. Nothing twice.", ruleName:"NO DOUBLE DIPPING",
      rules:["YOUR MOST-OWNED CHIP WORKS ONLY ONCE","YOUR TOP 2 CHIPS WORK ONLY ONCE","YOUR TOP 3 CHIPS WORK ONLY ONCE"],
      hint:"Extra copies do nothing this blind.",
      line:"I see you've been repeating yourself.", winLine:"Funny. I didn't see that coming.",
      trophy:{ id:"mirror-shard", name:"Mirror Shard", rarity:"rare", desc:"The first Chip bonus each hand repeats 25%.", effect:{firstChipRepeat:0.25} } },
    { id:"house", round:16, name:"The House", icon:"♛", tagline:"The house always wins. Unless you brought a better house.", ruleName:"THREE SHIELDS",
      rules:["3 SHIELDS · EACH SET BREAKS ONE · ×0.4 ×0.6 ×0.8 · ALL BROKEN ×2","4 SHIELDS · EACH SET BREAKS ONE · ×0.25 ×0.5 ×0.75 ×1 · ALL BROKEN ×2","4 SHIELDS · ×0.25 ×0.5 ×0.75 ×1 · ALL BROKEN ×2 · TARGET CLIMBS 50% FURTHER"],
      hint:"Bring sets. Every set breaks a shield.",
      line:"You've had your fun. Now let's settle up.", winLine:"Snacks are on the house. All of them, apparently.",
      trophy:{ id:"house-key", name:"House Key", rarity:"legendary", desc:"+0.1× to pocket values per active set.", effect:{keyPerSet:0.1} } }
  ];
  D.BOSS_TUNE={
    HEART_SUIT_BONUS:1.25, HEART_NEXT_CUT:0.9, BEAT_BALLS:3,
    // Undertow's board leans to one side, because a swap on the mirrored normal board would change nothing.
    TIDE_POCKETS:[0.5,2,3,4,1,0.5,0.5], NORMAL_POCKETS:[0.5,1,2,4,2,1,0.5],
    SHIELDS:[[0.4,0.6,0.8,2],[0.25,0.5,0.75,1,2],[0.25,0.5,0.75,1,2]], FINAL_CLIMB:1.5
  };
})();
