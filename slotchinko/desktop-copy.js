/* Mouse wording for the game's touch phrases. Touch screens keep the text as written. */
(() => {
  "use strict";
  const mouse=window.matchMedia?.("(hover:hover) and (pointer:fine)").matches;
  const SWAPS=[[/drag or tap the board/g,"move the mouse over the board"],[/Drag across the board/g,"Move the mouse across the board"],
    [/\btap (DROP|Drop)\b/g,"press Space"],[/Tap cards/g,"Click cards"],[/Tap a Chip/g,"Click a Chip"],[/TAP CARDS TO HOLD/g,"CLICK OR PRESS 1-5 TO HOLD"],
    [/DRAG TO AIM · PRESS DROP/g,"MOUSE TO AIM · SPACE TO DROP"]];
  const words=text=>mouse?SWAPS.reduce((t,[from,to])=>t.replace(from,to),text):text;
  /* Static labels and How to Play; bold tags inside are left in place. */
  function apply(){
    document.querySelectorAll(".micro,#aim-guide span,.howto-card li").forEach(el=>{
      el.childNodes.forEach(n=>{if(n.nodeType===3)n.nodeValue=words(n.nodeValue);});
    });
  }
  window.SlotchinkoCopy={words,apply};
})();
