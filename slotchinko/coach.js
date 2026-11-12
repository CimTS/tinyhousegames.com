/* Slotchinko first-hand tips: one short instruction at a time through a new player's first blind.
   Pure: tip(state, aiming) returns { n, of, text, target } or null. view.js shows it; Prefs remembers it is done. */
(() => {
  "use strict";
  const OF=6;
  function tip(s,aiming){
    if(!s||s.round!==1||s.victory)return null;
    const t=(n,text,target)=>({n,of:OF,text,target});
    if(s.phase==="roundEnd")return s.won?t(6,"Round won! Coins buy Chips. Chips make every drop score more. Then press CHOOSE YOUR PATH.","shop-content"):null;
    if(s.phase==="drop")return t(5,"Each ball scores the number on the pocket it lands in. Reach the BLIND number to win the round.","target-bar");
    if(aiming)return t(4,"Tap the board to pick where the balls fall. Middle pays most. Then tap DROP.","plinko-canvas");
    const max=s.handsMax||3,again=(s.handsLeft||max)<max;
    if(s.spins>=s.maxSpins)return t(3,"Press DROP HAND. Better hands drop more balls.","drop-button");
    if(s.spins>0||s.held.some(Boolean))return t(2,"Press DRAW to swap the other cards. Or press DROP HAND if you like these.","spin-button");
    return t(1,again?"Not enough yet. You get 3 hands each round. Tap the cards you want to keep.":"Tap the cards you want to keep. Matching numbers are good.","reels");
  }
  window.SlotchinkoCoach={tip,OF};
})();
