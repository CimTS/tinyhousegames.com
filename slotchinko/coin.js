/* Slotchinko coin: every "¢" the game writes on screen is shown as the coin icon (drawn by John: a yin-yang coin).
   The game's text stays plain "¢", so logic, saves and screen-reader labels are untouched; this only swaps what is drawn.
   One observer covers every screen, toast and pop-up, including text written later. */
(() => {
  "use strict";
  const SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path fill="currentColor" stroke="none" fill-rule="evenodd" d="M12 3A9 9 0 0 1 12 21A4.5 4.5 0 0 0 12 12A4.5 4.5 0 0 1 12 3ZM13.9 7.5A1.9 1.9 0 1 0 10.1 7.5A1.9 1.9 0 1 0 13.9 7.5Z"/><circle cx="12" cy="16.5" r="1.9" fill="currentColor" stroke="none"/></svg>';
  const SKIP="script,style,textarea,input,.coin";
  function coin(){const s=document.createElement("span");s.className="coin";s.setAttribute("role","img");s.setAttribute("aria-label","coins");s.innerHTML=SVG;return s;}
  function swap(root){
    if(!root||!document.body.contains(root))return;
    const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),hits=[];
    for(let n=walk.nextNode();n;n=walk.nextNode())if(n.nodeValue.includes("¢")&&!n.parentElement?.closest(SKIP))hits.push(n);
    for(const n of hits){
      const parts=n.nodeValue.split("¢"),frag=document.createDocumentFragment();
      parts.forEach((p,i)=>{if(p)frag.append(p);if(i<parts.length-1)frag.append(coin());});
      n.replaceWith(frag);
    }
  }
  function start(){
    swap(document.body);
    new MutationObserver(list=>{
      for(const m of list){
        if(m.type==="characterData")swap(m.target.parentNode);
        else m.addedNodes.forEach(x=>swap(x.nodeType===1?x:x.parentNode));
      }
    }).observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  if(typeof document!=="undefined"&&typeof MutationObserver!=="undefined")start();
  window.SlotchinkoCoin={SVG};
})();
